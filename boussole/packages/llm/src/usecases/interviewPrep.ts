import type { CandidateProfile, KeywordGapReport, NormalizedJob } from '@boussole/core';
import { minimizeJobForLlm, minimizeProfileForLlm, truncate } from '@boussole/core';
import type { LlmGateway } from '../gateway.js';

/**
 * Préparation d'entretien.
 *
 * **Le module fonctionne intégralement sans modèle de langage.** La version
 * déterministe dérive les questions des exigences réelles de l'offre et des
 * écarts réels du profil ; elle est gratuite, instantanée, reproductible et
 * ne transmet rien à personne.
 *
 * Le modèle, quand il est activé, ne fait qu'*enrichir* ce socle. Ce n'est
 * pas une nuance d'implémentation : cela signifie qu'un utilisateur sans clé
 * API — ou qui refuse d'envoyer ses données — dispose quand même de la
 * fonctionnalité, au lieu d'un bouton grisé.
 */

export interface InterviewQuestion {
  question: string;
  /** D'où vient la question : exigence de l'offre, écart, parcours… */
  origin: 'requirement' | 'gap' | 'experience' | 'company' | 'logistics';
  /** Pourquoi elle risque d'être posée. */
  rationale: string;
  /** Points à couvrir dans la réponse. Jamais une réponse toute faite. */
  talkingPoints: string[];
}

export interface InterviewPrep {
  questions: InterviewQuestion[];
  /** Questions à poser au recruteur. */
  questionsToAsk: string[];
  /** Points de vigilance identifiés à partir de l'offre et du profil. */
  risks: string[];
  checklist: string[];
  /** Vrai si un modèle de langage a enrichi le résultat. */
  enhancedByLlm: boolean;
  /** Renseigné quand le socle déterministe est seul utilisé. */
  llmUnavailableReason?: string;
}

/** Trame STAR, rappelée à l'utilisateur mais jamais remplie à sa place. */
export const STAR_FRAMEWORK = [
  'Situation — le contexte, en une phrase.',
  'Tâche — ce dont vous étiez responsable.',
  'Action — ce que vous avez fait, vous, concrètement.',
  'Résultat — l’effet mesurable, avec un chiffre si vous en avez un.',
] as const;

/**
 * Socle déterministe : construit la préparation à partir des seules données
 * de l'offre et du profil.
 */
export function buildDeterministicPrep(
  job: NormalizedJob,
  profile: CandidateProfile,
  keywordGap?: KeywordGapReport,
): InterviewPrep {
  const questions: InterviewQuestion[] = [];

  // 1. Une question par exigence explicite : ce sont les plus probables.
  for (const requirement of job.sections.requirements.slice(0, 6)) {
    questions.push({
      question: `Parlez-moi d'une situation où vous avez mis en pratique : « ${truncate(requirement, 120)} ».`,
      origin: 'requirement',
      rationale: "Exigence explicitement listée dans l'offre.",
      talkingPoints: [...STAR_FRAMEWORK],
    });
  }

  // 2. Les écarts réels : mieux vaut les préparer que les découvrir en direct.
  for (const gap of keywordGap?.realGaps.filter((item) => item.required).slice(0, 4) ?? []) {
    questions.push({
      question: `Quelle est votre expérience avec ${gap.keyword} ?`,
      origin: 'gap',
      rationale:
        "Exigence de l'offre que votre profil ne couvre pas. Préparer une réponse honnête vaut mieux que d'improviser.",
      talkingPoints: [
        `Dire clairement ce que vous connaissez de ${gap.keyword}, sans exagérer.`,
        'Citer la compétence la plus proche que vous maîtrisez réellement.',
        'Donner un exemple concret de montée en compétence rapide sur un autre sujet.',
      ],
    });
  }

  // 3. Parcours : transitions et poste le plus récent.
  const sorted = [...profile.experiences].sort((a, b) =>
    (b.endDate ?? '9999-99').localeCompare(a.endDate ?? '9999-99'),
  );
  const mostRecent = sorted[0];
  if (mostRecent) {
    questions.push({
      question: `Qu'est-ce qui vous amène à quitter votre poste de ${mostRecent.title} ?`,
      origin: 'experience',
      rationale: 'Question quasi systématique sur le poste actuel ou le plus récent.',
      talkingPoints: [
        'Rester factuel et tourné vers ce que vous cherchez, pas contre ce que vous quittez.',
        `Relier au poste visé : ${job.title}.`,
      ],
    });
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const previous = sorted[index + 1];
    if (!current || !previous) continue;
    const gapMonths = monthsBetween(previous.endDate, current.startDate);
    // Six mois : seuil au-delà duquel un recruteur pose systématiquement la
    // question. En deçà, c'est du bruit.
    if (gapMonths !== undefined && gapMonths > 6) {
      questions.push({
        question: `Que faisiez-vous entre ${previous.endDate} et ${current.startDate} ?`,
        origin: 'experience',
        rationale: `Interruption de ${gapMonths} mois visible sur votre CV.`,
        talkingPoints: [
          'Répondre brièvement et sans justification excessive.',
          'Mentionner ce que vous en avez tiré, si c’est le cas.',
        ],
      });
    }
  }

  // 4. Logistique : le mode de travail et la rémunération arrivent presque
  // toujours, souvent dès le premier appel.
  if (job.remotePolicy !== 'unknown') {
    questions.push({
      question: `Le poste est en mode « ${job.remotePolicy} ». Cela vous convient-il ?`,
      origin: 'logistics',
      rationale: "Mode de travail précisé dans l'offre.",
      talkingPoints: ['Répondre selon vos contraintes réelles, pas selon ce qui plaira.'],
    });
  }

  questions.push({
    question: 'Quelles sont vos attentes salariales ?',
    origin: 'logistics',
    rationale: 'Question quasi systématique, souvent dès le premier appel.',
    talkingPoints: [
      profile.preferences.salaryExpectation
        ? 'Vos prétentions sont enregistrées dans votre profil ; les énoncer comme une fourchette.'
        : "Vos prétentions ne sont pas définies dans votre profil : les fixer avant l'entretien.",
      job.salary?.min
        ? "L'offre publie une fourchette : s'y référer plutôt que d'avancer un chiffre à l'aveugle."
        : "L'offre ne publie pas de fourchette : demander la leur avant d'annoncer la vôtre.",
    ],
  });

  // 5. Questions à poser au recruteur, dérivées de ce que l'offre ne dit pas.
  const questionsToAsk: string[] = [
    `À quoi ressemble une semaine type pour la personne qui occupe ce poste ?`,
    'Comment mesurez-vous la réussite dans ce rôle après six mois ?',
    "Quelle est la composition de l'équipe et à qui le poste rapporte-t-il ?",
  ];
  if (!job.salary?.min) {
    questionsToAsk.push('Quelle est la fourchette salariale prévue pour ce poste ?');
  }
  if (job.remotePolicy === 'unknown') {
    questionsToAsk.push('Quelle est votre politique de télétravail pour ce poste ?');
  }
  if (job.sections.responsibilities.length === 0) {
    questionsToAsk.push(
      "L'annonce reste générale sur les responsabilités : quelles seraient les priorités des trois premiers mois ?",
    );
  }

  // 6. Points de vigilance : signaux déjà calculés, présentés comme tels.
  const risks: string[] = [];
  if (job.ghostScore >= 55) {
    risks.push(
      `Plusieurs signaux d'offre fantôme (${job.ghostScore}/100) : demander depuis quand le poste est ouvert et combien de personnes ont été rencontrées.`,
    );
  }
  const missingRequired = keywordGap?.realGaps.filter((gap) => gap.required) ?? [];
  if (missingRequired.length > 0) {
    risks.push(
      `Exigences non couvertes par votre profil : ${missingRequired
        .map((gap) => gap.keyword)
        .slice(0, 5)
        .join(', ')}. Préparer une réponse honnête pour chacune.`,
    );
  }
  if (job.seniority !== 'unknown' && profile.preferences.seniorityTargets.length > 0) {
    if (!profile.preferences.seniorityTargets.includes(job.seniority)) {
      risks.push(
        `Le niveau du poste (${job.seniority}) diffère de votre cible : anticiper une question sur ce décalage.`,
      );
    }
  }
  if (job.language === 'en' && profile.locale.startsWith('fr')) {
    risks.push(
      "L'annonce est en anglais : l'entretien le sera probablement aussi, au moins en partie.",
    );
  }

  const checklist = [
    `Relire l'annonce de ${job.title} chez ${job.companyName}.`,
    'Relire la version du CV effectivement envoyée pour cette candidature.',
    'Préparer deux exemples STAR solides, réutilisables sur plusieurs questions.',
    'Vérifier le lien de visioconférence ou l’adresse, et le nom des personnes rencontrées.',
    'Préparer vos questions au recruteur.',
    'Définir votre fourchette salariale avant l’appel, pas pendant.',
  ];

  return { questions, questionsToAsk, risks, checklist, enhancedByLlm: false };
}

/**
 * Enrichit le socle déterministe avec un modèle, si — et seulement si — un
 * fournisseur est actif et consenti.
 *
 * En cas d'indisponibilité ou d'échec, le socle est retourné avec la raison.
 * Un échec de modèle ne doit jamais priver l'utilisateur de sa préparation.
 */
export async function buildInterviewPrep(
  job: NormalizedJob,
  profile: CandidateProfile,
  gateway: LlmGateway,
  keywordGap?: KeywordGapReport,
): Promise<InterviewPrep> {
  const base = buildDeterministicPrep(job, profile, keywordGap);

  if (!gateway.isEnabled()) {
    return { ...base, llmUnavailableReason: gateway.unavailableReason() };
  }

  // Le modèle ne reçoit que des données minimisées : ni nom, ni courriel, ni
  // téléphone, ni réponse sensible. Voir security/minimize.ts.
  const minimizedJob = minimizeJobForLlm(job, 4000);
  const minimizedProfile = minimizeProfileForLlm(profile, { maxExperiences: 4 });

  const system = [
    "Tu aides une personne à préparer un entretien d'embauche.",
    'Réponds en français, de façon concise et concrète.',
    "N'invente aucune expérience, aucun diplôme et aucun chiffre : appuie-toi uniquement sur les éléments fournis.",
    'Produis exactement cinq questions supplémentaires, différentes de celles déjà préparées.',
    'Format : une question par ligne, préfixée par « Q: », suivie d’une ligne « Pourquoi: ».',
  ].join('\n');

  const alreadyPrepared = base.questions.map((question) => `- ${question.question}`).join('\n');

  const userContent = [
    '### Offre\n' + JSON.stringify(minimizedJob),
    '\n### Profil (pseudonymisé)\n' + JSON.stringify(minimizedProfile),
    '\n### Questions déjà préparées\n' + alreadyPrepared,
  ].join('\n');

  try {
    const response = await gateway.complete({
      purpose: 'interview_questions',
      system,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 2000,
    });

    const extra = parseQuestions(response.text);
    if (extra.length === 0) {
      return {
        ...base,
        llmUnavailableReason: 'Le modèle n’a produit aucune question exploitable.',
      };
    }

    return { ...base, questions: [...base.questions, ...extra], enhancedByLlm: true };
  } catch (error) {
    return {
      ...base,
      llmUnavailableReason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Analyse la réponse du modèle. Tolérante : une ligne mal formée est ignorée. */
function parseQuestions(text: string): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];
  const lines = text.split('\n').map((line) => line.trim());

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const match = /^Q\s*:\s*(.+)$/i.exec(line);
    if (!match?.[1]) continue;

    const rationaleLine = lines[index + 1] ?? '';
    const rationaleMatch = /^Pourquoi\s*:\s*(.+)$/i.exec(rationaleLine);

    questions.push({
      question: match[1].trim(),
      origin: 'company',
      rationale: rationaleMatch?.[1]?.trim() ?? 'Question suggérée par le modèle.',
      talkingPoints: [...STAR_FRAMEWORK],
    });
  }

  return questions;
}

/** Écart en mois entre deux dates AAAA-MM. `undefined` si l'une manque. */
function monthsBetween(from: string | null, to: string): number | undefined {
  if (!from) return undefined;
  const [fromYear, fromMonth] = from.split('-').map((part) => Number.parseInt(part, 10));
  const [toYear, toMonth] = to.split('-').map((part) => Number.parseInt(part, 10));
  if (!fromYear || !fromMonth || !toYear || !toMonth) return undefined;
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}
