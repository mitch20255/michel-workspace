import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AUDIT_LABELS_FR } from '@boussole/core';
import type { AppContext } from '../context.js';

/**
 * Journal d'audit consultable.
 *
 * Ce n'est pas un journal technique : c'est la réponse à « qu'est-ce que cet
 * outil a fait en mon nom ? ». Il est donc exposé à l'utilisateur, lisible en
 * français, et en lecture seule — aucune route ne permet d'en supprimer une
 * entrée. Un journal effaçable ne prouve rien.
 */
export async function registerAuditRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.get('/audit', async (request) => {
    const query = z
      .object({
        action: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);

    const where = {
      userId: context.userId,
      ...(query.action ? { action: query.action } : {}),
    };

    const [total, events] = await Promise.all([
      context.prisma.auditEvent.count({ where }),
      context.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      total,
      events: events.map((event) => ({
        id: event.id,
        at: event.createdAt,
        action: event.action,
        label: AUDIT_LABELS_FR[event.action as keyof typeof AUDIT_LABELS_FR] ?? event.action,
        actor: event.actor,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata,
        summary: event.summary,
      })),
    };
  });
}
