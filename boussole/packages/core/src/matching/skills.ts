import { canonicalize } from '../text/normalize.js';
import { lookupSkill, SKILL_TAXONOMY, type SkillDefinition } from './taxonomy.js';

/**
 * Extraction de compétences depuis du texte libre.
 *
 * Approche déterministe et explicable : chaque compétence détectée est
 * accompagnée de l'extrait qui l'a déclenchée. C'est ce qui permet à
 * l'interface de justifier « pourquoi Boussole pense que cette offre exige
 * Kubernetes » — et à l'utilisateur de corriger.
 *
 * Aucun appel LLM ici : l'extraction doit rester gratuite, instantanée et
 * reproductible. Le LLM n'intervient qu'en aval, sur les offres retenues.
 */

export interface ExtractedSkill {
  canonical: string;
  category: SkillDefinition['category'];
  /** Nombre d'occurrences dans le texte. */
  occurrences: number;
  /** Extrait de contexte, pour vérification. */
  evidence?: string;
  /** Vrai si le terme apparaît dans une section « exigences ». */
  required: boolean;
}

/** Échappe une chaîne destinée à une expression régulière. */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Construit le motif d'un alias. Les frontières `\b` de JavaScript ne
 * fonctionnent pas après « + » ou « # » (ce sont déjà des non-mots) : pour
 * « C++ » et « C# » on exige donc un séparateur ou une fin de chaîne.
 */
function aliasPattern(alias: string): RegExp {
  const escaped = escapeRegExp(alias);
  const endsWithSymbol = /[+#.]$/.test(alias);
  const prefix = /^[a-z0-9]/i.test(alias) ? '(?<![a-z0-9])' : '';
  const suffix = endsWithSymbol ? '(?![a-z0-9])' : '(?![a-z0-9+#])';
  return new RegExp(`${prefix}${escaped}${suffix}`, 'gi');
}

const PATTERN_CACHE = new Map<string, RegExp>();
function cachedPattern(alias: string): RegExp {
  let pattern = PATTERN_CACHE.get(alias);
  if (!pattern) {
    pattern = aliasPattern(alias);
    PATTERN_CACHE.set(alias, pattern);
  }
  pattern.lastIndex = 0;
  return pattern;
}

export interface ExtractSkillsOptions {
  /**
   * Sections d'exigences. Une compétence qui y figure est marquée `required`,
   * ce qui pèse bien plus lourd dans le scoring qu'une simple mention.
   */
  requirementText?: string;
  /**
   * Inclure les termes ambigus (« go », « r », « tableau »). Faux par défaut
   * pour le texte libre : trop de faux positifs. Vrai quand la source est
   * une liste de compétences déclarée par le candidat.
   */
  includeAmbiguous?: boolean;
}

export function extractSkills(text: string, options: ExtractSkillsOptions = {}): ExtractedSkill[] {
  const { requirementText = '', includeAmbiguous = false } = options;
  if (!text?.trim()) return [];

  const haystack = canonicalize(text);
  const requirementHaystack = requirementText ? canonicalize(requirementText) : '';

  const found = new Map<string, ExtractedSkill>();

  for (const skill of SKILL_TAXONOMY) {
    if (skill.ambiguous && !includeAmbiguous) continue;

    let occurrences = 0;
    let evidence: string | undefined;

    for (const alias of skill.aliases) {
      const pattern = cachedPattern(alias);
      const matches = haystack.match(pattern);
      if (!matches) continue;
      occurrences += matches.length;
      evidence ??= extractContext(haystack, alias);
    }

    if (occurrences === 0) continue;

    const required = requirementHaystack
      ? skill.aliases.some((alias) => cachedPattern(alias).test(requirementHaystack))
      : false;

    found.set(skill.canonical, {
      canonical: skill.canonical,
      category: skill.category,
      occurrences,
      evidence,
      required,
    });
  }

  return [...found.values()].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.occurrences - a.occurrences;
  });
}

function extractContext(haystack: string, alias: string, radius = 45): string | undefined {
  const index = haystack.indexOf(alias.toLowerCase());
  if (index < 0) return undefined;
  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + alias.length + radius);
  return `…${haystack.slice(start, end).trim()}…`;
}

/**
 * Normalise une liste de compétences déclarées par le candidat vers la forme
 * canonique de la taxonomie. Les compétences hors taxonomie sont conservées
 * telles quelles : la taxonomie ne doit jamais faire disparaître une
 * compétence réelle du candidat.
 */
export function normalizeSkillNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const definition = lookupSkill(canonicalize(trimmed)) ?? lookupSkill(trimmed);
    out.add(definition ? definition.canonical : trimmed);
  }
  return [...out];
}

/** Vrai si deux libellés désignent la même compétence. */
export function isSameSkill(a: string, b: string): boolean {
  if (canonicalize(a) === canonicalize(b)) return true;
  const defA = lookupSkill(canonicalize(a));
  const defB = lookupSkill(canonicalize(b));
  return Boolean(defA && defB && defA.canonical === defB.canonical);
}
