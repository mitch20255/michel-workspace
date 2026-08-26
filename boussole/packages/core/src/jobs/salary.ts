import type { Salary } from '../schemas/job.js';
import type { Currency, SalaryPeriod } from '../schemas/common.js';
import { truncate } from '../text/normalize.js';

/**
 * Extraction de rémunération depuis du texte libre.
 *
 * Principe : **ne rien retourner plutôt que retourner faux.** Un salaire
 * inventé fausse le scoring et peut pousser le candidat à refuser une bonne
 * offre. Chaque résultat porte une confiance et l'extrait littéral qui l'a
 * produit, pour vérification humaine.
 */

const CURRENCY_BY_SYMBOL: Record<string, Currency> = {
  $: 'USD', // Résolu plus finement par `resolveDollar` selon le contexte.
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
};

const CURRENCY_BY_CODE: Record<string, Currency> = {
  cad: 'CAD',
  cdn: 'CAD',
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  chf: 'CHF',
  aud: 'AUD',
  jpy: 'JPY',
};

/**
 * « $ » est ambigu. On tranche sur le contexte proche, et à défaut on retourne
 * `undefined` : un montant sans devise reste exploitable, une mauvaise devise
 * ne l'est pas.
 */
function resolveDollar(context: string): Currency | undefined {
  const lower = context.toLowerCase();
  if (/\b(cad|cdn|c\$|canadian|canadien)\b/.test(lower)) return 'CAD';
  if (/\b(usd|us\$|american)\b/.test(lower)) return 'USD';
  if (/\b(qu[ée]bec|montr[ée]al|ontario|canada|toronto|vancouver|laval|gatineau)\b/.test(lower)) {
    return 'CAD';
  }
  return undefined;
}

const PERIOD_PATTERNS: Array<{ period: SalaryPeriod; pattern: RegExp }> = [
  { period: 'hour', pattern: /\b(?:\/\s*h(?:eure|r|our)?|per hour|hourly|de l'heure|horaire)\b/i },
  { period: 'day', pattern: /\b(?:\/\s*(?:jour|day)|per day|daily|par jour|journalier)\b/i },
  { period: 'week', pattern: /\b(?:\/\s*(?:semaine|week)|per week|weekly|par semaine)\b/i },
  { period: 'month', pattern: /\b(?:\/\s*(?:mois|month)|per month|monthly|par mois|mensuel)\b/i },
  {
    period: 'year',
    pattern:
      /\b(?:\/\s*(?:an|ann[ée]e|yr|year)|per year|annually|annual|par an|annuel|yearly|k\/an)\b/i,
  },
];

function detectPeriod(context: string): SalaryPeriod | undefined {
  for (const { period, pattern } of PERIOD_PATTERNS) {
    if (pattern.test(context)) return period;
  }
  return undefined;
}

/**
 * Devine la période à partir de l'ordre de grandeur, quand le texte ne la dit
 * pas. Seuils prudents et volontairement grossiers ; la confiance retombe à
 * `low` dès que cette heuristique est utilisée.
 */
function inferPeriodFromMagnitude(value: number): SalaryPeriod | undefined {
  if (value >= 1000) return 'year';
  if (value <= 200 && value >= 10) return 'hour';
  return undefined;
}

/** « 85k » → 85000 ; « 85 000 » → 85000 ; « 85,000.50 » → 85000.5 */
function parseAmount(raw: string): number | undefined {
  const cleaned = raw.trim().toLowerCase();
  const hasK = /k$/.test(cleaned);
  let numeric = cleaned.replace(/k$/, '');

  // Séparateurs de milliers : espace, espace insécable, apostrophe.
  numeric = numeric.replace(/[\s\u00a0\u202f']/g, '');

  const commaCount = (numeric.match(/,/g) ?? []).length;
  const dotCount = (numeric.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    // Le dernier séparateur rencontré est le décimal.
    if (numeric.lastIndexOf(',') > numeric.lastIndexOf('.')) {
      numeric = numeric.replace(/\./g, '').replace(',', '.');
    } else {
      numeric = numeric.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    // « 85,000 » = milliers (anglais) ; « 24,50 » = décimal (français).
    const afterComma = numeric.split(',').pop() ?? '';
    numeric = afterComma.length === 3 ? numeric.replace(/,/g, '') : numeric.replace(',', '.');
  } else if (dotCount > 1) {
    numeric = numeric.replace(/\./g, '');
  }

  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return hasK ? value * 1000 : value;
}

// Un montant : chiffres avec séparateurs optionnels, suffixe k optionnel.
const AMOUNT = String.raw`\d{1,3}(?:[\s\u00a0\u202f',.]\d{3})*(?:[.,]\d{1,2})?\s*k?|\d+(?:[.,]\d{1,2})?\s*k?`;
const SEP = String.raw`\s*(?:-|–|—|à|a|to|et|jusqu'?[àa])\s*`;
const SYMBOL = String.raw`[$€£¥]`;

const RANGE_RE = new RegExp(
  String.raw`(${SYMBOL})?\s*(${AMOUNT})\s*(${SYMBOL})?${SEP}(${SYMBOL})?\s*(${AMOUNT})\s*(${SYMBOL})?`,
  'i',
);

const SINGLE_RE = new RegExp(String.raw`(${SYMBOL})?\s*(${AMOUNT})\s*(${SYMBOL})?`, 'i');

/**
 * Un montant plausible pour une rémunération. Sert à écarter les nombres
 * parasites (« 2024 », « 500 employés », « 15 ans d'expérience »).
 */
function isPlausible(value: number, period: SalaryPeriod | undefined): boolean {
  if (value <= 0) return false;
  switch (period) {
    case 'hour':
      return value >= 10 && value <= 500;
    case 'day':
      return value >= 80 && value <= 5000;
    case 'week':
      return value >= 300 && value <= 20000;
    case 'month':
      return value >= 800 && value <= 100000;
    case 'year':
      return value >= 10000 && value <= 2000000;
    default:
      return value >= 10 && value <= 2000000;
  }
}

const SALARY_KEYWORDS =
  /\b(salaire|salary|r[ée]mun[ée]ration|compensation|pay|wage|taux horaire|hourly rate|base pay|fourchette|range|package)\b/i;

export interface ParseSalaryOptions {
  /** Indice de localisation, utilisé pour désambiguïser « $ ». */
  locationHint?: string;
}

/**
 * Extrait une rémunération d'un texte libre.
 *
 * @returns `undefined` si aucune extraction n'est suffisamment sûre.
 */
export function parseSalary(text: string, options: ParseSalaryOptions = {}): Salary | undefined {
  if (!text) return undefined;

  // On ne cherche que dans les phrases qui parlent d'argent : chercher partout
  // ramène les effectifs, les millésimes et les tailles de marché.
  const candidates = text
    .split(/\n+|(?<=[.;])\s+/)
    .filter((line) => SALARY_KEYWORDS.test(line) || /[$€£¥]/.test(line));

  for (const line of candidates) {
    const hint = `${line} ${options.locationHint ?? ''}`;
    const period = detectPeriod(line);

    const rangeMatch = RANGE_RE.exec(line);
    if (rangeMatch) {
      const min = parseAmount(rangeMatch[2] ?? '');
      const max = parseAmount(rangeMatch[5] ?? '');
      const symbol = rangeMatch[1] ?? rangeMatch[3] ?? rangeMatch[4] ?? rangeMatch[6];
      const resolvedPeriod = period ?? inferPeriodFromMagnitude(min ?? max ?? 0);

      if (
        min !== undefined &&
        max !== undefined &&
        min <= max &&
        isPlausible(min, resolvedPeriod) &&
        isPlausible(max, resolvedPeriod)
      ) {
        return {
          min,
          max,
          currency: resolveCurrency(symbol, hint),
          period: resolvedPeriod,
          // Fourchette explicite + période explicite = donnée fiable.
          confidence: period ? 'high' : 'medium',
          evidence: truncate(line.trim(), 300),
        };
      }
    }

    // Montant unique : n'est retenu que si la phrase parle explicitement de
    // rémunération, sinon le risque de faux positif est trop élevé.
    if (!SALARY_KEYWORDS.test(line)) continue;

    const singleMatch = SINGLE_RE.exec(line);
    if (singleMatch) {
      const value = parseAmount(singleMatch[2] ?? '');
      const symbol = singleMatch[1] ?? singleMatch[3];
      const resolvedPeriod = period ?? inferPeriodFromMagnitude(value ?? 0);
      if (value !== undefined && isPlausible(value, resolvedPeriod)) {
        return {
          min: value,
          max: value,
          currency: resolveCurrency(symbol, hint),
          period: resolvedPeriod,
          confidence: 'low',
          evidence: truncate(line.trim(), 300),
        };
      }
    }
  }

  return undefined;
}

function resolveCurrency(symbol: string | undefined, context: string): Currency | undefined {
  const codeMatch = /\b(cad|cdn|usd|eur|gbp|chf|aud|jpy)\b/i.exec(context);
  if (codeMatch?.[1]) {
    const code = CURRENCY_BY_CODE[codeMatch[1].toLowerCase()];
    if (code) return code;
  }
  if (!symbol) return undefined;
  if (symbol === '$') return resolveDollar(context);
  return CURRENCY_BY_SYMBOL[symbol];
}

/**
 * Ramène une rémunération à un équivalent annuel pour permettre la
 * comparaison avec les prétentions du candidat.
 *
 * Bases : 2080 h/an (40 h × 52), 260 j/an, 52 semaines. Ce sont des
 * conventions ; elles sont approximatives et documentées comme telles.
 *
 * @returns `undefined` si la période est inconnue — comparer à l'aveugle
 *          produirait un écart de facteur 2000.
 */
export function toAnnual(amount: number, period: SalaryPeriod | undefined): number | undefined {
  switch (period) {
    case 'hour':
      return amount * 2080;
    case 'day':
      return amount * 260;
    case 'week':
      return amount * 52;
    case 'month':
      return amount * 12;
    case 'year':
      return amount;
    default:
      return undefined;
  }
}
