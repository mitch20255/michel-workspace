import type { Confidence, Location, RemotePolicy } from '../schemas/common.js';
import { canonicalize, collapseWhitespace, deaccent } from '../text/normalize.js';

/**
 * Analyse de localisation et de politique de télétravail.
 *
 * Portée assumée : le marché canadien/québécois d'abord, puis US/EU en
 * dégradé. Un géocodeur complet serait une dépendance externe (et un appel
 * réseau par offre) ; ici on résout ce qu'on peut de façon déterministe et on
 * conserve toujours `raw` pour que l'humain tranche.
 */

const PROVINCE_CODES: Record<string, string> = {
  qc: 'Québec',
  quebec: 'Québec',
  on: 'Ontario',
  ontario: 'Ontario',
  bc: 'Colombie-Britannique',
  ab: 'Alberta',
  mb: 'Manitoba',
  sk: 'Saskatchewan',
  ns: 'Nouvelle-Écosse',
  nb: 'Nouveau-Brunswick',
  nl: 'Terre-Neuve-et-Labrador',
  pe: 'Île-du-Prince-Édouard',
  yt: 'Yukon',
  nt: 'Territoires du Nord-Ouest',
  nu: 'Nunavut',
};

const QUEBEC_CITIES = new Set([
  'montreal',
  'quebec',
  'laval',
  'gatineau',
  'longueuil',
  'sherbrooke',
  'saguenay',
  'levis',
  'trois rivieres',
  'terrebonne',
  'brossard',
  'saint jean sur richelieu',
  'repentigny',
  'drummondville',
  'saint jerome',
  'granby',
  'blainville',
  'mirabel',
  'rimouski',
  'boucherville',
]);

const COUNTRY_HINTS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(canada|ca)\b/i, code: 'CA' },
  { pattern: /\b(united states|usa|u\.s\.a?\.?|us)\b/i, code: 'US' },
  { pattern: /\b(france|fr)\b/i, code: 'FR' },
  { pattern: /\b(united kingdom|uk|england|royaume-uni)\b/i, code: 'GB' },
  { pattern: /\b(deutschland|germany|allemagne|de)\b/i, code: 'DE' },
  { pattern: /\b(belgique|belgium|be)\b/i, code: 'BE' },
  { pattern: /\b(suisse|switzerland|ch)\b/i, code: 'CH' },
];

const REMOTE_PATTERNS =
  /\b(?:100\s*%\s*remote|fully remote|remote[- ]first|work from home|t[ée]l[ée]travail(?:\s+(?:complet|total|à\s*100\s*%))?|à\s*distance|a distance|anywhere|remote)\b/i;

const HYBRID_PATTERNS =
  /\b(?:hybrid[e]?|mode hybride|(?:\d\s*(?:-|–|to|à)\s*\d\s*(?:days?|jours?)\s*(?:per|par|\/)\s*(?:week|semaine))|(?:\d\s*(?:days?|jours?)\s*(?:in|au)\s*(?:the\s*)?(?:office|bureau))|flex(?:ible)?\s*(?:work|travail))\b/i;

const ONSITE_PATTERNS =
  /\b(?:on-?site|sur (?:le )?site|sur place|in-?office|in-?person|pr[ée]sentiel|no remote|pas de t[ée]l[ée]travail)\b/i;

export interface RemoteDetection {
  policy: RemotePolicy;
  confidence: Confidence;
  /** Extrait qui a déclenché la détection, pour affichage et vérification. */
  evidence?: string;
}

/**
 * Détermine la politique de télétravail.
 *
 * Ordre d'évaluation : hybride avant remote, car « hybrid — 2 days remote »
 * contient le mot « remote » mais n'est pas un poste à distance. Puis onsite,
 * puis remote seul.
 *
 * @param strong Champs structurés de l'ATS (workplaceType, etc.), plus fiables
 *               que la description.
 */
export function detectRemotePolicy(text: string, strong?: string): RemoteDetection {
  if (strong) {
    const canonical = canonicalize(strong);
    if (/\bhybrid/.test(canonical)) {
      return { policy: 'hybrid', confidence: 'high', evidence: strong };
    }
    if (/\bremote|distance|domicile/.test(canonical)) {
      return { policy: 'remote', confidence: 'high', evidence: strong };
    }
    if (/\bon\s?site|office|presentiel|sur place/.test(canonical)) {
      return { policy: 'onsite', confidence: 'high', evidence: strong };
    }
  }

  if (!text) return { policy: 'unknown', confidence: 'low' };

  const hybrid = HYBRID_PATTERNS.exec(text);
  if (hybrid) return { policy: 'hybrid', confidence: 'medium', evidence: hybrid[0] };

  const onsite = ONSITE_PATTERNS.exec(text);
  const remote = REMOTE_PATTERNS.exec(text);

  // Les deux présents sans marqueur hybride explicite : trop ambigu pour
  // trancher. On le dit plutôt que de choisir au hasard.
  if (onsite && remote) return { policy: 'unknown', confidence: 'low', evidence: remote[0] };
  if (onsite) return { policy: 'onsite', confidence: 'medium', evidence: onsite[0] };
  if (remote) {
    // « fully remote » est bien plus fiable que « remote » perdu dans un texte.
    const strongRemote = /100\s*%|fully|first|complet|total/i.test(remote[0]);
    return { policy: 'remote', confidence: strongRemote ? 'high' : 'medium', evidence: remote[0] };
  }

  return { policy: 'unknown', confidence: 'low' };
}

/**
 * Découpe une chaîne de localisation en lieux distincts.
 * Les ATS listent volontiers « Montréal, QC; Toronto, ON; Remote ».
 */
export function parseLocations(raw: string | undefined): Location[] {
  if (!raw?.trim()) return [];

  const parts = raw
    .split(/\s*(?:;|\||\bor\b|\bou\b|\/)\s*/i)
    .map((p) => collapseWhitespace(p))
    .filter(Boolean);

  const locations: Location[] = [];
  for (const part of parts) {
    const parsed = parseSingleLocation(part);
    if (parsed) locations.push(parsed);
  }
  return locations;
}

function parseSingleLocation(raw: string): Location | undefined {
  const trimmed = collapseWhitespace(raw);
  if (!trimmed) return undefined;

  // Une mention purement « remote » n'est pas un lieu ; elle est captée par
  // detectRemotePolicy. On la conserve quand même comme `raw` seul, sinon
  // l'information disparaît de l'affichage.
  if (/^(remote|t[ée]l[ée]travail|anywhere|à distance)$/i.test(trimmed)) {
    return { raw: trimmed };
  }

  const segments = trimmed
    .split(',')
    .map((s) => collapseWhitespace(s))
    .filter(Boolean);

  const location: Location = { raw: trimmed };

  // Pays : cherché sur le dernier segment en priorité.
  const last = segments[segments.length - 1] ?? '';
  for (const { pattern, code } of COUNTRY_HINTS) {
    if (pattern.test(last)) {
      location.country = code;
      break;
    }
  }

  // Région : segment correspondant à un code ou nom de province.
  for (const segment of segments) {
    const key = deaccent(segment.toLowerCase()).replace(/[^a-z]/g, '');
    const province = PROVINCE_CODES[key];
    if (province) {
      location.region = province;
      location.country ??= 'CA';
      break;
    }
  }

  // Ville : premier segment, s'il ne s'agit pas déjà de la région ou du pays.
  const first = segments[0];
  if (first) {
    const firstKey = deaccent(first.toLowerCase()).replace(/[^a-z]/g, '');
    const isProvince = Boolean(PROVINCE_CODES[firstKey]);
    const isCountry = COUNTRY_HINTS.some(({ pattern }) => pattern.test(first));
    if (!isProvince && !isCountry) location.city = first;
  }

  // Ville québécoise connue : on peut compléter région et pays sans deviner.
  if (location.city) {
    const cityKey = canonicalize(location.city).replace(/-/g, ' ');
    if (QUEBEC_CITIES.has(cityKey)) {
      location.region ??= 'Québec';
      location.country ??= 'CA';
    }
  }

  return location;
}

/**
 * Compatibilité entre un lieu d'offre et un lieu recherché.
 * Comparaison textuelle assumée (pas de distance géodésique sans géocodeur).
 *
 * @returns Score 0–1. 1 = même ville ; 0.6 = même région ; 0.3 = même pays.
 */
export function locationAffinity(job: Location, preference: Location): number {
  const sameCity =
    job.city && preference.city && canonicalize(job.city) === canonicalize(preference.city);
  if (sameCity) return 1;

  const sameRegion =
    job.region && preference.region && canonicalize(job.region) === canonicalize(preference.region);
  if (sameRegion) return 0.6;

  const sameCountry = job.country && preference.country && job.country === preference.country;
  if (sameCountry) return 0.3;

  return 0;
}
