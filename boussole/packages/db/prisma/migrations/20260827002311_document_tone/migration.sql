-- AlterTable
ALTER TABLE "generated_documents" ADD COLUMN     "rewrites" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'factual';

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "documentTone" TEXT NOT NULL DEFAULT 'confident';
