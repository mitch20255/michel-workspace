-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL DEFAULT 'none',
    "llmModel" TEXT,
    "llmApiKey" TEXT,
    "llmConsent" BOOLEAN NOT NULL DEFAULT false,
    "scoringWeights" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Profil principal',
    "locale" TEXT NOT NULL DEFAULT 'fr-CA',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "pronouns" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "publicLocation" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "experiences" JSONB NOT NULL DEFAULT '[]',
    "projects" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "languages" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "cannedAnswers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_answers" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'needs_input',
    "value" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitive_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "boardToken" TEXT NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunOk" BOOLEAN,
    "lastRunNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "inactive" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "atsProvider" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyNameNormalized" TEXT NOT NULL,
    "companyDomain" TEXT,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    "department" TEXT,
    "locationRaw" TEXT,
    "locations" JSONB NOT NULL DEFAULT '[]',
    "remotePolicy" TEXT NOT NULL DEFAULT 'unknown',
    "remoteConfidence" TEXT NOT NULL DEFAULT 'low',
    "employmentType" TEXT NOT NULL DEFAULT 'unknown',
    "seniority" TEXT NOT NULL DEFAULT 'unknown',
    "seniorityConfidence" TEXT NOT NULL DEFAULT 'low',
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "salaryConfidence" TEXT NOT NULL DEFAULT 'low',
    "salaryEvidence" TEXT,
    "language" TEXT NOT NULL DEFAULT 'unknown',
    "descriptionRaw" TEXT NOT NULL DEFAULT '',
    "descriptionText" TEXT NOT NULL DEFAULT '',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "applyUrl" TEXT,
    "canonicalUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contentHash" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "duplicateGroupId" TEXT,
    "ghostScore" INTEGER NOT NULL DEFAULT 0,
    "ghostSignals" JSONB NOT NULL DEFAULT '[]',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_groups" (
    "id" TEXT NOT NULL,
    "canonicalJobId" TEXT,
    "confirmedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duplicate_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_scores" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "keywordGap" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL DEFAULT '',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'to_review',
    "jobSnapshot" JSONB,
    "appliedAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "nextActionDueAt" TIMESTAMP(3),
    "scoreAtShortlist" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_notes" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "message" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "applicationId" TEXT,
    "kind" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceTypst" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "pdfPath" TEXT,
    "injectedKeywords" JSONB NOT NULL DEFAULT '[]',
    "profileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'user',
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "candidate_profiles_userId_idx" ON "candidate_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_answers_profileId_key_key" ON "sensitive_answers"("profileId", "key");

-- CreateIndex
CREATE INDEX "job_sources_userId_enabled_idx" ON "job_sources"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "job_sources_userId_provider_boardToken_key" ON "job_sources"("userId", "provider", "boardToken");

-- CreateIndex
CREATE INDEX "ingestion_runs_sourceId_startedAt_idx" ON "ingestion_runs"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "jobs_identityKey_idx" ON "jobs"("identityKey");

-- CreateIndex
CREATE INDEX "jobs_status_lastSeenAt_idx" ON "jobs"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "jobs_companyNameNormalized_idx" ON "jobs"("companyNameNormalized");

-- CreateIndex
CREATE INDEX "jobs_duplicateGroupId_idx" ON "jobs"("duplicateGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_atsProvider_sourceJobId_key" ON "jobs"("atsProvider", "sourceJobId");

-- CreateIndex
CREATE INDEX "job_scores_profileId_score_idx" ON "job_scores"("profileId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "job_scores_jobId_profileId_key" ON "job_scores"("jobId", "profileId");

-- CreateIndex
CREATE INDEX "applications_userId_stage_idx" ON "applications"("userId", "stage");

-- CreateIndex
CREATE INDEX "applications_nextActionDueAt_idx" ON "applications"("nextActionDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "applications_profileId_jobId_key" ON "applications"("profileId", "jobId");

-- CreateIndex
CREATE INDEX "application_notes_applicationId_createdAt_idx" ON "application_notes"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "application_events_applicationId_createdAt_idx" ON "application_events"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "reminders_dueAt_done_idx" ON "reminders"("dueAt", "done");

-- CreateIndex
CREATE INDEX "generated_documents_profileId_kind_createdAt_idx" ON "generated_documents"("profileId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "generated_documents_applicationId_idx" ON "generated_documents"("applicationId");

-- CreateIndex
CREATE INDEX "audit_events_userId_createdAt_idx" ON "audit_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_answers" ADD CONSTRAINT "sensitive_answers_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "job_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_duplicateGroupId_fkey" FOREIGN KEY ("duplicateGroupId") REFERENCES "duplicate_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
