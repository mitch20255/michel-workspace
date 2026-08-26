/**
 * Taxonomie de compétences.
 *
 * Volontairement curatée plutôt qu'exhaustive : une liste énorme génère des
 * faux positifs (« go », « r », « rust » comme mots courants) qui dégradent
 * le scoring. Chaque entrée porte ses alias, y compris les formes
 * francophones, car le marché visé publie dans les deux langues.
 *
 * `requiresWordBoundary` marque les termes ambigus qui ne doivent être
 * reconnus qu'en tant que mot entier.
 */

export interface SkillDefinition {
  /** Forme canonique affichée à l'utilisateur. */
  canonical: string;
  /** Variantes rencontrées dans les offres et les CV. */
  aliases: string[];
  category: SkillCategory;
  /** Termes trop courts ou homographes d'un mot courant. */
  ambiguous?: boolean;
}

export type SkillCategory =
  | 'language'
  | 'framework'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'data'
  | 'design'
  | 'management'
  | 'business'
  | 'tooling'
  | 'soft';

export const SKILL_TAXONOMY: SkillDefinition[] = [
  // --- Langages ---------------------------------------------------------
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], category: 'language' },
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript'], category: 'language' },
  { canonical: 'Python', aliases: ['python', 'python3'], category: 'language' },
  { canonical: 'Java', aliases: ['java'], category: 'language' },
  { canonical: 'C#', aliases: ['c#', 'csharp', 'c sharp', 'dotnet', '.net'], category: 'language' },
  { canonical: 'C++', aliases: ['c++', 'cpp'], category: 'language' },
  { canonical: 'Go', aliases: ['golang', 'go'], category: 'language', ambiguous: true },
  { canonical: 'Rust', aliases: ['rust'], category: 'language', ambiguous: true },
  { canonical: 'PHP', aliases: ['php'], category: 'language' },
  { canonical: 'Ruby', aliases: ['ruby'], category: 'language', ambiguous: true },
  { canonical: 'Swift', aliases: ['swift'], category: 'language', ambiguous: true },
  { canonical: 'Kotlin', aliases: ['kotlin'], category: 'language' },
  { canonical: 'Scala', aliases: ['scala'], category: 'language' },
  { canonical: 'R', aliases: ['r'], category: 'language', ambiguous: true },
  { canonical: 'SQL', aliases: ['sql'], category: 'language' },
  { canonical: 'Bash', aliases: ['bash', 'shell', 'shell scripting'], category: 'language' },

  // --- Cadriciels -------------------------------------------------------
  { canonical: 'React', aliases: ['react', 'react.js', 'reactjs'], category: 'framework' },
  { canonical: 'Next.js', aliases: ['next.js', 'nextjs', 'next js'], category: 'framework' },
  { canonical: 'Vue.js', aliases: ['vue', 'vue.js', 'vuejs'], category: 'framework' },
  { canonical: 'Angular', aliases: ['angular', 'angularjs'], category: 'framework' },
  { canonical: 'Svelte', aliases: ['svelte', 'sveltekit'], category: 'framework' },
  { canonical: 'Node.js', aliases: ['node', 'node.js', 'nodejs'], category: 'framework' },
  { canonical: 'Express', aliases: ['express', 'express.js'], category: 'framework' },
  { canonical: 'NestJS', aliases: ['nestjs', 'nest.js'], category: 'framework' },
  { canonical: 'FastAPI', aliases: ['fastapi'], category: 'framework' },
  { canonical: 'Django', aliases: ['django'], category: 'framework' },
  { canonical: 'Flask', aliases: ['flask'], category: 'framework' },
  { canonical: 'Spring', aliases: ['spring', 'spring boot', 'springboot'], category: 'framework' },
  { canonical: 'Rails', aliases: ['rails', 'ruby on rails'], category: 'framework' },
  { canonical: 'Laravel', aliases: ['laravel'], category: 'framework' },
  { canonical: '.NET', aliases: ['.net', 'asp.net', 'dotnet core'], category: 'framework' },
  { canonical: 'React Native', aliases: ['react native'], category: 'framework' },
  { canonical: 'Flutter', aliases: ['flutter'], category: 'framework' },

  // --- Bases de données -------------------------------------------------
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql'], category: 'database' },
  { canonical: 'MySQL', aliases: ['mysql', 'mariadb'], category: 'database' },
  { canonical: 'MongoDB', aliases: ['mongodb', 'mongo'], category: 'database' },
  { canonical: 'Redis', aliases: ['redis'], category: 'database' },
  { canonical: 'Elasticsearch', aliases: ['elasticsearch', 'opensearch'], category: 'database' },
  {
    canonical: 'SQL Server',
    aliases: ['sql server', 'mssql', 't-sql', 'tsql'],
    category: 'database',
  },
  { canonical: 'Oracle', aliases: ['oracle', 'pl/sql', 'plsql'], category: 'database' },
  { canonical: 'DynamoDB', aliases: ['dynamodb'], category: 'database' },
  { canonical: 'Snowflake', aliases: ['snowflake'], category: 'database' },
  { canonical: 'BigQuery', aliases: ['bigquery', 'big query'], category: 'database' },

  // --- Infonuagique -----------------------------------------------------
  { canonical: 'AWS', aliases: ['aws', 'amazon web services'], category: 'cloud' },
  { canonical: 'Azure', aliases: ['azure', 'microsoft azure'], category: 'cloud' },
  {
    canonical: 'Google Cloud',
    aliases: ['gcp', 'google cloud', 'google cloud platform'],
    category: 'cloud',
  },
  { canonical: 'Vercel', aliases: ['vercel'], category: 'cloud' },
  { canonical: 'Cloudflare', aliases: ['cloudflare'], category: 'cloud' },

  // --- DevOps -----------------------------------------------------------
  {
    canonical: 'Docker',
    aliases: ['docker', 'conteneurisation', 'containerization'],
    category: 'devops',
  },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s'], category: 'devops' },
  { canonical: 'Terraform', aliases: ['terraform'], category: 'devops' },
  {
    canonical: 'CI/CD',
    aliases: ['ci/cd', 'cicd', 'integration continue', 'continuous integration'],
    category: 'devops',
  },
  { canonical: 'GitHub Actions', aliases: ['github actions'], category: 'devops' },
  { canonical: 'GitLab CI', aliases: ['gitlab ci', 'gitlab-ci'], category: 'devops' },
  { canonical: 'Jenkins', aliases: ['jenkins'], category: 'devops' },
  { canonical: 'Ansible', aliases: ['ansible'], category: 'devops' },
  { canonical: 'Linux', aliases: ['linux', 'ubuntu', 'debian', 'rhel'], category: 'devops' },
  { canonical: 'Git', aliases: ['git', 'github', 'gitlab', 'bitbucket'], category: 'tooling' },

  // --- Données et IA ----------------------------------------------------
  {
    canonical: 'Machine Learning',
    aliases: ['machine learning', 'ml', 'apprentissage automatique'],
    category: 'data',
  },
  {
    canonical: 'Deep Learning',
    aliases: ['deep learning', 'apprentissage profond'],
    category: 'data',
  },
  {
    canonical: 'NLP',
    aliases: ['nlp', 'natural language processing', 'traitement du langage naturel', 'tal'],
    category: 'data',
  },
  {
    canonical: 'LLM',
    aliases: [
      'llm',
      'large language model',
      'grand modele de langage',
      'genai',
      'ia generative',
      'generative ai',
    ],
    category: 'data',
  },
  { canonical: 'PyTorch', aliases: ['pytorch'], category: 'data' },
  { canonical: 'TensorFlow', aliases: ['tensorflow'], category: 'data' },
  { canonical: 'pandas', aliases: ['pandas'], category: 'data' },
  { canonical: 'Spark', aliases: ['spark', 'pyspark', 'apache spark'], category: 'data' },
  { canonical: 'Airflow', aliases: ['airflow', 'apache airflow'], category: 'data' },
  { canonical: 'dbt', aliases: ['dbt'], category: 'data' },
  { canonical: 'Power BI', aliases: ['power bi', 'powerbi'], category: 'data' },
  { canonical: 'Tableau', aliases: ['tableau'], category: 'data', ambiguous: true },
  { canonical: 'ETL', aliases: ['etl', 'elt'], category: 'data' },

  // --- Design -----------------------------------------------------------
  { canonical: 'Figma', aliases: ['figma'], category: 'design' },
  {
    canonical: 'UX',
    aliases: ['ux', 'user experience', 'experience utilisateur'],
    category: 'design',
  },
  { canonical: 'UI', aliases: ['ui design', 'interface utilisateur'], category: 'design' },
  {
    canonical: 'Accessibilité',
    aliases: ['accessibilite', 'accessibility', 'wcag', 'a11y'],
    category: 'design',
  },

  // --- Gestion et méthodes ---------------------------------------------
  { canonical: 'Agile', aliases: ['agile', 'agilite'], category: 'management' },
  { canonical: 'Scrum', aliases: ['scrum'], category: 'management' },
  { canonical: 'Kanban', aliases: ['kanban'], category: 'management' },
  { canonical: 'Jira', aliases: ['jira'], category: 'tooling' },
  {
    canonical: 'Gestion de projet',
    aliases: ['gestion de projet', 'project management', 'pmp'],
    category: 'management',
  },
  {
    canonical: 'Gestion de produit',
    aliases: ['gestion de produit', 'product management', 'product owner'],
    category: 'management',
  },
  {
    canonical: 'Gestion d’équipe',
    aliases: ['gestion d equipe', 'people management', 'team management', 'encadrement'],
    category: 'management',
  },

  // --- Affaires ---------------------------------------------------------
  { canonical: 'Salesforce', aliases: ['salesforce'], category: 'business' },
  { canonical: 'HubSpot', aliases: ['hubspot'], category: 'business' },
  { canonical: 'SAP', aliases: ['sap'], category: 'business' },
  { canonical: 'Excel', aliases: ['excel', 'microsoft excel'], category: 'business' },
  {
    canonical: 'Comptabilité',
    aliases: ['comptabilite', 'accounting', 'cpa'],
    category: 'business',
  },
  {
    canonical: 'Vente B2B',
    aliases: ['vente b2b', 'b2b sales', 'developpement des affaires', 'business development'],
    category: 'business',
  },

  // --- Savoir-être ------------------------------------------------------
  // Peu de compétences transversales : elles sont mal discriminantes et
  // gonflent artificiellement les scores de compatibilité.
  { canonical: 'Communication', aliases: ['communication'], category: 'soft' },
  { canonical: 'Mentorat', aliases: ['mentorat', 'mentoring', 'coaching'], category: 'soft' },
  {
    canonical: 'Bilinguisme',
    aliases: ['bilingue', 'bilingual', 'bilinguisme', 'francais et anglais'],
    category: 'soft',
  },
];

/** Index alias → définition, construit une seule fois. */
const ALIAS_INDEX = new Map<string, SkillDefinition>();
for (const skill of SKILL_TAXONOMY) {
  for (const alias of skill.aliases) {
    ALIAS_INDEX.set(alias, skill);
  }
  ALIAS_INDEX.set(skill.canonical.toLowerCase(), skill);
}

export function lookupSkill(alias: string): SkillDefinition | undefined {
  return ALIAS_INDEX.get(alias.toLowerCase().trim());
}

export function allAliases(): string[] {
  return [...ALIAS_INDEX.keys()];
}
