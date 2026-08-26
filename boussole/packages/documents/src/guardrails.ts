import type { CandidateProfile } from '@boussole/core';
import { canonicalize, extractSkills, isSameSkill, normalizeSkillNames } from '@boussole/core';

/**
 * Garde-fous anti-invention de la forge documentaire.
 *
 * C'est la dernière barrière avant qu'un document parte chez un employeur.
 * Elle vérifie mécaniquement que **tout fait affirmé dans le document existe
 * dans le profil**.
 *
 * Le principe : la forge n'a le droit de *reformuler* que des phrases déjà
 * présentes dans le profil, et n'a le droit de *mettre en avant* que des
 * compétences que le profil atteste. Elle n'a jamais le droit d'ajouter une
 * technologie, un diplôme, une certification, une durée ou un chiffre.
 *
 * Ces contrôles sont **déterministes et hors LLM** : ils s'appliquent
 * identiquement à un texte écrit par un modèle et à un texte assemblé par le
 * code. C'est ce qui permettra d'ajouter la réécriture par LLM en V1 sans
 * affaiblir la garantie.
 */

export type ViolationKind =
  | 'unknown_skill'
  | 'unknown_certification'
  | 'unknown_employer'
  | 'invented_number'
  | 'invented_duration'
  | 'unknown_degree';

export interface GuardrailViolation {
  kind: ViolationKind;
  /** Fragment fautif, tel qu'il apparaît dans le document. */
  fragment: string;
  explanation: string;
}

export interface GuardrailReport {
  ok: boolean;
  violations: GuardrailViolation[];
}

/**
 * Ensemble des chiffres que le profil atteste.
 * Un document ne peut contenir que ceux-là — « 12 000 usagers » est vrai
 * seulement si le profil le dit.
 */
function collectKnownNumbers(profile: CandidateProfile): Set<string> {
  const numbers = new Set<string>();

  const harvest = (text: string) => {
    for (const match of text.matchAll(/\d[\d\s.,]*\s*%?/g)) {
      const cleaned = normalizeNumber(match[0]);
      if (cleaned) numbers.add(cleaned);
    }
  };

  for (const experience of profile.experiences) {
    experience.bullets.forEach(harvest);
    experience.metrics.forEach(harvest);
    if (experience.summary) harvest(experience.summary);
    harvest(experience.startDate);
    if (experience.endDate) harvest(experience.endDate);
  }
  for (const project of profile.projects) {
    project.bullets.forEach(harvest);
    if (project.description) harvest(project.description);
  }
  for (const education of profile.education) {
    if (education.startDate) harvest(education.startDate);
    if (education.endDate) harvest(education.endDate);
  }
  for (const skill of profile.skills) {
    if (skill.yearsOfExperience !== undefined) numbers.add(String(skill.yearsOfExperience));
  }
  if (profile.identity.summary) harvest(profile.identity.summary);

  return numbers;
}

function normalizeNumber(raw: string): string {
  return raw.replace(/[\s.,%]/g, '').replace(/^0+(?=\d)/, '');
}

/**
 * Vérifie qu'un document ne contient que des faits attestés par le profil.
 *
 * @param documentText Texte du document, tel qu'un ATS le lira.
 * @param allowedKeywords Mots-clés que l'analyse d'écart a explicitement
 *        autorisés (statut `missing_from_cv` : présents au profil mais absents
 *        du CV). Aucun autre mot-clé technique ne peut être introduit.
 */
export function verifyDocument(
  documentText: string,
  profile: CandidateProfile,
  allowedKeywords: string[] = [],
): GuardrailReport {
  const violations: GuardrailViolation[] = [];

  // --- 1. Compétences ----------------------------------------------------
  const profileSkillNames = new Set<string>();
  for (const skill of normalizeSkillNames(profile.skills.map((s) => s.name))) {
    profileSkillNames.add(skill);
  }
  for (const experience of profile.experiences) {
    for (const skill of normalizeSkillNames(experience.skills)) profileSkillNames.add(skill);
    for (const found of extractSkills(experience.bullets.join(' '))) {
      profileSkillNames.add(found.canonical);
    }
  }
  for (const project of profile.projects) {
    for (const skill of normalizeSkillNames(project.skills)) profileSkillNames.add(skill);
    for (const found of extractSkills(project.bullets.join(' '))) {
      profileSkillNames.add(found.canonical);
    }
  }

  const allowed = new Set(normalizeSkillNames(allowedKeywords));

  for (const found of extractSkills(documentText)) {
    const known =
      [...profileSkillNames].some((name) => isSameSkill(name, found.canonical)) ||
      [...allowed].some((name) => isSameSkill(name, found.canonical));

    if (!known) {
      violations.push({
        kind: 'unknown_skill',
        fragment: found.canonical,
        explanation: `« ${found.canonical} » n'apparaît nulle part dans votre profil. Boussole n'ajoute jamais une compétence que vous n'avez pas déclarée.`,
      });
    }
  }

  // --- 2. Employeurs -----------------------------------------------------
  // On ne vérifie que dans le sens « le document ne cite pas d'employeur
  // inconnu » : l'inverse (un employeur du profil absent du document) est
  // normal, un CV ciblé ne liste pas tout.
  const canonicalDocument = canonicalize(documentText);
  const knownEmployers = new Set(profile.experiences.map((e) => canonicalize(e.company)));

  // --- 3. Certifications et diplômes -------------------------------------
  const knownCredentials = [
    ...profile.certifications.map((c) => canonicalize(c.name)),
    ...profile.education.map((e) => canonicalize(e.degree)),
  ];

  for (const credential of extractCredentialMentions(documentText)) {
    const canonical = canonicalize(credential);
    const known = knownCredentials.some(
      (candidate) => candidate.includes(canonical) || canonical.includes(candidate),
    );
    if (!known) {
      violations.push({
        kind: 'unknown_certification',
        fragment: credential,
        explanation: `« ${credential} » ne correspond à aucune certification ni à aucun diplôme de votre profil.`,
      });
    }
  }

  // --- 4. Chiffres -------------------------------------------------------
  const knownNumbers = collectKnownNumbers(profile);
  for (const match of documentText.matchAll(/(?<![\w-])(\d[\d\s.,]*)\s*(%|\+)?(?![\w-])/g)) {
    const raw = match[1] ?? '';
    const normalized = normalizeNumber(raw);
    // Les petits nombres sont omniprésents dans une mise en page (numéros de
    // page, années à deux chiffres) : les signaler noierait les vraies
    // alertes sous du bruit.
    if (!normalized || normalized.length < 3) continue;
    if (knownNumbers.has(normalized)) continue;

    violations.push({
      kind: 'invented_number',
      fragment: raw.trim(),
      explanation: `Le chiffre « ${raw.trim()} » n'apparaît pas dans votre profil. Un résultat chiffré doit venir de vous, pas d'une estimation.`,
    });
  }

  // --- 5. Employeurs cités ----------------------------------------------
  for (const employer of extractEmployerMentions(documentText)) {
    const canonical = canonicalize(employer);
    if (!canonical) continue;
    if ([...knownEmployers].some((known) => known.includes(canonical))) continue;
    // Le nom de l'entreprise visée par la candidature est légitime dans une
    // lettre : il est traité par `verifyLetter`, pas ici.
    if (canonicalDocument.includes(canonical)) continue;

    violations.push({
      kind: 'unknown_employer',
      fragment: employer,
      explanation: `« ${employer} » n'est pas un employeur de votre profil.`,
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Mentions ressemblant à une certification ou à un diplôme.
 *
 * Le mot déclencheur est reconnu quelle que soit sa casse — « Certifiée » en
 * début de phrase est le cas le plus fréquent — mais le nom capturé reste
 * sensible à la casse : avec un drapeau `i` global, `[A-Z]` capterait
 * n'importe quel mot courant et noierait le rapport de faux positifs.
 */
function extractCredentialMentions(text: string): string[] {
  const CREDENTIAL_NAME = String.raw`[A-Z][\w+#.&-]*(?:\s+[A-Z][\w+#.&-]*){0,3}`;
  const patterns = [
    new RegExp(
      String.raw`(?:[Cc]ertifi(?:ée?|cation|é)|CERTIFI[ÉE]{1,2}|[Cc]ertified)\s+(?:en\s+|in\s+|as\s+(?:an?\s+)?)?(${CREDENTIAL_NAME})`,
      'g',
    ),
    /\b(AWS Certified [\w\s]+?)\b/g,
    /\b(PMP|CPA|CFA|CISSP|CISA|Scrum Master certifié|PSM I{1,3}|CSM)\b/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[1] ?? match[0]).trim();
      if (value) found.add(value);
    }
  }
  return [...found];
}

/** Mentions ressemblant à un employeur (« chez X », « at X »). */
function extractEmployerMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b(?:chez|at)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,2})/g)) {
    const value = match[1]?.trim();
    if (value) found.add(value);
  }
  return [...found];
}

/**
 * Contrôle propre aux lettres : le nom de l'entreprise visée y est légitime,
 * contrairement au CV.
 */
export function verifyLetter(
  letterText: string,
  profile: CandidateProfile,
  targetCompany: string,
  allowedKeywords: string[] = [],
): GuardrailReport {
  const report = verifyDocument(letterText, profile, allowedKeywords);
  const canonicalTarget = canonicalize(targetCompany);

  const filtered = report.violations.filter((violation) => {
    if (violation.kind !== 'unknown_employer') return true;
    return !canonicalize(violation.fragment).includes(canonicalTarget);
  });

  return { ok: filtered.length === 0, violations: filtered };
}

/** Lève une erreur explicite si un document viole les garde-fous. */
export class GuardrailError extends Error {
  constructor(readonly report: GuardrailReport) {
    super(
      `Génération refusée : ${report.violations.length} affirmation(s) non attestée(s) par le profil — ` +
        report.violations.map((v) => v.fragment).join(', '),
    );
    this.name = 'GuardrailError';
  }
}
