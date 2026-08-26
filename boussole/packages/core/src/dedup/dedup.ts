import { blockingKey } from '../jobs/fingerprint.js';
import { normalizeCompanyName, normalizeJobTitle } from '../text/normalize.js';
import { tokenSet } from '../text/tokens.js';
import { containment, jaccard, jaroWinkler, trigramSimilarity } from './similarity.js';

/**
 * Déduplication d'offres.
 *
 * Objectif : que le CRM ne contienne jamais cinq variantes de la même offre.
 *
 * Stratégie en cascade, du moins cher au plus cher :
 *  1. Même source + même `sourceJobId` → identité certaine, aucun calcul.
 *  2. Même `identityKey` → identité quasi certaine.
 *  3. Même clé de blocage → comparaison fine (titre, lieu, description).
 *  4. Aucune clé commune → jamais comparées.
 *
 * L'étape 3 est la seule coûteuse, et le blocage la borne : sans lui, 5 000
 * offres feraient 12,5 millions de comparaisons.
 */

export interface DedupCandidate {
  id: string;
  source: string;
  sourceJobId: string;
  identityKey: string;
  companyName: string;
  title: string;
  primaryLocation?: string;
  descriptionText?: string;
}

export interface SimilarityBreakdown {
  title: number;
  company: number;
  location: number;
  description: number;
  overall: number;
}

/**
 * Poids de la combinaison. Le titre domine parce que c'est le seul champ
 * toujours présent et toujours discriminant ; la description est fiable mais
 * souvent absente ou tronquée selon les connecteurs.
 */
const WEIGHTS = { title: 0.4, company: 0.25, location: 0.1, description: 0.25 } as const;

/** Au-dessus : même offre. En dessous de `REVIEW_THRESHOLD` : offres distinctes. */
export const DUPLICATE_THRESHOLD = 0.86;
/** Entre les deux : regroupement proposé, à confirmer par l'utilisateur. */
export const REVIEW_THRESHOLD = 0.72;

export function compareJobs(a: DedupCandidate, b: DedupCandidate): SimilarityBreakdown {
  const titleA = normalizeJobTitle(a.title);
  const titleB = normalizeJobTitle(b.title);
  // Deux mesures : Jaro-Winkler rattrape les variantes courtes,
  // les trigrammes rattrapent les réordonnancements de mots.
  const title = Math.max(jaroWinkler(titleA, titleB), trigramSimilarity(titleA, titleB));

  const companyA = normalizeCompanyName(a.companyName);
  const companyB = normalizeCompanyName(b.companyName);
  const company = jaroWinkler(companyA, companyB);

  const location = compareLocations(a.primaryLocation, b.primaryLocation);
  const description = compareDescriptions(a.descriptionText, b.descriptionText);

  // Une description absente ne doit pas pénaliser : on redistribue son poids
  // sur les autres critères plutôt que de compter 0.
  const hasDescription = Boolean(a.descriptionText && b.descriptionText);
  const hasLocation = Boolean(a.primaryLocation && b.primaryLocation);

  let totalWeight = WEIGHTS.title + WEIGHTS.company;
  let weighted = title * WEIGHTS.title + company * WEIGHTS.company;

  if (hasLocation) {
    weighted += location * WEIGHTS.location;
    totalWeight += WEIGHTS.location;
  }
  if (hasDescription) {
    weighted += description * WEIGHTS.description;
    totalWeight += WEIGHTS.description;
  }

  return {
    title: round(title),
    company: round(company),
    location: round(location),
    description: round(description),
    overall: round(weighted / totalWeight),
  };
}

function compareLocations(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const setA = tokenSet(a, { removeStopwords: false });
  const setB = tokenSet(b, { removeStopwords: false });
  // Le recouvrement l'emporte sur Jaccard : « Montréal » vs
  // « Montréal, QC, Canada » désigne le même lieu.
  return Math.max(containment(setA, setB), jaccard(setA, setB));
}

function compareDescriptions(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  // Idem : une offre republiée est souvent un extrait de la précédente.
  return Math.max(jaccard(setA, setB), containment(setA, setB) * 0.95);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

export interface DuplicateGroup {
  /** Identifiant du groupe = id de l'offre représentante. */
  groupId: string;
  memberIds: string[];
  /** Paires regroupées automatiquement, avec la raison. */
  matches: Array<{
    a: string;
    b: string;
    score: number;
    reason: 'same_source_id' | 'same_identity_key' | 'similarity';
  }>;
}

export interface DedupResult {
  groups: DuplicateGroup[];
  /** Mapping id d'offre → id de groupe, prêt à écrire en base. */
  assignments: Map<string, string>;
  /** Paires ambiguës : à soumettre à l'utilisateur, jamais fusionnées seules. */
  needsReview: Array<{ a: string; b: string; score: number }>;
}

/**
 * Regroupe un lot d'offres.
 *
 * Union-find : le regroupement est transitif (si A≡B et B≡C alors A, B et C
 * forment un seul groupe), ce qui est le comportement attendu pour des
 * republications successives d'une même offre.
 */
export function dedupeJobs(candidates: DedupCandidate[]): DedupResult {
  const parent = new Map<string, string>();
  const matches: DuplicateGroup['matches'] = [];
  const needsReview: DedupResult['needsReview'] = [];

  for (const c of candidates) parent.set(c.id, c.id);

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    // Compression de chemin.
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor) ?? root;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    // Le plus petit id devient la racine : le groupe est stable entre deux
    // exécutions, ce qui évite de réécrire toute la table à chaque ingestion.
    const [keep, drop] = rootA < rootB ? [rootA, rootB] : [rootB, rootA];
    parent.set(drop, keep);
  }

  // Étape 1 & 2 : index exacts.
  const bySourceId = new Map<string, string>();
  const byIdentity = new Map<string, string>();

  for (const c of candidates) {
    const sourceKey = `${c.source}:${c.sourceJobId}`;
    const existingSource = bySourceId.get(sourceKey);
    if (existingSource) {
      union(existingSource, c.id);
      matches.push({ a: existingSource, b: c.id, score: 1, reason: 'same_source_id' });
    } else {
      bySourceId.set(sourceKey, c.id);
    }

    const existingIdentity = byIdentity.get(c.identityKey);
    if (existingIdentity) {
      union(existingIdentity, c.id);
      matches.push({ a: existingIdentity, b: c.id, score: 1, reason: 'same_identity_key' });
    } else {
      byIdentity.set(c.identityKey, c.id);
    }
  }

  // Étape 3 : comparaison fine à l'intérieur de chaque bloc.
  const blocks = new Map<string, DedupCandidate[]>();
  for (const c of candidates) {
    const key = blockingKey(c.companyName, c.title);
    const bucket = blocks.get(key);
    if (bucket) bucket.push(c);
    else blocks.set(key, [c]);
  }

  for (const bucket of blocks.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        if (!a || !b) continue;
        if (find(a.id) === find(b.id)) continue; // Déjà regroupées.

        const { overall } = compareJobs(a, b);
        if (overall >= DUPLICATE_THRESHOLD) {
          union(a.id, b.id);
          matches.push({ a: a.id, b: b.id, score: overall, reason: 'similarity' });
        } else if (overall >= REVIEW_THRESHOLD) {
          needsReview.push({ a: a.id, b: b.id, score: overall });
        }
      }
    }
  }

  const grouped = new Map<string, string[]>();
  for (const c of candidates) {
    const root = find(c.id);
    const members = grouped.get(root);
    if (members) members.push(c.id);
    else grouped.set(root, [c.id]);
  }

  const assignments = new Map<string, string>();
  const groups: DuplicateGroup[] = [];
  for (const [groupId, memberIds] of grouped) {
    for (const id of memberIds) assignments.set(id, groupId);
    groups.push({
      groupId,
      memberIds: [...memberIds].sort(),
      matches: matches.filter((m) => memberIds.includes(m.a) && memberIds.includes(m.b)),
    });
  }

  return { groups, assignments, needsReview };
}

/**
 * Choisit l'offre à présenter pour un groupe de doublons.
 * Critères, dans l'ordre : description la plus complète, puis vue le plus
 * récemment. On garde l'offre la plus informative, pas la plus ancienne.
 */
export function pickCanonical<T extends { descriptionText?: string; lastSeenAt?: string }>(
  members: T[],
): T | undefined {
  return [...members].sort((a, b) => {
    const lengthDiff = (b.descriptionText?.length ?? 0) - (a.descriptionText?.length ?? 0);
    if (lengthDiff !== 0) return lengthDiff;
    return (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '');
  })[0];
}
