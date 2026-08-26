import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RawJobSchema, scoreGhostJob } from '@boussole/core';
import { jobRowToDomain } from '@boussole/db';
import type { AppContext } from '../context.js';
import { loadProfile } from '../context.js';
import { notFound } from '../errors.js';
import { ingestManualJob } from '../services/ingestion.js';
import { scoreAll, scoreOne } from '../services/scoring.js';

const ListQuery = z.object({
  status: z.enum(['active', 'inactive', 'expired', 'all']).default('active'),
  decision: z.enum(['reject', 'maybe', 'shortlist', 'generate_documents']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  /** Masquer les doublons : n'afficher qu'une offre par groupe. */
  collapseDuplicates: z.coerce.boolean().default(true),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerJobRoutes(app: FastifyInstance, context: AppContext): Promise<void> {
  app.get('/jobs', async (request) => {
    const query = ListQuery.parse(request.query);
    const profile = await loadProfile(context);

    const rows = await context.prisma.job.findMany({
      where: {
        ...(query.status === 'all' ? {} : { status: query.status }),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { companyName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        scores: { where: { profileId: profile.id } },
        duplicateGroup: { select: { id: true, canonicalJobId: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    let jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      companyName: row.companyName,
      department: row.department,
      locationRaw: row.locationRaw,
      remotePolicy: row.remotePolicy,
      seniority: row.seniority,
      employmentType: row.employmentType,
      language: row.language,
      salary:
        row.salaryMin !== null || row.salaryMax !== null
          ? {
              min: row.salaryMin,
              max: row.salaryMax,
              currency: row.salaryCurrency,
              period: row.salaryPeriod,
              confidence: row.salaryConfidence,
            }
          : null,
      applyUrl: row.applyUrl,
      status: row.status,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      ghostScore: row.ghostScore,
      duplicateGroupId: row.duplicateGroupId,
      isDuplicateOf:
        row.duplicateGroup && row.duplicateGroup.canonicalJobId !== row.id
          ? row.duplicateGroup.canonicalJobId
          : null,
      score: row.scores[0]?.score ?? null,
      decision: row.scores[0]?.decision ?? null,
      scoreSummary: row.scores[0]?.summary ?? null,
    }));

    // Un seul représentant par groupe de doublons : c'est tout l'intérêt de
    // la déduplication côté affichage.
    if (query.collapseDuplicates) {
      jobs = jobs.filter((job) => job.isDuplicateOf === null);
    }
    if (query.decision) {
      jobs = jobs.filter((job) => job.decision === query.decision);
    }
    if (query.minScore !== undefined) {
      jobs = jobs.filter((job) => (job.score ?? -1) >= query.minScore!);
    }

    // Tri par score décroissant, les offres non encore évaluées en dernier :
    // elles ne doivent pas s'intercaler comme si elles valaient zéro.
    jobs.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    return {
      total: jobs.length,
      jobs: jobs.slice(query.offset, query.offset + query.limit),
    };
  });

  app.get('/jobs/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const profile = await loadProfile(context);

    const row = await context.prisma.job.findUnique({
      where: { id },
      include: {
        scores: { where: { profileId: profile.id } },
        duplicateGroup: {
          include: { jobs: { select: { id: true, title: true, atsProvider: true } } },
        },
      },
    });
    if (!row) throw notFound('Offre');

    const job = jobRowToDomain(row);

    return {
      job,
      score: row.scores[0] ?? null,
      duplicates: row.duplicateGroup?.jobs.filter((duplicate) => duplicate.id !== row.id) ?? [],
    };
  });

  /** Recalcule le score d'une offre. */
  app.post('/jobs/:id/score', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const profile = await loadProfile(context);
    return scoreOne(context, id, profile);
  });

  /**
   * Recalcule tous les scores.
   * À appeler après une modification du profil : sans cela l'utilisateur
   * verrait des scores calculés à partir d'un profil qui n'existe plus.
   */
  app.post('/jobs/score-all', async () => {
    const profile = await loadProfile(context);
    const summaries = await scoreAll(context, profile);
    return { scored: summaries.length, top: summaries.slice(0, 20) };
  });

  /** Saisie manuelle d'une offre (copier-coller d'une annonce). */
  app.post('/jobs/manual', async (request, reply) => {
    const input = RawJobSchema.parse({
      ...(request.body as object),
      source: 'manual',
      atsProvider: (request.body as { atsProvider?: string }).atsProvider ?? 'manual',
    });
    const job = await ingestManualJob(context, input);
    void reply.status(201);
    return job;
  });

  /**
   * Détail explicatif du score fantôme.
   * Le score seul est un chiffre opaque ; ce sont les signaux qui permettent
   * à l'utilisateur de le contester.
   */
  app.get('/jobs/:id/ghost', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const row = await context.prisma.job.findUnique({ where: { id } });
    if (!row) throw notFound('Offre');

    const job = jobRowToDomain(row);
    const companyActiveJobCount = await context.prisma.job.count({
      where: { companyNameNormalized: row.companyNameNormalized, status: 'active' },
    });

    return scoreGhostJob({
      firstSeenAt: job.firstSeenAt,
      lastSeenAt: job.lastSeenAt,
      seenCount: job.seenCount,
      repostCount: job.repostCount,
      descriptionText: job.descriptionText,
      sections: job.sections,
      applyUrl: job.applyUrl,
      canonicalUrl: job.canonicalUrl,
      hasSalary: Boolean(job.salary?.min),
      companyActiveJobCount,
    });
  });
}
