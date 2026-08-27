/**
 * Formes des réponses de l'API, telles que consommées par l'interface.
 *
 * Volontairement des types locaux plutôt qu'un import direct des types du
 * domaine : l'API sérialise en JSON (les dates deviennent des chaînes,
 * `undefined` disparaît) et n'expose pas tous les champs. Réutiliser les
 * types du domaine ferait croire à des garanties que la frontière HTTP ne
 * fournit pas.
 */

export interface JobSummary {
  id: string;
  title: string;
  companyName: string;
  department: string | null;
  locationRaw: string | null;
  remotePolicy: string;
  seniority: string;
  employmentType: string;
  language: string;
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
    confidence: string;
  } | null;
  applyUrl: string | null;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  ghostScore: number;
  duplicateGroupId: string | null;
  isDuplicateOf: string | null;
  score: number | null;
  decision: string | null;
  scoreSummary: string | null;
}

export interface JobListResponse {
  total: number;
  jobs: JobSummary[];
}

export interface CriterionScore {
  key: string;
  label: string;
  score: number;
  weight: number;
  evaluated: boolean;
  explanation: string;
}

export interface KeywordGapItem {
  keyword: string;
  status: 'matched' | 'missing_from_cv' | 'not_in_profile' | 'transferable';
  required: boolean;
  category: string;
  profileEvidence?: string;
  /** Compétence voisine réellement possédée, sur le statut `transferable`. */
  transferable?: { missing: string; via: string; domain: string; strength: number };
  /** Phrase prête pour la lettre : compétence possédée **et** écart assumé. */
  bridge?: string;
  advice: string;
}

export interface JobDetailResponse {
  job: {
    id?: string;
    title: string;
    companyName: string;
    department?: string;
    locationRaw?: string;
    locations: Array<{ city?: string; region?: string; country?: string; raw: string }>;
    remotePolicy: string;
    remoteConfidence: string;
    seniority: string;
    seniorityConfidence: string;
    employmentType: string;
    language: string;
    descriptionText: string;
    sections: { requirements: string[]; responsibilities: string[]; benefits: string[] };
    skills: string[];
    salary?: {
      min?: number;
      max?: number;
      currency?: string;
      period?: string;
      confidence: string;
      evidence?: string;
    };
    applyUrl?: string;
    canonicalUrl?: string;
    firstSeenAt: string;
    lastSeenAt: string;
    seenCount: number;
    repostCount: number;
    status: string;
    ghostScore: number;
    ghostSignals: Array<{ code: string; label: string; weight: number; detail?: string }>;
  };
  score: {
    score: number;
    decision: string;
    criteria: CriterionScore[];
    blockers: string[];
    warnings: string[];
    keywordGap: {
      items: KeywordGapItem[];
      matched: KeywordGapItem[];
      safeToAdd: KeywordGapItem[];
      realGaps: KeywordGapItem[];
      transferable: KeywordGapItem[];
      coverage: number;
      requiredCoverage: number;
    };
    summary: string;
  } | null;
  duplicates: Array<{ id: string; title: string; atsProvider: string }>;
}

export interface BoardColumn {
  stage: string;
  label: string;
  applications: Array<{
    id: string;
    stage: string;
    appliedAt: string | null;
    nextAction: string | null;
    nextActionDueAt: string | null;
    noteCount: number;
    documentCount: number;
    score: number | null;
    job: {
      id: string;
      title: string;
      companyName: string;
      locationRaw: string | null;
      remotePolicy: string;
      applyUrl: string | null;
      ghostScore: number;
      status: string;
    };
  }>;
}

export interface StatsResponse {
  total: number;
  applied: number;
  interviews: number;
  offers: number;
  interviewRate: number | null;
  offerRate: number | null;
  byStage: Array<{ stage: string; label: string; count: number }>;
}

export interface AuditResponse {
  total: number;
  events: Array<{
    id: string;
    at: string;
    action: string;
    label: string;
    actor: string;
    targetType: string | null;
    summary: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface SettingsResponse {
  llm: {
    provider: string;
    model: string | null;
    consent: boolean;
    hasApiKey: boolean;
    available: Array<{ id: string; label: string; local: boolean; defaultModel: string }>;
  };
  scoring: { weights: Record<string, number>; defaults: Record<string, number> };
  documents: {
    tone: ImpactTone;
    available: Array<{ id: ImpactTone; label: string; caveat: string }>;
  };
}

export type ImpactTone = 'factual' | 'confident' | 'assertive';

export interface ImpactEdit {
  kind: 'outcome_first' | 'weakener_removed' | 'hedge_removed' | 'term_aligned' | 'tidied';
  before: string;
  after: string;
  rationale: string;
}

export interface RewrittenBullet {
  original: string;
  text: string;
  edits: ImpactEdit[];
}

export interface StatusResponse {
  llm: { provider: string; model: string | null; consent: boolean; hasApiKey: boolean };
  connectors: Array<{ id: string; label: string; boardHint: string; apiDocsUrl: string }>;
  counts: { jobs: number; activeJobs: number; applications: number; sources: number };
}

export interface SourceSummary {
  id: string;
  provider: string;
  boardToken: string;
  label: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastRunNote: string | null;
  runs: Array<{
    id: string;
    startedAt: string;
    status: string;
    fetched: number;
    created: number;
    updated: number;
    error: string | null;
  }>;
}

export interface InterviewPrepResponse {
  questions: Array<{
    question: string;
    origin: string;
    rationale: string;
    talkingPoints: string[];
  }>;
  questionsToAsk: string[];
  risks: string[];
  checklist: string[];
  enhancedByLlm: boolean;
  llmUnavailableReason?: string;
}

export interface ProfileResponse {
  id: string;
  label: string;
  locale: string;
  identity: { firstName: string; lastName: string; headline?: string; summary?: string };
  contact: { email: string; phone?: string; publicLocation?: string };
  location?: { city?: string; region?: string; country?: string; raw: string };
  experiences: Array<{
    id: string;
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
    skills: string[];
  }>;
  projects: Array<{ id: string; name: string; bullets: string[]; skills: string[] }>;
  education: Array<{ id: string; institution: string; degree: string; completed: boolean }>;
  certifications: Array<{ id: string; name: string; issuer?: string }>;
  skills: Array<{ name: string; level?: string; yearsOfExperience?: number }>;
  languages: Array<{ language: string; level: string }>;
  preferences: {
    targetTitles: string[];
    excludedTitles: string[];
    remotePolicies: string[];
    seniorityTargets: string[];
    salaryExpectation?: { min: number; max?: number; currency: string; period: string };
  };
}

export interface SensitiveFieldStatus {
  key: string;
  state: 'answered' | 'needs_input' | 'declined';
  hasValue: boolean;
  note?: string;
}

export interface GeneratedDocumentSummary {
  id: string;
  kind: 'cv' | 'cover_letter';
  language: string;
  version: number;
  pdfPath: string | null;
  injectedKeywords: string[];
  tone: ImpactTone;
  createdAt: string;
  applicationId: string | null;
}

export interface GeneratedDocumentDetail extends GeneratedDocumentSummary {
  plainText: string;
  sourceTypst: string;
  profileHash: string;
  rewrites: RewrittenBullet[];
}
