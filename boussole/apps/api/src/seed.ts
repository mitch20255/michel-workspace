import { prisma } from '@boussole/db';
import { loadConfig } from './config.js';
import { createContext } from './context.js';
import { createOrUpdateProfile } from './services/profiles.js';
import { ingestManualJob } from './services/ingestion.js';
import { scoreAll } from './services/scoring.js';

/**
 * Jeu de démonstration.
 *
 * ⚠️ Toutes les données sont **fictives**. Le dépôt ne contient jamais de
 * données candidat réelles, y compris dans les scripts d'amorçage : un dépôt
 * est copié, forké et indexé.
 *
 * Objectif : permettre de voir l'application fonctionner immédiatement après
 * l'installation, sans avoir à saisir un profil complet ni à configurer un
 * connecteur.
 */

const DEMO_PROFILE = {
  id: 'demo',
  label: 'Profil de démonstration',
  locale: 'fr-CA' as const,
  identity: {
    firstName: 'Camille',
    lastName: 'Tremblay-Fictif',
    headline: 'Développeuse full-stack',
    summary: 'Huit ans en développement web, spécialisée en TypeScript et infonuagique.',
  },
  contact: {
    email: 'camille@exemple-fictif.test',
    phone: '514-555-0142',
    publicLocation: 'Montréal, QC',
  },
  location: { city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' },
  experiences: [
    {
      id: 'exp_1',
      company: 'Studio Boréal',
      title: 'Développeuse senior',
      startDate: '2021-03',
      endDate: null,
      // Puces volontairement écrites comme la plupart des gens les écrivent :
      // le résultat rejeté en fin de phrase, la part personnelle bornée par un
      // verbe d'excuse. C'est le matériau que le cadran d'impact travaille.
      bullets: [
        'Conception et livraison d’une plateforme React/Node.js utilisée par 12 000 usagers.',
        'Migration de l’infrastructure vers Docker et Kubernetes sur AWS, réduisant les coûts d’hébergement.',
        'Encadrement de 3 développeuses et développeurs juniors, dans le cadre de mes fonctions.',
      ],
      skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
      metrics: ['12 000 usagers', '3 personnes encadrées'],
    },
    {
      id: 'exp_2',
      company: 'Coopérative Lumen',
      title: 'Développeuse web',
      startDate: '2017-06',
      endDate: '2021-02',
      bullets: [
        'Participé au développement d’API REST en Python (Django) pour un portail citoyen.',
        'Responsable de la migration de la base vers PostgreSQL.',
      ],
      skills: ['Python', 'Django', 'PostgreSQL'],
      metrics: [],
    },
  ],
  projects: [],
  education: [
    {
      id: 'edu_1',
      institution: 'Université fictive de Montréal',
      degree: 'Baccalauréat en informatique',
      field: 'Génie logiciel',
      startDate: '2013-09',
      endDate: '2017-05',
      completed: true,
    },
  ],
  certifications: [],
  skills: [
    { name: 'TypeScript', level: 'expert' as const, yearsOfExperience: 7 },
    { name: 'React', level: 'advanced' as const, yearsOfExperience: 6 },
    { name: 'Node.js', level: 'advanced' as const, yearsOfExperience: 6 },
    { name: 'PostgreSQL', level: 'advanced' as const, yearsOfExperience: 5 },
    { name: 'AWS', level: 'intermediate' as const, yearsOfExperience: 3 },
    { name: 'Docker', level: 'advanced' as const, yearsOfExperience: 4 },
  ],
  languages: [
    { language: 'Français', level: 'native' as const },
    { language: 'Anglais', level: 'C1' as const },
  ],
  links: [{ label: 'Portfolio', url: 'https://exemple-fictif.test' }],
  preferences: {
    targetTitles: ['Développeuse senior', 'Développeur full-stack senior'],
    excludedTitles: ['Stagiaire'],
    targetIndustries: ['technologie'],
    excludedCompanies: [],
    remotePolicies: ['remote', 'hybrid'],
    locations: [{ city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' }],
    willingToRelocate: false,
    seniorityTargets: ['senior'],
    employmentTypes: ['full_time'],
    salaryExpectation: {
      min: 105000,
      currency: 'CAD',
      period: 'year' as const,
      shareWithEmployers: false,
    },
    constraints: [],
  },
  sensitiveAnswers: [],
  cannedAnswers: [],
};

const DEMO_JOBS = [
  {
    atsProvider: 'manual' as const,
    sourceJobId: 'demo-1',
    companyName: 'Northwind Technologies Inc.',
    title: 'Senior Full-Stack Developer',
    department: 'Engineering',
    locationRaw: 'Montréal, QC, Canada',
    descriptionRaw:
      '<p>Nous cherchons une personne pour rejoindre notre équipe produit.</p>' +
      '<h3>Responsabilités</h3><ul><li>Concevoir et livrer des fonctionnalités en React et Node.js.</li></ul>' +
      '<h3>Exigences</h3><ul><li>5 ans d’expérience avec TypeScript.</li>' +
      '<li>Maîtrise de PostgreSQL et des API REST.</li><li>Expérience avec Docker et AWS.</li></ul>' +
      '<h3>Avantages</h3><ul><li>Mode hybride, 2 jours au bureau.</li></ul>' +
      '<p>Salaire : 110 000 $ à 135 000 $ CAD par an.</p>',
    applyUrl: 'https://exemple-fictif.test/northwind/1',
  },
  {
    atsProvider: 'manual' as const,
    sourceJobId: 'demo-2',
    companyName: 'Coopérative Vent du Nord',
    title: 'Développeur back-end (H/F)',
    department: 'Technologie',
    locationRaw: 'Québec, QC',
    descriptionRaw:
      '<h3>Exigences</h3><ul><li>Expérience en Java et Kubernetes.</li>' +
      '<li>Connaissance de Terraform.</li></ul><p>Poste 100 % en présentiel.</p>',
    applyUrl: 'https://exemple-fictif.test/vent-du-nord/2',
  },
  {
    atsProvider: 'manual' as const,
    sourceJobId: 'demo-3',
    companyName: 'Groupe Horizon',
    title: 'Développeur',
    locationRaw: 'Montréal, QC',
    descriptionRaw:
      '<p>Nous sommes toujours à la recherche de talents pour notre banque de candidatures. ' +
      'Environnement dynamique, salaire compétitif.</p>',
  },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const context = await createContext(config, prisma);

  console.log('Création du profil de démonstration…');
  const profile = await createOrUpdateProfile(context, DEMO_PROFILE);

  console.log('Ajout des offres de démonstration…');
  for (const job of DEMO_JOBS) {
    await ingestManualJob(context, job);
  }

  console.log('Calcul des scores…');
  const scores = await scoreAll(context, profile);

  console.log('\nRésultats :');
  for (const score of scores) {
    console.log(`  ${String(score.score).padStart(3)}/100  ${score.decision}`);
    console.log(`         ${score.summary}`);
  }

  console.log('\nJeu de démonstration prêt. Toutes les données sont fictives.');
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
