import type { FetchLike } from '@boussole/connectors';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { registerHealthRoutes } from './health.js';
import { registerProfileRoutes } from './profile.js';
import { registerSourceRoutes } from './sources.js';
import { registerJobRoutes } from './jobs.js';
import { registerApplicationRoutes } from './applications.js';
import { registerDocumentRoutes } from './documents.js';
import { registerInterviewRoutes } from './interview.js';
import { registerSettingsRoutes } from './settings.js';
import { registerAuditRoutes } from './audit.js';

export async function registerRoutes(
  app: FastifyInstance,
  context: AppContext,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await registerHealthRoutes(app, context);
  await registerProfileRoutes(app, context);
  await registerSourceRoutes(app, context, fetchImpl);
  await registerJobRoutes(app, context);
  await registerApplicationRoutes(app, context);
  await registerDocumentRoutes(app, context);
  await registerInterviewRoutes(app, context);
  await registerSettingsRoutes(app, context);
  await registerAuditRoutes(app, context);
}
