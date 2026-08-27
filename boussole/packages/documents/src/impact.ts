import { canonicalize, isSameSkill } from '@boussole/core';

/**
 * Réécriture d'impact : rendre une puce aussi forte que possible **sans
 * rendre une seule affirmation fausse**.
 *
 * Le constat de départ : la plupart des candidats se sous-vendent dans la
 * forme, pas dans le fond. « Participé à la migration de l'infrastructure,
 * ce qui a réduit les coûts de 30 % » contient un excellent résultat, enterré
 * derrière un verbe d'excuse et rejeté en fin de phrase. Un recruteur qui
 * balaie six secondes par CV ne le verra pas.
 *
 * Ce module ne touche donc jamais aux faits. Il n'a **structurellement pas
 * les moyens** d'en ajouter un : ses seules opérations sont supprimer,
 * permuter, et remplacer un libellé de compétence par un synonyme reconnu
 * comme désignant la même compétence. Cette contrainte est vérifiée
 * mécaniquement par `assertNoNewFacts`, et non simplement promise en
 * commentaire : tout jeton alphanumérique du texte produit doit exister dans
 * le texte d'origine, aux connecteurs près.
 *
 * ## Le cadran
 *
 * Là où la ligne se déplace, c'est sur le **cadrage**, et l'utilisateur
 * choisit de combien :
 *
 *  - `factual`   — texte du profil, mot pour mot. Aucune transformation.
 *  - `confident` — permutations et vocabulaire seulement. Aucune affirmation
 *                  ne change de valeur de vérité. Défaut.
 *  - `assertive` — retire aussi les atténuateurs de rôle (« participé à »,
 *                  « aidé à », « membre de l'équipe qui a »). C'est un
 *                  déplacement réel : « participé à la migration » devient
 *                  « migration ». Le fait reste vrai — vous y avez bien
 *                  travaillé — mais la part qui vous revient n'est plus
 *                  bornée par la phrase.
 *
 * `assertive` est un choix légitime, pas un défaut. La différence entre
 * « valoriser » et « mentir » tient ici à une chose : chaque transformation
 * est enregistrée dans `edits`, l'interface affiche l'avant/après, et rien
 * ne part sans que l'utilisateur ait vu les deux versions. Une exagération
 * assumée et relue est défendable en entretien ; une exagération silencieuse
 * ne l'est pas — c'est elle qui fait perdre une offre au moment des
 * références.
 */

export type ImpactTone = 'factual' | 'confident' | 'assertive';

export const IMPACT_TONE_LABELS_FR: Record<ImpactTone, string> = {
  factual: 'Fidèle — texte du profil, mot pour mot',
  confident: 'Affirmé — résultat en tête, formulations nettes',
  assertive: 'Offensif — retire aussi les atténuateurs de rôle',
};

export const IMPACT_TONE_CAVEATS_FR: Record<ImpactTone, string> = {
  factual: 'Aucune modification. À privilégier si vous relisez peu.',
  confident: 'Aucune affirmation ne change de sens : ordre et vocabulaire seulement.',
  assertive:
    "« Participé à X » devient « X ». Le fait reste vrai, mais votre part n'est plus précisée : soyez prêt à la décrire en entretien.",
};

export type EditKind =
  'outcome_first' | 'weakener_removed' | 'hedge_removed' | 'term_aligned' | 'tidied';

export interface ImpactEdit {
  kind: EditKind;
  before: string;
  after: string;
  /** Pourquoi cette transformation est défendable, en français. */
  rationale: string;
}

export interface RewrittenBullet {
  original: string;
  text: string;
  edits: ImpactEdit[];
}

export interface ImpactOptions {
  tone?: ImpactTone;
  language?: 'fr' | 'en';
  /**
   * Compétences de l'offre. Sert uniquement à choisir **le libellé** d'une
   * compétence que le candidat possède déjà (« JS » → « JavaScript » si
   * l'offre dit « JavaScript »). Ne peut jamais introduire une compétence :
   * le remplacement n'a lieu que si `isSameSkill` reconnaît les deux termes
   * comme équivalents.
   */
  jobSkills?: readonly string[];
}

/* ------------------------------------------------------------------------ */
/* Vocabulaires                                                              */
/* ------------------------------------------------------------------------ */

/**
 * Marqueurs de résultat. Ce qui les suit est la conséquence obtenue, donc ce
 * qui intéresse le lecteur — et se retrouve pourtant systématiquement en fin
 * de phrase.
 *
 * **Uniquement des formes participiales.** Les tournures relatives (« ce qui
 * a permis de… ») ne se déplacent pas sans être reformulées, et reformuler
 * exigerait d'introduire des mots absents de l'original — précisément ce que
 * l'invariant interdit. Plutôt que d'affaiblir l'invariant pour gagner une
 * permutation, ces tournures sont laissées en place.
 */
const OUTCOME_MARKERS = [
  'permettant de',
  'permettant',
  'réduisant',
  'augmentant',
  'divisant',
  'multipliant',
  'faisant passer',
  'aboutissant à',
  'résultant en',
  'resulting in',
  'leading to',
  'reducing',
  'increasing',
  'enabling',
  'cutting',
  'saving',
  'driving',
];

/**
 * Fins de phrase qui n'ajoutent rien et diluent. Retirées à tous les niveaux
 * au-dessus de `factual` : leur suppression ne change aucune affirmation.
 */
const TRAILING_WEAKENERS = [
  'dans le cadre de mes fonctions',
  'dans le cadre de mon poste',
  'selon les besoins',
  'au besoin',
  'entre autres',
  'notamment',
  'de manière générale',
  'entre autres choses',
  'as needed',
  'when required',
  'among other things',
  'as part of my role',
  'as part of my duties',
  'on an as-needed basis',
];

/**
 * Atténuateurs de rôle — le cœur du niveau `assertive`.
 *
 * Chacun borne explicitement la part du candidat dans ce qui suit. Les
 * retirer ne rend pas la phrase fausse (le candidat a bien travaillé sur la
 * chose), mais lève la borne. C'est le seul endroit du produit où une
 * transformation modifie la portée d'une affirmation, et c'est pour cela
 * qu'il est isolé, nommé, et réservé à un niveau que l'utilisateur choisit.
 */
const ROLE_HEDGES = [
  "participé à l'",
  'participé à la ',
  'participé au ',
  'participé aux ',
  'participé à ',
  'participation à la ',
  'participation au ',
  'participation à ',
  "contribué à l'",
  'contribué à la ',
  'contribué au ',
  'contribué à ',
  "aidé à l'",
  'aidé à ',
  "impliqué dans l'",
  'impliqué dans la ',
  'impliqué dans le ',
  'impliqué dans ',
  "membre de l'équipe qui a ",
  "membre de l'équipe ayant ",
  'assisté à la ',
  'assisté dans ',
  'soutenu la ',
  'helped to ',
  'helped with ',
  'helped ',
  'assisted in ',
  'assisted with ',
  'was involved in ',
  'involved in ',
  'part of the team that ',
  'part of a team that ',
  'contributed to the ',
  'contributed to ',
  'supported the ',
  'worked on the ',
  'worked on ',
];

/**
 * Formules d'intitulé de poste qui décrivent une assignation plutôt qu'un
 * résultat. Retirées au niveau `assertive` : « Responsable de la refonte »
 * dit ce dont on vous a chargé, pas ce que vous avez livré.
 */
const ASSIGNMENT_PREFIXES = [
  'responsable de la ',
  'responsable du ',
  "responsable de l'",
  'responsable des ',
  'responsable de ',
  'chargé de la ',
  'chargée de la ',
  "chargé de l'",
  'chargé de ',
  'chargée de ',
  'en charge de la ',
  "en charge de l'",
  'en charge de ',
  'responsible for the ',
  'responsible for ',
  'tasked with ',
  'duties included ',
  'in charge of the ',
  'in charge of ',
];

/** Connecteurs que la réécriture a le droit d'introduire. Liste fermée. */
const ALLOWED_INJECTED_TOKENS = new Set(['via', 'par']);

/* ------------------------------------------------------------------------ */
/* Transformations                                                           */
/* ------------------------------------------------------------------------ */

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[\s.;,]+$/u, '');
}

function capitalizeFirst(text: string): string {
  const first = text.charAt(0);
  return first ? first.toLocaleUpperCase('fr') + text.slice(1) : text;
}

/**
 * Hisse la conséquence en tête de puce.
 *
 * C'est une permutation pure : les deux moitiés de la phrase sont conservées
 * intégralement, seul leur ordre change. Le gain est réel — un chiffre placé
 * en tête est lu, le même chiffre en fin de troisième ligne ne l'est pas.
 */
function hoistOutcome(text: string): { text: string; edit?: ImpactEdit } {
  const lower = text.toLocaleLowerCase('fr');

  for (const marker of OUTCOME_MARKERS) {
    // On exige une virgule avant le marqueur : sans elle, le marqueur fait
    // partie de la proposition principale et le déplacer casserait la phrase.
    const index = lower.indexOf(`, ${marker} `);
    if (index < 0) continue;

    const action = stripTrailingPunctuation(text.slice(0, index));
    // Le marqueur est conservé, et c'est essentiel : « réduisant les coûts de
    // 30 % » amputé de son verbe devient « les coûts de 30 % », qui n'affirme
    // plus rien. Le résultat est télégraphique — une puce de CV n'est pas une
    // phrase — mais reste une permutation exacte de l'original.
    const outcome = stripTrailingPunctuation(text.slice(index + 2));
    if (!action || !outcome) continue;
    // Une conséquence plus longue que l'action produit une puce à rallonge et
    // déplace le poids au mauvais endroit.
    if (outcome.length > action.length) continue;

    const rewritten = `${capitalizeFirst(outcome)} — ${lowerFirstIfSafe(action)}`;
    return {
      text: rewritten,
      edit: {
        kind: 'outcome_first',
        before: text,
        after: rewritten,
        rationale:
          'Le résultat obtenu passe en tête : c’est ce qu’un recruteur lit en premier. Aucun mot n’est ajouté ni retiré.',
      },
    };
  }

  return { text };
}

/**
 * Minuscule initiale, sauf si le premier mot est manifestement un nom propre
 * ou un sigle : « AWS » ne doit pas devenir « aWS ».
 */
function lowerFirstIfSafe(text: string): string {
  const firstWord = text.split(/\s/u)[0] ?? '';
  if (firstWord.length > 1 && firstWord === firstWord.toLocaleUpperCase('fr')) return text;
  if (/^[A-Z][a-z]+[A-Z]/u.test(firstWord)) return text;
  return text.charAt(0).toLocaleLowerCase('fr') + text.slice(1);
}

function removePhrases(
  text: string,
  phrases: readonly string[],
  kind: EditKind,
  rationale: string,
  { anchored }: { anchored: boolean },
): { text: string; edit?: ImpactEdit } {
  const lower = text.toLocaleLowerCase('fr');

  for (const phrase of phrases) {
    if (anchored) {
      if (!lower.startsWith(phrase)) continue;
      const remainder = text.slice(phrase.length).trimStart();
      if (!remainder) continue;
      const rewritten = capitalizeFirst(remainder);
      return { text: rewritten, edit: { kind, before: text, after: rewritten, rationale } };
    }

    // Non ancré : on ne retire qu'en fin de puce, éventuellement précédé
    // d'une virgule et suivi d'un point final. Retirer au milieu casserait la
    // syntaxe — « notamment » au milieu d'une phrase porte du sens.
    const pattern = new RegExp(`[\\s,]*${escapeRegExp(phrase)}[\\s.;,]*$`, 'iu');
    if (!pattern.test(text)) continue;
    const rewritten = stripTrailingPunctuation(text.replace(pattern, ''));
    if (!rewritten) continue;
    return { text: rewritten, edit: { kind, before: text, after: rewritten, rationale } };
  }

  return { text };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Aligne le libellé d'une compétence sur celui de l'offre.
 *
 * Strictement un changement de mot pour la même chose : le remplacement n'a
 * lieu que si `isSameSkill` reconnaît l'équivalence, ce qui rend impossible
 * l'introduction d'une compétence que le candidat n'a pas. L'intérêt est
 * concret : beaucoup d'ATS filtrent sur la chaîne exacte de l'offre.
 */
function alignTerminology(
  text: string,
  jobSkills: readonly string[],
): { text: string; edits: ImpactEdit[] } {
  const edits: ImpactEdit[] = [];
  let current = text;

  for (const jobSkill of jobSkills) {
    const canonicalJob = canonicalize(jobSkill);
    if (!canonicalJob) continue;
    // Déjà écrit avec le mot de l'offre : rien à faire.
    if (canonicalize(current).includes(canonicalJob)) continue;

    // Même découpage que l'invariant : un point final ne fait pas partie du
    // mot, un point interne si (« Node.js »).
    for (const word of new Set(current.match(TOKEN_PATTERN) ?? [])) {
      if (word.length < 2) continue;
      if (canonicalize(word) === canonicalJob) continue;
      if (!isSameSkill(word, jobSkill)) continue;

      const replaced = current.replace(
        new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'gu'),
        jobSkill,
      );
      if (replaced === current) continue;

      edits.push({
        kind: 'term_aligned',
        before: word,
        after: jobSkill,
        rationale: `« ${word} » et « ${jobSkill} » désignent la même compétence ; l’offre emploie « ${jobSkill} », beaucoup d’ATS filtrent sur la chaîne exacte.`,
      });
      current = replaced;
      break;
    }
  }

  return { text: current, edits };
}

/* ------------------------------------------------------------------------ */
/* Invariant                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Découpage en jetons comparables.
 *
 * Le point délicat est le point : il est signifiant à l'intérieur d'un mot
 * (« Node.js », « .NET ») et purement typographique en fin de phrase. Les
 * confondre rendait « conversion. » et « conversion » différents, et faisait
 * échouer l'invariant sur des permutations parfaitement légitimes.
 */
const TOKEN_PATTERN = /\.?[\p{L}\p{N}+#]+(?:\.[\p{L}\p{N}+#]+)*/gu;

function tokensOf(text: string): string[] {
  return canonicalize(text).match(TOKEN_PATTERN) ?? [];
}

/**
 * Garantie structurelle du module : la réécriture ne peut pas inventer.
 *
 * Tout jeton du texte produit doit provenir du texte d'origine, des libellés
 * de compétences autorisés, ou de la liste fermée de connecteurs. Cette
 * vérification n'est pas un filet de sécurité optionnel : c'est ce qui permet
 * d'affirmer que même le niveau `assertive` ne fabrique aucun fait. Elle
 * s'exécute à chaque réécriture, en production comme en test.
 */
export function assertNoNewFacts(
  original: string,
  rewritten: string,
  allowedTerms: readonly string[] = [],
): string[] {
  const known = new Set(tokensOf(original));
  for (const term of allowedTerms) for (const token of tokensOf(term)) known.add(token);
  for (const token of ALLOWED_INJECTED_TOKENS) known.add(token);

  return [...new Set(tokensOf(rewritten))].filter((token) => !known.has(token));
}

/** Erreur levée si l'invariant est violé : c'est un défaut, pas un cas limite. */
export class ImpactInvariantError extends Error {
  constructor(
    readonly original: string,
    readonly rewritten: string,
    readonly introduced: string[],
  ) {
    super(
      `Réécriture refusée : elle introduit ${introduced.length} terme(s) absent(s) de la puce d'origine — ${introduced.join(', ')}.`,
    );
    this.name = 'ImpactInvariantError';
  }
}

/* ------------------------------------------------------------------------ */
/* Entrée publique                                                           */
/* ------------------------------------------------------------------------ */

export function rewriteBullet(bullet: string, options: ImpactOptions = {}): RewrittenBullet {
  const tone = options.tone ?? 'confident';
  const original = bullet.trim();

  if (tone === 'factual' || !original) {
    return { original: bullet, text: bullet, edits: [] };
  }

  const edits: ImpactEdit[] = [];
  let current = original;

  const weakened = removePhrases(
    current,
    TRAILING_WEAKENERS,
    'weakener_removed',
    'Formule de remplissage retirée : elle n’affirmait rien et diluait la phrase.',
    { anchored: false },
  );
  current = weakened.text;
  if (weakened.edit) edits.push(weakened.edit);

  if (tone === 'assertive') {
    const assignment = removePhrases(
      current,
      ASSIGNMENT_PREFIXES,
      'hedge_removed',
      'La formule décrivait une assignation plutôt qu’un résultat livré ; le contenu de la puce est inchangé.',
      { anchored: true },
    );
    current = assignment.text;
    if (assignment.edit) edits.push(assignment.edit);

    const hedged = removePhrases(
      current,
      ROLE_HEDGES,
      'hedge_removed',
      'Atténuateur de rôle retiré. Le fait reste vrai, mais votre part exacte n’est plus précisée : à savoir défendre en entretien.',
      { anchored: true },
    );
    current = hedged.text;
    if (hedged.edit) edits.push(hedged.edit);
  }

  const hoisted = hoistOutcome(current);
  current = hoisted.text;
  if (hoisted.edit) edits.push(hoisted.edit);

  if (options.jobSkills && options.jobSkills.length > 0) {
    const aligned = alignTerminology(current, options.jobSkills);
    current = aligned.text;
    edits.push(...aligned.edits);
  }

  const tidied = capitalizeFirst(current.replace(/\s{2,}/gu, ' ').trim());
  if (tidied !== current) {
    edits.push({
      kind: 'tidied',
      before: current,
      after: tidied,
      rationale: 'Espacement et majuscule initiale normalisés.',
    });
    current = tidied;
  }

  const introduced = assertNoNewFacts(original, current, options.jobSkills ?? []);
  if (introduced.length > 0) throw new ImpactInvariantError(original, current, introduced);

  return { original: bullet, text: current, edits };
}

export function rewriteBullets(
  bullets: readonly string[],
  options: ImpactOptions = {},
): RewrittenBullet[] {
  return bullets.map((bullet) => rewriteBullet(bullet, options));
}

/**
 * Résumé des transformations, pour affichage avant envoi.
 *
 * L'utilisateur doit pouvoir répondre à « qu'est-ce qui a été changé, et de
 * combien ? » sans lire deux versions côte à côte ligne par ligne.
 */
export function summarizeEdits(rewritten: readonly RewrittenBullet[]): {
  total: number;
  byKind: Record<EditKind, number>;
  /** Transformations qui déplacent la portée d'une affirmation. */
  scopeChanging: ImpactEdit[];
} {
  const byKind: Record<EditKind, number> = {
    outcome_first: 0,
    weakener_removed: 0,
    hedge_removed: 0,
    term_aligned: 0,
    tidied: 0,
  };
  const scopeChanging: ImpactEdit[] = [];

  for (const bullet of rewritten) {
    for (const edit of bullet.edits) {
      byKind[edit.kind] += 1;
      if (edit.kind === 'hedge_removed') scopeChanging.push(edit);
    }
  }

  return {
    total: Object.values(byKind).reduce((sum, count) => sum + count, 0),
    byKind,
    scopeChanging,
  };
}
