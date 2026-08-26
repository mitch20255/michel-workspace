import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { loadProfile } from '../context.js';
import { badRequest, notFound } from '../errors.js';
import { generateDocuments } from '../services/documents.js';

const GenerateInput = z.object({
  jobId: z.string().min(1),
  kinds: z.array(z.enum(['cv', 'cover_letter'])).optional(),
  language: z.enum(['fr', 'en']).optional(),
  recipientName: z.string().optional(),
  customParagraphs: z.array(z.string()).optional(),
  applicationId: z.string().optional(),
});

export async function registerDocumentRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.post('/documents/generate', async (request, reply) => {
    const input = GenerateInput.parse(request.body);
    const profile = await loadProfile(context);

    const documents = await generateDocuments(context, { ...input, profile });

    void reply.status(201);
    return { documents };
  });

  app.get('/documents', async (request) => {
    const query = z
      .object({
        applicationId: z.string().optional(),
        kind: z.enum(['cv', 'cover_letter']).optional(),
      })
      .parse(request.query);

    return context.prisma.generatedDocument.findMany({
      where: {
        userId: context.userId,
        ...(query.applicationId ? { applicationId: query.applicationId } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      select: {
        id: true,
        kind: true,
        language: true,
        version: true,
        pdfPath: true,
        injectedKeywords: true,
        createdAt: true,
        applicationId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/documents/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const document = await context.prisma.generatedDocument.findFirst({
      where: { id, userId: context.userId },
    });
    if (!document) throw notFound('Document');
    return document;
  });

  /**
   * Téléchargement du PDF.
   *
   * Le chemin stocké est relatif ; il est résolu sous `STORAGE_DIR` puis
   * vérifié comme restant à l'intérieur. Sans ce contrôle, une valeur
   * corrompue en base contenant « ../../ » permettrait de lire n'importe quel
   * fichier du disque.
   */
  app.get('/documents/:id/pdf', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const document = await context.prisma.generatedDocument.findFirst({
      where: { id, userId: context.userId },
    });
    if (!document) throw notFound('Document');
    if (!document.pdfPath) {
      throw badRequest(
        'Aucun PDF pour ce document : Typst était indisponible lors de la génération. La source et le texte restent accessibles.',
      );
    }

    const storageRoot = resolve(context.config.STORAGE_DIR);
    const absolute = resolve(join(storageRoot, normalize(document.pdfPath)));

    if (!absolute.startsWith(storageRoot + '/') && absolute !== storageRoot) {
      throw badRequest('Chemin de document invalide.');
    }

    try {
      await stat(absolute);
    } catch {
      throw notFound('Fichier PDF');
    }

    await context.audit({
      action: 'document.exported',
      targetType: 'generated_document',
      targetId: id,
      metadata: { kind: document.kind, version: document.version },
      summary: `${document.kind === 'cv' ? 'CV' : 'Lettre'} v${document.version} téléchargé`,
    });

    void reply.header('content-type', 'application/pdf');
    void reply.header(
      'content-disposition',
      `attachment; filename="${document.kind}-v${document.version}.pdf"`,
    );
    return reply.send(createReadStream(absolute));
  });
}
