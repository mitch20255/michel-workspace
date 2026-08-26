import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '@boussole/core';
import { makeJob, makeProfile } from '@boussole/core/testing';
import { analyzeKeywordGap } from '@boussole/core';
import { LlmGateway, getProvider, listProviders } from './gateway.js';
import {
  LlmConsentError,
  LlmDisabledError,
  LlmPayloadTooLargeError,
  LlmPiiLeakError,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmRequest,
} from './types.js';
import { buildDeterministicPrep, buildInterviewPrep } from './usecases/interviewPrep.js';

/**
 * Ces tests protègent la promesse de confidentialité du produit : rien ne part
 * sans fournisseur actif, sans consentement explicite, et jamais avec des
 * données identifiantes.
 */

/** Fournisseur factice : enregistre ce qu'on a tenté d'envoyer. */
function fakeProvider(overrides: Partial<Omit<LlmProvider, 'complete'>> = {}) {
  const calls: Array<{ request: LlmRequest; config: LlmProviderConfig }> = [];
  const identity = {
    id: 'openai' as const,
    label: 'Faux fournisseur',
    local: false,
    defaultModel: 'faux-modele',
    ...overrides,
  };

  const provider: LlmProvider = {
    ...identity,
    complete: async (request, config) => {
      calls.push({ request, config });
      return {
        text: 'Q: Une question ?\nPourquoi: Parce que.',
        model: identity.defaultModel,
        provider: identity.id,
        // La réponse doit refléter le fournisseur déclaré : c'est elle que la
        // passerelle journalise, et un écart entre les deux masquerait un bug.
        local: identity.local,
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
  };
  return { provider, calls };
}

function gatewayWith(options: Partial<ConstructorParameters<typeof LlmGateway>[0]> = {}): {
  gateway: LlmGateway;
  audits: AuditEvent[];
} {
  const audits: AuditEvent[] = [];
  const gateway = new LlmGateway({
    provider: 'none',
    consent: false,
    profile: makeProfile(),
    onAudit: (event) => {
      audits.push(event);
    },
    ...options,
  });
  return { gateway, audits };
}

const REQUEST: LlmRequest = {
  purpose: 'interview_questions',
  messages: [{ role: 'user', content: 'Une question anodine sur un poste de développement.' }],
};

describe('LlmGateway — fournisseur désactivé', () => {
  it('est désactivée par défaut', () => {
    const { gateway } = gatewayWith();
    expect(gateway.isEnabled()).toBe(false);
    expect(gateway.unavailableReason()).toContain('Aucun fournisseur');
  });

  it('refuse tout appel et l’explique', async () => {
    const { gateway } = gatewayWith();
    await expect(gateway.complete(REQUEST)).rejects.toBeInstanceOf(LlmDisabledError);
  });

  it('journalise le blocage', async () => {
    const { gateway, audits } = gatewayWith();
    await gateway.complete(REQUEST).catch(() => undefined);

    expect(audits[0]?.action).toBe('llm.disabled_by_policy');
    expect(audits[0]?.metadata.reason).toBe('provider_none');
  });
});

describe('LlmGateway — consentement', () => {
  it('refuse un fournisseur distant sans consentement, même avec une clé valide', async () => {
    // Configurer une clé ne vaut pas accord pour envoyer ses données.
    const { gateway } = gatewayWith({ provider: 'openai', apiKey: 'cle-test', consent: false });

    expect(gateway.isEnabled()).toBe(false);
    await expect(gateway.complete(REQUEST)).rejects.toBeInstanceOf(LlmConsentError);
  });

  it('n’exige pas de consentement pour un fournisseur local', () => {
    // Rien ne sort de la machine : exiger un consentement serait du théâtre.
    const { gateway } = gatewayWith({ provider: 'ollama', consent: false });
    expect(gateway.isEnabled()).toBe(true);
    expect(gateway.unavailableReason()).toBeUndefined();
  });
});

describe('LlmGateway — protection des données', () => {
  it('bloque un envoi contenant une donnée identifiante', async () => {
    const profile = makeProfile();
    const { gateway } = gatewayWith({ provider: 'ollama', profile, consent: true });

    await expect(
      gateway.complete({
        purpose: 'interview_questions',
        messages: [{ role: 'user', content: `Contacter ${profile.contact.email}` }],
      }),
    ).rejects.toBeInstanceOf(LlmPiiLeakError);
  });

  it('bloque aussi une réponse sensible', async () => {
    const { gateway } = gatewayWith({ provider: 'ollama', consent: true });

    await expect(
      gateway.complete({
        purpose: 'interview_questions',
        messages: [{ role: 'user', content: 'Statut : Citoyenne canadienne' }],
      }),
    ).rejects.toBeInstanceOf(LlmPiiLeakError);
  });

  it('applique le contrôle même en local', async () => {
    // Le contrôle coûte quelques microsecondes et évite qu'une habitude
    // dangereuse s'installe pendant le développement.
    const { gateway, audits } = gatewayWith({ provider: 'ollama', consent: true });
    await gateway
      .complete({
        purpose: 'interview_questions',
        messages: [{ role: 'user', content: makeProfile().contact.email }],
      })
      .catch(() => undefined);

    expect(audits.some((event) => event.metadata.reason === 'pii_detected')).toBe(true);
  });

  it('ne journalise jamais les valeurs détectées, seulement les catégories', async () => {
    const profile = makeProfile();
    const { gateway, audits } = gatewayWith({ provider: 'ollama', profile, consent: true });
    await gateway
      .complete({
        purpose: 'interview_questions',
        messages: [{ role: 'user', content: profile.contact.email }],
      })
      .catch(() => undefined);

    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain(profile.contact.email);
    expect(serialized).toContain('pii_detected');
  });

  it('refuse un prompt démesuré', async () => {
    const { gateway } = gatewayWith({
      provider: 'ollama',
      consent: true,
      maxPromptChars: 100,
    });

    await expect(
      gateway.complete({
        purpose: 'interview_questions',
        messages: [{ role: 'user', content: 'a'.repeat(500) }],
      }),
    ).rejects.toBeInstanceOf(LlmPayloadTooLargeError);
  });
});

describe('LlmGateway — appels réussis', () => {
  it('transmet la requête au fournisseur résolu', async () => {
    const { provider, calls } = fakeProvider();
    const { gateway } = gatewayWith({
      provider: 'openai',
      apiKey: 'cle-test',
      consent: true,
      providers: { openai: provider },
    });

    const response = await gateway.complete(REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.request.purpose).toBe('interview_questions');
    expect(response.text).toContain('Q:');
  });

  it('journalise usage, fournisseur et jetons', async () => {
    const { provider } = fakeProvider();
    const { gateway, audits } = gatewayWith({
      provider: 'openai',
      apiKey: 'cle-test',
      consent: true,
      providers: { openai: provider },
    });

    await gateway.complete(REQUEST);

    const event = audits.find((entry) => entry.action === 'llm.request');
    expect(event?.metadata.provider).toBe('openai');
    expect(event?.metadata.purpose).toBe('interview_questions');
    expect(event?.metadata.outputTokens).toBe(5);
    expect(event?.summary).toContain('interview_questions');
  });

  it('ne journalise jamais le contenu du prompt', async () => {
    // Un journal d'audit qui contient les prompts est une copie intégrale du
    // profil sous un autre nom.
    const { provider } = fakeProvider();
    const { gateway, audits } = gatewayWith({
      provider: 'openai',
      apiKey: 'cle-test',
      consent: true,
      providers: { openai: provider },
    });

    await gateway.complete(REQUEST);

    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain('anodine');
    expect(serialized).not.toContain('cle-test');
  });

  it('signale un traitement local dans le résumé d’audit', async () => {
    const { provider } = fakeProvider({ id: 'ollama', local: true });
    const { gateway, audits } = gatewayWith({
      provider: 'ollama',
      consent: false,
      providers: { ollama: provider },
    });

    await gateway.complete(REQUEST);
    expect(audits.find((entry) => entry.action === 'llm.request')?.summary).toContain('en local');
  });
});

describe('registre des fournisseurs', () => {
  it('expose les trois fournisseurs implémentés', () => {
    expect(
      listProviders()
        .map((provider) => provider.id)
        .sort(),
    ).toEqual(['anthropic', 'ollama', 'openai']);
  });

  it('ne résout pas « none » vers un fournisseur', () => {
    expect(getProvider('none')).toBeUndefined();
  });

  it('marque Ollama comme local et les autres comme distants', () => {
    expect(getProvider('ollama')?.local).toBe(true);
    expect(getProvider('anthropic')?.local).toBe(false);
    expect(getProvider('openai')?.local).toBe(false);
  });
});

describe('préparation d’entretien déterministe', () => {
  it('fonctionne sans aucun modèle de langage', () => {
    const prep = buildDeterministicPrep(makeJob(), makeProfile());

    expect(prep.questions.length).toBeGreaterThan(3);
    expect(prep.questionsToAsk.length).toBeGreaterThan(2);
    expect(prep.checklist.length).toBeGreaterThan(3);
    expect(prep.enhancedByLlm).toBe(false);
  });

  it('dérive des questions des exigences de l’offre', () => {
    const prep = buildDeterministicPrep(makeJob(), makeProfile());
    expect(prep.questions.some((question) => question.origin === 'requirement')).toBe(true);
  });

  it('prépare les écarts réels sans suggérer de mentir', () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Terraform et Scala obligatoires.</li></ul>',
    });
    const gap = analyzeKeywordGap(job, makeProfile());
    const prep = buildDeterministicPrep(job, makeProfile(), gap);

    const gapQuestions = prep.questions.filter((question) => question.origin === 'gap');
    expect(gapQuestions.length).toBeGreaterThan(0);
    expect(gapQuestions[0]?.talkingPoints.join(' ')).toContain('sans exagérer');
  });

  it('signale une offre au score fantôme élevé comme point de vigilance', () => {
    const job = { ...makeJob(), ghostScore: 70 };
    const prep = buildDeterministicPrep(job, makeProfile());
    expect(prep.risks.join(' ')).toContain('fantôme');
  });

  it('adapte les questions à poser selon ce que l’offre ne dit pas', () => {
    const job = makeJob({ descriptionRaw: '<p>Une annonce sans salaire ni mode de travail.</p>' });
    const prep = buildDeterministicPrep(job, makeProfile());
    expect(prep.questionsToAsk.join(' ')).toContain('fourchette salariale');
  });

  it('rappelle la trame STAR sans rédiger la réponse à la place du candidat', () => {
    const prep = buildDeterministicPrep(makeJob(), makeProfile());
    const points = prep.questions[0]?.talkingPoints.join(' ') ?? '';
    expect(points).toContain('Situation');
    expect(points).toContain('Résultat');
  });
});

describe('préparation d’entretien avec modèle', () => {
  it('retourne le socle déterministe quand le modèle est désactivé', async () => {
    const { gateway } = gatewayWith();
    const prep = await buildInterviewPrep(makeJob(), makeProfile(), gateway);

    // L'utilisateur garde la fonctionnalité, pas un bouton grisé.
    expect(prep.questions.length).toBeGreaterThan(3);
    expect(prep.enhancedByLlm).toBe(false);
    expect(prep.llmUnavailableReason).toContain('Aucun fournisseur');
  });

  it('n’échoue pas quand le modèle tombe en panne', async () => {
    const gateway = new LlmGateway({
      provider: 'ollama',
      consent: true,
      profile: makeProfile(),
      baseUrl: 'http://127.0.0.1:1',
      timeoutMs: 300,
    });

    const prep = await buildInterviewPrep(makeJob(), makeProfile(), gateway);
    expect(prep.questions.length).toBeGreaterThan(3);
    expect(prep.enhancedByLlm).toBe(false);
    expect(prep.llmUnavailableReason).toBeTruthy();
  });
});
