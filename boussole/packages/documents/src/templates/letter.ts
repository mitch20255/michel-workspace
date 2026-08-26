import type { CandidateProfile } from '@boussole/core';
import { typstString, typstStringArray } from './typstEscape.js';

/**
 * Gabarit de lettre de motivation.
 *
 * Mêmes contraintes d'extractibilité que le CV : une colonne, pas d'en-tête
 * de page, polices standards.
 *
 * Le contenu des paragraphes est produit en amont (`letter.ts`) à partir du
 * seul profil. Ce gabarit met en page, il n'écrit rien.
 */

export interface LetterTemplateData {
  profile: CandidateProfile;
  companyName: string;
  jobTitle: string;
  /** Nom du destinataire s'il est connu ; jamais inventé. */
  recipientName?: string;
  language: 'fr' | 'en';
  /** Date affichée, au format ISO. */
  date: string;
  paragraphs: string[];
}

const LABELS = {
  fr: {
    subject: 'Objet',
    application: 'Candidature au poste de',
    greetingKnown: (name: string) => `${name},`,
    greetingUnknown: 'Madame, Monsieur,',
    closing: 'Veuillez agréer mes salutations distinguées,',
  },
  en: {
    subject: 'Subject',
    application: 'Application for the position of',
    greetingKnown: (name: string) => `Dear ${name},`,
    greetingUnknown: 'Dear Hiring Manager,',
    closing: 'Sincerely,',
  },
} as const;

function formatDate(iso: string, language: 'fr' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function renderLetterTypst(data: LetterTemplateData): string {
  const { profile, language } = data;
  const labels = LABELS[language];
  const fullName = `${profile.identity.firstName} ${profile.identity.lastName}`;

  const contactParts = [
    profile.contact.email,
    profile.contact.phone,
    profile.contact.publicLocation,
  ].filter((value): value is string => Boolean(value?.trim()));

  // « Madame, Monsieur » quand le destinataire est inconnu : inventer un nom
  // serait une erreur factuelle immédiatement visible par le recruteur.
  const greeting = data.recipientName
    ? labels.greetingKnown(data.recipientName)
    : labels.greetingUnknown;

  return `// Document généré par Boussole. Ne pas modifier à la main.
#set document(title: ${typstString(`${fullName} — ${data.jobTitle}`)}, author: ${typstString(fullName)})
#set page(paper: "us-letter", margin: (x: 2.2cm, y: 2cm))
#set text(font: ("Liberation Sans", "DejaVu Sans", "Arial", "Helvetica"), size: 11pt, lang: ${typstString(language)})
#set par(justify: false, leading: 0.7em, spacing: 1.1em)

#align(left)[
  #text(size: 13pt, weight: "bold", ${typstString(fullName)})
  #linebreak()
  #text(size: 9.5pt, ${typstStringArray(contactParts)}.join(" · "))
]

#v(1.4em)

#align(right)[#text(size: 10pt, ${typstString(formatDate(data.date, language))})]

#v(0.8em)

#text(weight: "bold", ${typstString(data.companyName)})

#v(1em)

#text(weight: "bold", ${typstString(`${labels.subject} : ${labels.application} ${data.jobTitle}`)})

#v(1em)

${typstString(greeting)}

#v(0.6em)

${data.paragraphs.map((paragraph) => `#par(${typstString(paragraph)})`).join('\n\n')}

#v(0.8em)

${typstString(labels.closing)}

#v(1.2em)

${typstString(fullName)}
`;
}
