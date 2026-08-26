import type { CandidateProfile } from '@boussole/core';
import type { ScoredExperience, ScoredProject } from '../selection.js';
import { typstString, typstStringArray } from './typstEscape.js';

/**
 * Gabarit de CV, optimisé pour l'analyse automatique par les ATS.
 *
 * Chaque décision de mise en page découle de la façon dont un ATS lit un PDF :
 *
 *  - **Une seule colonne.** Une mise en page à deux colonnes est extraite dans
 *    le désordre : les intitulés se mélangent aux dates. C'est la première
 *    cause de CV illisibles par les ATS.
 *  - **Aucun tableau de mise en page.** Certains extracteurs sérialisent les
 *    cellules ligne par ligne, d'autres colonne par colonne.
 *  - **Pas d'en-tête ni de pied de page.** De nombreux extracteurs les
 *    ignorent : les coordonnées y disparaîtraient purement et simplement.
 *  - **Aucune icône ni glyphe décoratif** pour le téléphone ou le courriel :
 *    ils ressortent en caractères parasites dans le texte extrait.
 *  - **Libellés de section en toutes lettres** (« Expérience professionnelle »
 *    et non « Parcours ») : les ATS les reconnaissent par correspondance.
 *  - **Polices standards** avec repli explicite ; une police absente ferait
 *    échouer la compilation ou produirait des caractères manquants.
 *
 * Le texte lui-même vient intégralement du profil : ce gabarit met en page,
 * il n'écrit rien.
 */

export interface CvTemplateData {
  profile: CandidateProfile;
  experiences: ScoredExperience[];
  projects: ScoredProject[];
  skills: string[];
  language: 'fr' | 'en';
  /** Intitulé visé, affiché sous le nom. Toujours celui de l'offre. */
  targetTitle?: string;
  summary?: string;
}

const LABELS = {
  fr: {
    experience: 'Expérience professionnelle',
    projects: 'Projets',
    education: 'Formation',
    certifications: 'Certifications',
    skills: 'Compétences',
    languages: 'Langues',
    links: 'Liens',
    summary: 'Profil',
    present: 'aujourd’hui',
  },
  en: {
    experience: 'Professional Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
    languages: 'Languages',
    links: 'Links',
    summary: 'Summary',
    present: 'present',
  },
} as const;

const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juill.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/** « 2021-03 » → « mars 2021 ». Format textuel, lisible par un extracteur. */
export function formatMonth(value: string | null, language: 'fr' | 'en'): string {
  if (!value) return LABELS[language].present;
  const [year, month] = value.split('-');
  const monthIndex = Number.parseInt(month ?? '', 10) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value;

  if (language === 'en') {
    const date = new Date(Date.UTC(Number.parseInt(year, 10), monthIndex, 1));
    return `${date.toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' })} ${year}`;
  }
  return `${MONTHS_FR[monthIndex]} ${year}`;
}

export function renderCvTypst(data: CvTemplateData): string {
  const { profile, experiences, projects, skills, language } = data;
  const labels = LABELS[language];

  const fullName = `${profile.identity.firstName} ${profile.identity.lastName}`;

  // Ligne de contact : séparateur textuel simple, sans icône.
  const contactParts = [
    profile.contact.email,
    profile.contact.phone,
    profile.contact.publicLocation,
    ...profile.links.map((link) => link.url),
  ].filter((value): value is string => Boolean(value?.trim()));

  const sections: string[] = [];

  if (data.summary?.trim()) {
    sections.push(`#section(${typstString(labels.summary)})
#par(${typstString(data.summary.trim())})
`);
  }

  if (experiences.length > 0) {
    const entries = experiences
      .map(({ experience, bullets }) => {
        const period = `${formatMonth(experience.startDate, language)} – ${formatMonth(
          experience.endDate,
          language,
        )}`;
        return `#entry(
  title: ${typstString(experience.title)},
  organisation: ${typstString(experience.company)},
  period: ${typstString(period)},
  place: ${typstString(experience.location ?? '')},
  bullets: ${typstStringArray(bullets)},
)`;
      })
      .join('\n');

    sections.push(`#section(${typstString(labels.experience)})\n${entries}\n`);
  }

  if (projects.length > 0) {
    const entries = projects
      .map(({ project, bullets }) => {
        const period =
          project.startDate || project.endDate
            ? `${formatMonth(project.startDate ?? null, language)} – ${formatMonth(
                project.endDate ?? null,
                language,
              )}`
            : '';
        return `#entry(
  title: ${typstString(project.name)},
  organisation: ${typstString(project.role ?? '')},
  period: ${typstString(period)},
  place: ${typstString('')},
  bullets: ${typstStringArray(bullets)},
)`;
      })
      .join('\n');

    sections.push(`#section(${typstString(labels.projects)})\n${entries}\n`);
  }

  if (profile.education.length > 0) {
    const entries = profile.education
      .map((education) => {
        const period =
          education.startDate || education.endDate
            ? `${formatMonth(education.startDate ?? null, language)} – ${formatMonth(
                education.endDate ?? null,
                language,
              )}`
            : '';
        // Un programme non terminé est signalé, jamais présenté comme obtenu.
        const degree = education.completed
          ? education.degree
          : `${education.degree} (${language === 'fr' ? 'non complété' : 'not completed'})`;
        return `#entry(
  title: ${typstString(degree)},
  organisation: ${typstString(education.institution)},
  period: ${typstString(period)},
  place: ${typstString(education.field ?? '')},
  bullets: (),
)`;
      })
      .join('\n');

    sections.push(`#section(${typstString(labels.education)})\n${entries}\n`);
  }

  if (profile.certifications.length > 0) {
    const items = profile.certifications.map((certification) =>
      [certification.name, certification.issuer, certification.issuedAt]
        .filter(Boolean)
        .join(' — '),
    );
    sections.push(`#section(${typstString(labels.certifications)})
#inline-list(${typstStringArray(items)})
`);
  }

  if (skills.length > 0) {
    sections.push(`#section(${typstString(labels.skills)})
#inline-list(${typstStringArray(skills)})
`);
  }

  if (profile.languages.length > 0) {
    const items = profile.languages.map((entry) => `${entry.language} (${entry.level})`);
    sections.push(`#section(${typstString(labels.languages)})
#inline-list(${typstStringArray(items)})
`);
  }

  return `// Document généré par Boussole. Ne pas modifier à la main :
// toute retouche serait perdue à la prochaine génération.
#set document(title: ${typstString(`${fullName} — ${data.targetTitle ?? 'CV'}`)}, author: ${typstString(fullName)})

// Une seule colonne, marges généreuses : un ATS extrait le texte dans
// l'ordre de lecture, ce que toute mise en page multicolonne détruit.
#set page(paper: "us-letter", margin: (x: 1.8cm, y: 1.6cm))

// Polices largement disponibles, avec repli explicite. Une police absente
// produirait des caractères manquants dans le PDF.
#set text(font: ("Liberation Sans", "DejaVu Sans", "Arial", "Helvetica"), size: 10pt, lang: ${typstString(language)})
#set par(justify: false, leading: 0.62em)

// Pas d'en-tête ni de pied de page : de nombreux extracteurs les ignorent,
// et les coordonnées y disparaîtraient.

#let section(title) = {
  v(0.5em)
  // Titre en toutes lettres : les ATS reconnaissent les sections par
  // correspondance de libellé.
  text(size: 11pt, weight: "bold", upper(title))
  v(0.15em)
  line(length: 100%, stroke: 0.5pt + rgb("#999999"))
  v(0.35em)
}

#let entry(title: "", organisation: "", period: "", place: "", bullets: ()) = {
  block(breakable: false, width: 100%)[
    #text(weight: "bold", size: 10.5pt, title)
    #if organisation != "" [ #h(0.3em) — #h(0.3em) #organisation ]
    #if period != "" [ \\ #text(size: 9pt, style: "italic", period + if place != "" { " · " + place } else { "" }) ]
    #if bullets.len() > 0 [
      #v(0.2em)
      // Liste native plutôt que tirets manuels : le PDF porte alors une
      // vraie structure de liste, mieux comprise à l'extraction.
      #list(indent: 0.6em, spacing: 0.45em, ..bullets)
    ]
  ]
  v(0.45em)
}

#let inline-list(items) = {
  // Séparateur « · » plutôt qu'un tableau : un tableau serait sérialisé dans
  // un ordre imprévisible par certains extracteurs.
  par(items.join(" · "))
  v(0.3em)
}

// --- En-tête du document (dans le flux, pas dans le page header) ---
#align(left)[
  #text(size: 17pt, weight: "bold", ${typstString(fullName)})
  ${
    data.targetTitle
      ? `\n  #linebreak()\n  #text(size: 11pt, ${typstString(data.targetTitle)})`
      : profile.identity.headline
        ? `\n  #linebreak()\n  #text(size: 11pt, ${typstString(profile.identity.headline)})`
        : ''
  }
  #linebreak()
  #text(size: 9.5pt, ${typstStringArray(contactParts)}.join(" · "))
]

#v(0.6em)

${sections.join('\n')}
`;
}
