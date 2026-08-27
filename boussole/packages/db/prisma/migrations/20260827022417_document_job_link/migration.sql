-- AlterTable
ALTER TABLE "generated_documents" ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "generated_documents_jobId_createdAt_idx" ON "generated_documents"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
