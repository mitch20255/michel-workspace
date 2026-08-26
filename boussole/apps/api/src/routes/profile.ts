import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { loadProfile } from '../context.js';
import {
  createOrUpdateProfile,
  exportUserData,
  purgeUserData,
  sensitiveFieldStatus,
  setSensitiveAnswer,
} from '../services/profiles.js';
import { badRequest } from '../errors.js';

const SensitiveAnswerInput = z.object({
  key: z.string().min(1),
  state: z.enum(['answered', 'needs_input', 'declined']),
  value: z.string().optional(),
  note: z.string().optional(),
});

export async function registerProfileRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.get('/profile', async () => loadProfile(context));

  app.put('/profile', async (request) => createOrUpdateProfile(context, request.body));

  /**
   * État des champs sensibles.
   * Ne renvoie jamais les valeurs — seulement l'état, qui suffit à piloter
   * l'interface et l'extension.
   */
  app.get('/profile/sensitive', async () => {
    const profile = await loadProfile(context);
    return sensitiveFieldStatus(context, profile.id);
  });

  app.put('/profile/sensitive', async (request) => {
    const input = SensitiveAnswerInput.parse(request.body);
    const profile = await loadProfile(context);
    return setSensitiveAnswer(context, profile.id, input);
  });

  /** Export complet, en clair : exigence de portabilité. */
  app.get('/profile/export', async () => exportUserData(context));

  /**
   * Suppression définitive.
   *
   * Confirmation explicite exigée dans le corps de la requête : une
   * suppression déclenchée par un clic mal placé est irréversible, et un
   * simple verbe HTTP DELETE ne suffit pas à établir l'intention.
   */
  app.post('/profile/purge', async (request) => {
    const body = z.object({ confirm: z.literal('SUPPRIMER') }).safeParse(request.body);
    if (!body.success) {
      throw badRequest(
        'Suppression non confirmée. Envoyer { "confirm": "SUPPRIMER" } pour confirmer. ' +
          'Cette opération est irréversible.',
      );
    }

    await purgeUserData(context);
    return { deleted: true };
  });
}
