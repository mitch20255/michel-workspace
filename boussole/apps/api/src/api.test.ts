import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadFixture, mockFetch } from '@boussole/connectors/testing';
import {
  createHarness,
  isTestDatabaseAvailable,
  resetDatabase,
  TEST_PROFILE,
  type TestHarness,
} from './testing/harness.js';

/**
 * Tests d'intégration de l'API, sur une vraie base Postgres.
 *
 * Ignorés si `boussole_test` n'est pas joignable : la base est un outil de
 * développement, pas une dépendance du produit. Voir docs/testing.md pour la
 * préparer.
 */
const dbAvailable = await isTestDatabaseAvailable();
const describeApi = dbAvailable ? describe : describe.skip;

let harness: TestHarness;

beforeAll(async () => {
  if (dbAvailable) harness = await createHarness();
});

afterAll(async () => {
  if (harness) await harness.close();
});

beforeEach(async () => {
  if (harness) await resetDatabase(harness.prisma);
});

/** Recrée le compte unique, supprimé par la remise à zéro. */
async function seedUser(): Promise<void> {
  await harness.prisma.user.create({
    data: { id: harness.context.userId, email: 'test@boussole.invalid', settings: { create: {} } },
  });
}

describeApi('authentification', () => {
  it('laisse /health accessible sans jeton', async () => {
    // Une sonde qui exige un secret n'est pas utilisable par un superviseur.
    const response = await harness.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });

  it('refuse une route protégée sans jeton', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/jobs' });
    expect(response.statusCode).toBe(401);
  });

  it('refuse un jeton incorrect', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/jobs',
      headers: { authorization: 'Bearer mauvais-jeton' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('accepte le bon jeton', async () => {
    await seedUser();
    const { status } = await harness.request('GET', '/status');
    expect(status).toBe(200);
  });
});

describeApi('profil', () => {
  beforeEach(seedUser);

  it('crée puis relit un profil', async () => {
    const created = await harness.request('PUT', '/profile', TEST_PROFILE);
    expect(created.status).toBe(200);

    const read = await harness.request('GET', '/profile');
    const profile = read.body as { identity: { firstName: string }; contact: { email: string } };
    expect(profile.identity.firstName).toBe('Camille');
    expect(profile.contact.email).toBe('camille@exemple-fictif.test');
  });

  it('chiffre les coordonnées au repos', async () => {
    // Vérification par lecture directe en base : c'est la seule façon de
    // prouver que le chiffrement a bien eu lieu, et non qu'il a été simulé
    // par la couche de service.
    await harness.request('PUT', '/profile', TEST_PROFILE);

    const row = await harness.prisma.candidateProfile.findFirst();
    expect(row?.email).not.toBe('camille@exemple-fictif.test');
    expect(row?.email.startsWith('v1.')).toBe(true);
    expect(row?.phone?.startsWith('v1.')).toBe(true);
    // Ce qui doit rester interrogeable reste en clair.
    expect(row?.firstName).toBe('Camille');
  });

  it('rejette un profil invalide avec le détail des champs', async () => {
    const { status, body } = await harness.request('PUT', '/profile', {
      ...TEST_PROFILE,
      contact: { email: 'pas-une-adresse' },
    });

    expect(status).toBe(400);
    const error = body as { error: { code: string; details: unknown } };
    expect(error.error.code).toBe('validation_error');
    expect(JSON.stringify(error.error.details)).toContain('contact.email');
  });

  it('ne renvoie jamais la valeur des réponses sensibles', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);
    const profile = (await harness.request('GET', '/profile')).body as { id: string };

    await harness.request('PUT', '/profile/sensitive', {
      key: 'work_authorization',
      state: 'answered',
      value: 'Citoyenne canadienne',
    });

    const { body } = await harness.request('GET', '/profile/sensitive');
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain('Citoyenne canadienne');
    expect(serialized).toContain('work_authorization');
    expect(profile.id).toBeTruthy();
  });

  it('retombe sur needs_input pour une réponse « answered » sans valeur', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);
    await harness.request('PUT', '/profile/sensitive', {
      key: 'salary_expectation',
      state: 'answered',
      value: '   ',
    });

    const fields = (await harness.request('GET', '/profile/sensitive')).body as Array<{
      key: string;
      state: string;
    }>;
    const field = fields.find((entry) => entry.key === 'salary_expectation');
    expect(field?.state).toBe('needs_input');
  });

  it('exige une confirmation explicite pour la suppression', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);

    const refused = await harness.request('POST', '/profile/purge', { confirm: 'oui' });
    expect(refused.status).toBe(400);

    const profileStillThere = await harness.request('GET', '/profile');
    expect(profileStillThere.status).toBe(200);
  });
});

describeApi('ingestion', () => {
  beforeEach(seedUser);

  it('refuse un fournisseur inconnu', async () => {
    const { status, body } = await harness.request('POST', '/sources', {
      provider: 'workday',
      boardToken: 'peu-importe',
    });

    expect(status).toBe(400);
    // Workday est délibérément absent : le message doit l'expliquer.
    expect(JSON.stringify(body)).toContain('non pris en charge');
  });

  it('ingère, normalise et score un tableau Greenhouse', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);

    const source = (
      await harness.request('POST', '/sources', {
        provider: 'greenhouse',
        boardToken: 'northwindfictif',
      })
    ).body as { id: string };

    // Le `fetch` est simulé : les tests ne touchent jamais un ATS réel.
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const { runIngestion } = await import('./services/ingestion.js');
    const summary = await runIngestion(harness.context, source.id, mock.fetch);

    expect(summary.status).toBe('success');
    expect(summary.created).toBe(2);
    expect(summary.warnings.length).toBe(1);

    await harness.request('POST', '/jobs/score-all');

    const jobs = (await harness.request('GET', '/jobs')).body as {
      jobs: Array<{ title: string; score: number | null; ghostScore: number }>;
    };
    const senior = jobs.jobs.find((job) => job.title.includes('Senior'));
    expect(senior?.score).toBeGreaterThan(50);
  });

  it('désactive une offre disparue au lieu de la supprimer', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);
    const source = (
      await harness.request('POST', '/sources', {
        provider: 'greenhouse',
        boardToken: 'northwindfictif',
      })
    ).body as { id: string };

    const { runIngestion } = await import('./services/ingestion.js');
    await runIngestion(harness.context, source.id, mockFetch(loadFixture('greenhouse.json')).fetch);

    // Deuxième passage : le tableau ne contient plus qu'une offre.
    const shrunk = JSON.stringify({
      jobs: [JSON.parse(loadFixture('greenhouse.json')).jobs[0]],
    });
    const summary = await runIngestion(harness.context, source.id, mockFetch(shrunk).fetch);

    expect(summary.deactivated).toBe(1);
    // Une offre disparue reste en base : elle peut porter une candidature en
    // cours, et sa réapparition est un signal de republication.
    expect(await harness.prisma.job.count()).toBe(2);
    expect(await harness.prisma.job.count({ where: { status: 'inactive' } })).toBe(1);
  });

  it('conserve la première détection entre deux ingestions', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);
    const source = (
      await harness.request('POST', '/sources', {
        provider: 'greenhouse',
        boardToken: 'northwindfictif',
      })
    ).body as { id: string };

    const { runIngestion } = await import('./services/ingestion.js');
    await runIngestion(harness.context, source.id, mockFetch(loadFixture('greenhouse.json')).fetch);
    const first = await harness.prisma.job.findFirst({ orderBy: { createdAt: 'asc' } });

    await runIngestion(harness.context, source.id, mockFetch(loadFixture('greenhouse.json')).fetch);
    const second = await harness.prisma.job.findUnique({ where: { id: first!.id } });

    // Sans cela, l'offre paraîtrait éternellement neuve et le score fantôme
    // serait faux.
    expect(second?.firstSeenAt.getTime()).toBe(first?.firstSeenAt.getTime());
    expect(second?.seenCount).toBe(2);
  });

  it('enregistre un échec de source sans faire tomber la requête', async () => {
    const source = (
      await harness.request('POST', '/sources', {
        provider: 'greenhouse',
        boardToken: 'inexistant',
      })
    ).body as { id: string };

    const { runIngestion } = await import('./services/ingestion.js');
    const summary = await runIngestion(
      harness.context,
      source.id,
      mockFetch('not found', { status: 404 }).fetch,
    );

    expect(summary.status).toBe('failed');
    expect(summary.error).toContain('introuvable');

    const run = await harness.prisma.ingestionRun.findFirst();
    expect(run?.status).toBe('failed');
  });
});

describeApi('CRM', () => {
  beforeEach(async () => {
    await seedUser();
    await harness.request('PUT', '/profile', TEST_PROFILE);
    await harness.request('POST', '/jobs/manual', {
      atsProvider: 'manual',
      sourceJobId: 'crm-1',
      companyName: 'Northwind Technologies Inc.',
      title: 'Développeuse senior',
      locationRaw: 'Montréal, QC',
      descriptionRaw: '<h3>Exigences</h3><ul><li>TypeScript et React.</li></ul>',
    });
  });

  async function firstJobId(): Promise<string> {
    const jobs = (await harness.request('GET', '/jobs')).body as { jobs: Array<{ id: string }> };
    return jobs.jobs[0]!.id;
  }

  it('refuse une seconde candidature pour la même offre', async () => {
    const jobId = await firstJobId();
    const first = await harness.request('POST', '/applications', { jobId });
    expect(first.status).toBe(201);

    const second = await harness.request('POST', '/applications', { jobId });
    expect(second.status).toBe(409);
  });

  it('refuse une transition absurde', async () => {
    const jobId = await firstJobId();
    const application = (await harness.request('POST', '/applications', { jobId })).body as {
      id: string;
    };

    const { status, body } = await harness.request(
      'PATCH',
      `/applications/${application.id}/stage`,
      { stage: 'offer' },
    );

    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain('Transition refusée');
  });

  it('autorise le rejet depuis n’importe quelle étape', async () => {
    const jobId = await firstJobId();
    const application = (await harness.request('POST', '/applications', { jobId })).body as {
      id: string;
    };

    const { status } = await harness.request('PATCH', `/applications/${application.id}/stage`, {
      stage: 'rejected',
    });
    expect(status).toBe(200);
  });

  it('ne marque « soumise » que sur geste explicite', async () => {
    const jobId = await firstJobId();
    const application = (await harness.request('POST', '/applications', { jobId })).body as {
      id: string;
    };

    // Aucune route ne passe à `applied` automatiquement : c'est la garantie
    // centrale du produit.
    let row = await harness.prisma.application.findUnique({ where: { id: application.id } });
    expect(row?.appliedAt).toBeNull();

    for (const stage of ['shortlist', 'documents_ready', 'ready_to_apply', 'applied']) {
      await harness.request('PATCH', `/applications/${application.id}/stage`, { stage });
    }

    row = await harness.prisma.application.findUnique({ where: { id: application.id } });
    expect(row?.appliedAt).not.toBeNull();
  });

  it('conserve une copie de l’offre au moment de la candidature', async () => {
    const jobId = await firstJobId();
    const application = (await harness.request('POST', '/applications', { jobId })).body as {
      id: string;
    };

    const row = await harness.prisma.application.findUnique({ where: { id: application.id } });
    // Les ATS retirent leurs annonces : sans copie locale, le contexte de sa
    // propre candidature disparaît.
    expect((row?.jobSnapshot as { title?: string })?.title).toBe('Développeuse senior');
  });

  it('expose un tableau Kanban avec toutes les colonnes', async () => {
    const board = (await harness.request('GET', '/board')).body as Array<{
      stage: string;
      label: string;
    }>;

    expect(board.length).toBe(11);
    expect(board[0]?.label).toBe('À examiner');
  });

  it('calcule les taux sur les candidatures réellement soumises', async () => {
    const stats = (await harness.request('GET', '/stats')).body as {
      total: number;
      applied: number;
      interviewRate: number | null;
    };

    // Aucune candidature soumise : un taux de 0 laisserait croire à un échec
    // alors qu'il n'y a simplement rien à mesurer.
    expect(stats.applied).toBe(0);
    expect(stats.interviewRate).toBeNull();
  });
});

describeApi('documents', () => {
  beforeEach(async () => {
    await seedUser();
    await harness.request('PUT', '/profile', TEST_PROFILE);
  });

  it('refuse de générer un document contenant une affirmation non attestée', async () => {
    // Le profil ne déclare ni Terraform ni certification : la forge doit
    // refuser plutôt que d'écrire quelque chose de faux.
    await harness.request('PUT', '/profile', {
      ...TEST_PROFILE,
      identity: {
        ...TEST_PROFILE.identity,
        summary: 'Certifiée AWS Solutions Architect.',
      },
    });

    await harness.request('POST', '/jobs/manual', {
      atsProvider: 'manual',
      sourceJobId: 'doc-1',
      companyName: 'Northwind Technologies Inc.',
      title: 'Développeuse senior',
      descriptionRaw: '<h3>Exigences</h3><ul><li>TypeScript.</li></ul>',
    });

    const jobs = (await harness.request('GET', '/jobs')).body as { jobs: Array<{ id: string }> };
    const { status, body } = await harness.request('POST', '/documents/generate', {
      jobId: jobs.jobs[0]!.id,
    });

    expect(status).toBe(422);
    const error = body as { error: { code: string } };
    expect(error.error.code).toBe('guardrail_violation');
  });
});

describeApi('ton des documents', () => {
  /** Profil dont les puces se sous-vendent : le cas que le cadran vise. */
  const HEDGED_PROFILE = {
    ...TEST_PROFILE,
    experiences: [
      {
        ...TEST_PROFILE.experiences[0]!,
        bullets: [
          "Participé à la refonte de l'interface React.",
          'Responsable de la migration vers TypeScript.',
        ],
      },
    ],
  };

  async function seedJob(): Promise<string> {
    await harness.request('POST', '/jobs/manual', {
      atsProvider: 'manual',
      sourceJobId: 'tone-1',
      companyName: 'Northwind Technologies Inc.',
      title: 'Développeuse senior',
      descriptionRaw: '<h3>Exigences</h3><ul><li>React et TypeScript.</li></ul>',
    });
    const jobs = (await harness.request('GET', '/jobs')).body as { jobs: Array<{ id: string }> };
    return jobs.jobs[0]!.id;
  }

  beforeEach(async () => {
    await seedUser();
    await harness.request('PUT', '/profile', HEDGED_PROFILE);
  });

  it('reproduit le profil mot pour mot au niveau fidèle', async () => {
    await harness.request('PUT', '/settings', { documentTone: 'factual' });
    const jobId = await seedJob();

    const { status, body } = await harness.request('POST', '/documents/generate', {
      jobId,
      kinds: ['cv'],
    });

    expect(status).toBe(201);
    const { documents } = body as {
      documents: Array<{ tone: string; plainText: string; rewrites: unknown[] }>;
    };
    expect(documents[0]!.tone).toBe('factual');
    expect(documents[0]!.rewrites).toHaveLength(0);
    expect(documents[0]!.plainText).toContain("Participé à la refonte de l'interface React.");
  });

  it('retire les atténuateurs de rôle au niveau offensif', async () => {
    await harness.request('PUT', '/settings', { documentTone: 'assertive' });
    const jobId = await seedJob();

    const { body } = await harness.request('POST', '/documents/generate', {
      jobId,
      kinds: ['cv'],
    });

    const { documents } = body as {
      documents: Array<{
        tone: string;
        plainText: string;
        scopeChangingEdits: unknown[];
      }>;
    };

    expect(documents[0]!.tone).toBe('assertive');
    expect(documents[0]!.plainText).not.toContain('Participé à');
    expect(documents[0]!.plainText).toContain("Refonte de l'interface React.");
    // Le déplacement de portée est remonté séparément : c'est ce que
    // l'utilisateur doit relire avant d'envoyer.
    expect(documents[0]!.scopeChangingEdits.length).toBeGreaterThan(0);
  });

  it('n’introduit aucun terme absent du profil, même au niveau offensif', async () => {
    await harness.request('PUT', '/settings', { documentTone: 'assertive' });
    const jobId = await seedJob();

    const { body } = await harness.request('POST', '/documents/generate', {
      jobId,
      kinds: ['cv'],
    });
    const { documents } = body as {
      documents: Array<{ rewrites: Array<{ original: string; text: string }> }>;
    };

    // Chaque mot du texte réécrit doit exister dans la puce d'origine : la
    // réécriture ne sait que supprimer et permuter.
    for (const rewrite of documents[0]!.rewrites) {
      const source = new Set(rewrite.original.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
      for (const word of rewrite.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
        expect(source.has(word)).toBe(true);
      }
    }
  });

  it('conserve le ton de chaque document, même après changement de réglage', async () => {
    // Changer le réglage ne doit pas réécrire l'histoire d'un CV déjà envoyé.
    await harness.request('PUT', '/settings', { documentTone: 'factual' });
    const jobId = await seedJob();
    await harness.request('POST', '/documents/generate', { jobId, kinds: ['cv'] });

    await harness.request('PUT', '/settings', { documentTone: 'assertive' });
    await harness.request('POST', '/documents/generate', { jobId, kinds: ['cv'] });

    const { body } = await harness.request('GET', `/documents?jobId=${jobId}&withRewrites=true`);
    const documents = body as Array<{ tone: string; version: number }>;

    expect(documents).toHaveLength(2);
    expect(documents.map((d) => d.tone).sort()).toEqual(['assertive', 'factual']);
  });

  it('surcharge ponctuellement le réglage enregistré', async () => {
    await harness.request('PUT', '/settings', { documentTone: 'factual' });
    const jobId = await seedJob();

    const { body } = await harness.request('POST', '/documents/generate', {
      jobId,
      kinds: ['cv'],
      tone: 'confident',
    });

    expect((body as { documents: Array<{ tone: string }> }).documents[0]!.tone).toBe('confident');
  });

  it('ne journalise que des compteurs, jamais le texte réécrit', async () => {
    await harness.request('PUT', '/settings', { documentTone: 'assertive' });
    const jobId = await seedJob();
    await harness.request('POST', '/documents/generate', { jobId, kinds: ['cv'] });

    const { body } = await harness.request('GET', '/audit');
    const serialized = JSON.stringify(body);

    expect(serialized).toContain('document.generated');
    expect(serialized).not.toContain('Participé à');
    expect(serialized).not.toContain("Refonte de l'interface");
  });
});

describeApi('paramètres et modèle de langage', () => {
  beforeEach(seedUser);

  it('est désactivé par défaut', async () => {
    const settings = (await harness.request('GET', '/settings')).body as {
      llm: { provider: string; consent: boolean; hasApiKey: boolean };
    };

    expect(settings.llm.provider).toBe('none');
    expect(settings.llm.consent).toBe(false);
    expect(settings.llm.hasApiKey).toBe(false);
  });

  it('ne renvoie jamais la clé enregistrée', async () => {
    await harness.request('PUT', '/settings', {
      llmProvider: 'anthropic',
      llmApiKey: 'sk-ant-secret-de-test-0123456789',
      llmConsent: true,
    });

    const settings = await harness.request('GET', '/settings');
    const serialized = JSON.stringify(settings.body);

    expect(serialized).not.toContain('sk-ant-secret');
    expect(serialized).toContain('"hasApiKey":true');
  });

  it('chiffre la clé au repos', async () => {
    await harness.request('PUT', '/settings', {
      llmProvider: 'anthropic',
      llmApiKey: 'sk-ant-secret-de-test-0123456789',
    });

    const row = await harness.prisma.userSettings.findFirst();
    expect(row?.llmApiKey?.startsWith('v1.')).toBe(true);
    expect(row?.llmApiKey).not.toContain('sk-ant-secret');
  });

  it('réinitialise le consentement au changement de fournisseur', async () => {
    await harness.request('PUT', '/settings', { llmProvider: 'ollama', llmConsent: true });
    const updated = (await harness.request('PUT', '/settings', { llmProvider: 'anthropic' }))
      .body as { llm: { consent: boolean }; notice?: string };

    // Accepter d'envoyer ses données à un service ne vaut pas acceptation
    // pour un autre.
    expect(updated.llm.consent).toBe(false);
    expect(updated.notice).toContain('réinitialisé');
  });
});

describeApi('journal d’audit', () => {
  beforeEach(seedUser);

  it('trace les actions et ne contient aucune donnée personnelle', async () => {
    await harness.request('PUT', '/profile', TEST_PROFILE);
    await harness.request('PUT', '/profile/sensitive', {
      key: 'work_authorization',
      state: 'answered',
      value: 'Citoyenne canadienne',
    });

    const audit = (await harness.request('GET', '/audit')).body as {
      total: number;
      events: Array<{ action: string; label: string }>;
    };

    expect(audit.total).toBeGreaterThan(1);
    expect(audit.events.some((event) => event.action === 'sensitive_answer.updated')).toBe(true);

    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain('Citoyenne canadienne');
    expect(serialized).not.toContain('camille@exemple-fictif.test');
  });
});
