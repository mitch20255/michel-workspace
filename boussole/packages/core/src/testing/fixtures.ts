import type { CandidateProfile } from '../schemas/profile.js';
import { CandidateProfileSchema } from '../schemas/profile.js';
import type { NormalizedJob, RawJob } from '../schemas/job.js';
import { normalizeJob } from '../jobs/normalize.js';

/**
 * Jeux de données de test.
 *
 * ⚠️ Toutes les personnes et entreprises ici sont **fictives**. Le projet ne
 * versionne jamais de données candidat réelles, y compris dans les tests :
 * un dépôt est copié, forké et indexé.
 */

export function makeProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return CandidateProfileSchema.parse({
    id: 'prof_test',
    label: 'Profil de test',
    locale: 'fr-CA',
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
        bullets: [
          'Conception et livraison d’une plateforme React/Node.js utilisée par 12 000 usagers.',
          'Migration de l’infrastructure vers Docker et Kubernetes sur AWS.',
        ],
        skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
        metrics: ['12 000 usagers', '-35 % de temps de chargement'],
      },
      {
        id: 'exp_2',
        company: 'Coopérative Lumen',
        title: 'Développeuse web',
        startDate: '2017-06',
        endDate: '2021-02',
        bullets: ['Développement d’API REST en Python (Django) pour un portail citoyen.'],
        skills: ['Python', 'Django', 'PostgreSQL'],
        metrics: [],
      },
    ],
    projects: [
      {
        id: 'proj_1',
        name: 'Cartographie ouverte',
        description: 'Outil bénévole de visualisation de données municipales.',
        bullets: ['Traitement ETL de jeux de données ouverts avec pandas.'],
        skills: ['Python', 'pandas'],
        endDate: null,
      },
    ],
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
      { name: 'TypeScript', level: 'expert', yearsOfExperience: 7, category: 'language' },
      { name: 'React', level: 'advanced', yearsOfExperience: 6 },
      { name: 'Node.js', level: 'advanced', yearsOfExperience: 6 },
      { name: 'PostgreSQL', level: 'advanced', yearsOfExperience: 5 },
      { name: 'AWS', level: 'intermediate', yearsOfExperience: 3 },
      { name: 'Docker', level: 'advanced', yearsOfExperience: 4 },
      { name: 'Python', level: 'intermediate', yearsOfExperience: 4 },
    ],
    languages: [
      { language: 'Français', level: 'native' },
      { language: 'Anglais', level: 'C1' },
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
        period: 'year',
        shareWithEmployers: false,
      },
      constraints: [],
    },
    sensitiveAnswers: [
      { key: 'work_authorization', state: 'answered', value: 'Citoyenne canadienne' },
      { key: 'visa_sponsorship_needed', state: 'answered', value: 'Non' },
    ],
    cannedAnswers: [],
    ...overrides,
  });
}

export function makeRawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: 'connector',
    atsProvider: 'greenhouse',
    sourceJobId: 'gh_1001',
    companyName: 'Northwind Technologies Inc.',
    title: 'Senior Full-Stack Developer',
    department: 'Engineering',
    locationRaw: 'Montréal, QC, Canada',
    descriptionRaw: [
      '<p>Nous cherchons une personne pour rejoindre notre équipe produit.</p>',
      '<h3>Responsabilités</h3>',
      '<ul><li>Concevoir et livrer des fonctionnalités en React et Node.js.</li>',
      '<li>Collaborer avec les équipes produit et design.</li></ul>',
      '<h3>Exigences</h3>',
      '<ul><li>5 ans d’expérience en développement web avec TypeScript.</li>',
      '<li>Maîtrise de PostgreSQL et des API REST.</li>',
      '<li>Expérience avec Docker et AWS.</li></ul>',
      '<h3>Avantages</h3>',
      '<ul><li>Assurance collective et REER.</li><li>Mode hybride, 2 jours au bureau.</li></ul>',
      '<p>Salaire : 110 000 $ à 135 000 $ CAD par an.</p>',
    ].join(''),
    applyUrl: 'https://boards.exemple-fictif.test/northwind/jobs/1001',
    ...overrides,
  };
}

export function makeJob(
  overrides: Partial<RawJob> = {},
  now = new Date('2026-03-01T12:00:00.000Z'),
): NormalizedJob {
  return normalizeJob(makeRawJob(overrides), { now });
}
