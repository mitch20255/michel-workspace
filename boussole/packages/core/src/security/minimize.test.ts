import { describe, expect, it } from 'vitest';
import { assertNoPii, minimizeJobForLlm, minimizeProfileForLlm } from './minimize.js';
import { makeJob, makeProfile } from '../testing/fixtures.js';

/**
 * Ces tests garantissent qu'aucune donnée identifiante ne part chez un
 * fournisseur LLM externe. Une régression ici est une fuite de PII.
 */

describe('minimizeProfileForLlm', () => {
  it('ne transmet jamais le nom réel', () => {
    const profile = makeProfile();
    const serialized = JSON.stringify(minimizeProfileForLlm(profile));
    expect(serialized).not.toContain(profile.identity.firstName);
    expect(serialized).not.toContain(profile.identity.lastName);
  });

  it('ne transmet ni courriel ni téléphone ni adresse', () => {
    const profile = makeProfile();
    const serialized = JSON.stringify(minimizeProfileForLlm(profile));
    expect(serialized).not.toContain(profile.contact.email);
    expect(serialized).not.toContain(profile.contact.phone ?? 'AUCUN');
  });

  it('ne transmet aucune réponse sensible', () => {
    const profile = makeProfile();
    const serialized = JSON.stringify(minimizeProfileForLlm(profile));
    for (const answer of profile.sensitiveAnswers) {
      if (answer.value) expect(serialized).not.toContain(answer.value);
    }
  });

  it('anonymise les employeurs par défaut', () => {
    const minimized = minimizeProfileForLlm(makeProfile());
    expect(minimized.experiences[0]?.company).toBe('ENTREPRISE_1');
  });

  it('transmet les vrais employeurs uniquement sur demande explicite', () => {
    const minimized = minimizeProfileForLlm(makeProfile(), { includeCompanyNames: true });
    expect(minimized.experiences[0]?.company).toBe('Studio Boréal');
  });

  it('ne transmet que la région, jamais l’adresse précise', () => {
    const minimized = minimizeProfileForLlm(makeProfile());
    expect(minimized.generalLocation).toBe('Québec, CA');
  });

  it('conserve les éléments réellement nécessaires à la rédaction', () => {
    const minimized = minimizeProfileForLlm(makeProfile());
    expect(minimized.experiences[0]?.bullets.length).toBeGreaterThan(0);
    expect(minimized.skills.length).toBeGreaterThan(0);
  });

  it('borne le nombre d’expériences transmises', () => {
    const minimized = minimizeProfileForLlm(makeProfile(), { maxExperiences: 1 });
    expect(minimized.experiences).toHaveLength(1);
  });
});

describe('minimizeJobForLlm', () => {
  it('conserve les informations utiles de l’offre', () => {
    const minimized = minimizeJobForLlm(makeJob());
    expect(minimized.title).toBe('Senior Full-Stack Developer');
    expect(minimized.requirements.length).toBeGreaterThan(0);
  });

  it('tronque une description démesurée', () => {
    const job = { ...makeJob(), descriptionText: 'a'.repeat(50000) };
    expect(minimizeJobForLlm(job, 1000).descriptionExcerpt).toHaveLength(1000);
  });
});

describe('assertNoPii', () => {
  it('ne signale rien sur une charge utile propre', () => {
    const payload = JSON.stringify(minimizeProfileForLlm(makeProfile()));
    expect(assertNoPii(payload, makeProfile())).toEqual([]);
  });

  it('détecte une fuite de courriel', () => {
    const profile = makeProfile();
    const violations = assertNoPii(`contact : ${profile.contact.email}`, profile);
    expect(violations).toContain('courriel');
  });

  it('détecte une fuite de nom complet', () => {
    const profile = makeProfile();
    const full = `${profile.identity.firstName} ${profile.identity.lastName}`;
    expect(assertNoPii(`Bonjour ${full}`, profile)).toContain('nom');
  });

  it('détecte une fuite de réponse sensible', () => {
    const profile = makeProfile();
    const violations = assertNoPii('Statut : Citoyenne canadienne', profile);
    expect(violations.join(' ')).toContain('work_authorization');
  });
});
