import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeJob } from '@boussole/core';
import { greenhouseConnector } from './greenhouse.js';
import { leverConnector } from './lever.js';
import { ashbyConnector } from './ashby.js';
import { personioConnector } from './personio.js';
import { getConnector, listConnectors } from './index.js';
import { resetRateLimitState } from './http.js';
import { loadFixture, mockFetch, testContext } from './testing/mockFetch.js';

beforeEach(() => {
  // La limitation de débit est un état global par hôte : sans remise à zéro,
  // les tests s'attendraient mutuellement.
  resetRateLimitState();
});

describe('greenhouseConnector', () => {
  it('interroge le bon endpoint public', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));

    expect(mock.calls[0]?.url).toBe(
      'https://boards-api.greenhouse.io/v1/boards/northwindfictif/jobs?content=true',
    );
  });

  it('extrait les offres valides', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));

    expect(result.fetched).toBe(3);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]?.title).toBe('Senior Full-Stack Developer');
    expect(result.jobs[0]?.sourceJobId).toBe('4012345');
    expect(result.jobs[0]?.companyName).toBe('Northwind Technologies Inc.');
    expect(result.jobs[0]?.department).toBe('Engineering');
  });

  it('décode une seule fois le HTML encodé en entités', async () => {
    // Piège spécifique à Greenhouse : sans décodage, la description arrive
    // comme un bloc de texte contenant « &lt;p&gt; » littéralement.
    //
    // Un seul décodage, volontairement : il transforme le HTML échappé en
    // HTML. Les entités qui subsistent (« &#39; ») font partie de ce HTML et
    // relèvent de `htmlToText`. Décoder deux fois abîmerait une description
    // qui cite légitimement « &lt;script&gt; » comme texte.
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));

    expect(result.jobs[0]?.descriptionRaw).toContain('<h3>Exigences</h3>');
    expect(result.jobs[0]?.descriptionRaw).not.toContain('&lt;');
  });

  it('restitue l’apostrophe une fois la description convertie en texte', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));
    const normalized = normalizeJob(result.jobs[0]!, { now: new Date('2026-03-01T00:00:00Z') });

    expect(normalized.descriptionText).toContain("d'expérience");
    expect(normalized.descriptionText).not.toContain('&#39;');
  });

  it('se rabat sur les bureaux quand la localisation est absente', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));
    expect(result.jobs[1]?.locationRaw).toBe('Montréal; Québec');
  });

  it('signale les offres malformées sans interrompre l’ingestion', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));
    expect(result.warnings).toHaveLength(1);
    expect(result.jobs.length).toBeGreaterThan(0);
  });

  it('produit des offres normalisables', async () => {
    const mock = mockFetch(loadFixture('greenhouse.json'));
    const result = await greenhouseConnector.fetchJobs('northwindfictif', testContext(mock.fetch));
    const rawJob = result.jobs[0];
    expect(rawJob).toBeDefined();

    const normalized = normalizeJob(rawJob!, { now: new Date('2026-03-01T00:00:00Z') });
    expect(normalized.seniority).toBe('senior');
    expect(normalized.locations[0]?.city).toBe('Montréal');
    expect(normalized.salary?.min).toBe(110000);
    expect(normalized.sections.requirements.length).toBeGreaterThan(0);
  });
});

describe('leverConnector', () => {
  it('interroge le bon endpoint public', async () => {
    const mock = mockFetch(loadFixture('lever.json'));
    await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    expect(mock.calls[0]?.url).toBe('https://api.lever.co/v0/postings/lumenfictif?mode=json');
  });

  it('reconstitue la description à partir des listes', async () => {
    // Ne lire que `description` ferait perdre les exigences, qui vivent
    // presque toujours dans `lists`.
    const mock = mockFetch(loadFixture('lever.json'));
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    const description = result.jobs[0]?.descriptionRaw ?? '';

    expect(description).toContain('<h3>Exigences</h3>');
    expect(description).toContain('5 ans en Node.js');
    expect(description).toContain('<h3>Responsabilités</h3>');
    expect(description).toContain('assurance collective');
  });

  it('reprend le salaire structuré tel quel', async () => {
    const mock = mockFetch(loadFixture('lever.json'));
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));

    expect(result.jobs[0]?.salary).toEqual({
      min: 105000,
      max: 130000,
      currency: 'CAD',
      period: 'year',
      confidence: 'high',
    });
  });

  it('ignore une fourchette salariale vide', async () => {
    const mock = mockFetch(loadFixture('lever.json'));
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    expect(result.jobs[1]?.salary).toBeUndefined();
  });

  it('regroupe toutes les localisations', async () => {
    const mock = mockFetch(loadFixture('lever.json'));
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    expect(result.jobs[0]?.locationRaw).toBe('Montréal; Québec');
  });

  it('se rabat sur la description brute sans blocs HTML', async () => {
    const mock = mockFetch(loadFixture('lever.json'));
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    expect(result.jobs[1]?.descriptionRaw).toContain('entièrement à distance');
  });

  it('rejette une réponse qui n’est pas un tableau', async () => {
    const mock = mockFetch('{"error":"nope"}');
    const result = await leverConnector.fetchJobs('lumenfictif', testContext(mock.fetch));
    expect(result.jobs).toEqual([]);
    expect(result.warnings[0]).toContain('inattendue');
  });
});

describe('ashbyConnector', () => {
  it('interroge le bon endpoint public', async () => {
    const mock = mockFetch(loadFixture('ashby.json'));
    await ashbyConnector.fetchJobs('borealfictif', testContext(mock.fetch));
    expect(mock.calls[0]?.url).toBe(
      'https://api.ashbyhq.com/posting-api/job-board/borealfictif?includeCompensation=true',
    );
  });

  it('ignore les offres retirées du tableau public', async () => {
    // Les présenter enverrait le candidat vers une page morte.
    const mock = mockFetch(loadFixture('ashby.json'));
    const result = await ashbyConnector.fetchJobs('borealfictif', testContext(mock.fetch));

    expect(result.jobs.map((j) => j.title)).not.toContain('Poste retiré du tableau');
    expect(result.warnings.join(' ')).toContain('non publiées');
  });

  it('transmet le signal structuré de télétravail', async () => {
    const mock = mockFetch(loadFixture('ashby.json'));
    const result = await ashbyConnector.fetchJobs('borealfictif', testContext(mock.fetch));
    expect(result.jobs[0]?.locationRaw).toContain('Remote');

    const normalized = normalizeJob(result.jobs[0]!, { now: new Date('2026-03-01T00:00:00Z') });
    expect(normalized.remotePolicy).toBe('remote');
    expect(normalized.remoteConfidence).toBe('high');
  });

  it('ne retient que la composante salariale de la rémunération', async () => {
    // Additionner actions et primes produirait un chiffre jamais annoncé.
    const mock = mockFetch(loadFixture('ashby.json'));
    const result = await ashbyConnector.fetchJobs('borealfictif', testContext(mock.fetch));

    expect(result.jobs[0]?.salary).toEqual({
      min: 120000,
      max: 145000,
      currency: 'CAD',
      period: 'year',
      confidence: 'high',
    });
  });

  it('n’invente pas de salaire quand aucun n’est publié', async () => {
    const mock = mockFetch(loadFixture('ashby.json'));
    const result = await ashbyConnector.fetchJobs('borealfictif', testContext(mock.fetch));
    const admin = result.jobs.find((j) => j.title === 'Adjointe administrative');
    expect(admin?.salary).toBeUndefined();
  });
});

describe('personioConnector', () => {
  it('interroge le bon flux public', async () => {
    const mock = mockFetch(loadFixture('personio.xml'));
    await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));
    expect(mock.calls[0]?.url).toBe('https://cartierfictif.jobs.personio.de/xml');
  });

  it('analyse le flux XML et ses sections CDATA', async () => {
    const mock = mockFetch(loadFixture('personio.xml'));
    const result = await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]?.title).toBe('Développeur intégration');
    expect(result.jobs[0]?.companyName).toBe('Groupe Cartier Fictif');
    expect(result.jobs[0]?.locationRaw).toBe('Montréal');
  });

  it('reconstitue les blocs de description en en-têtes', async () => {
    const mock = mockFetch(loadFixture('personio.xml'));
    const result = await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));
    const description = result.jobs[0]?.descriptionRaw ?? '';

    expect(description).toContain('<h3>Tâches</h3>');
    expect(description).toContain('<h3>Exigences</h3>');
    expect(description).toContain("3 ans d'expérience en Java ou Python");
  });

  it('ne produit jamais « [object Object] » pour une balise vide', async () => {
    // Les balises XML vides deviennent `{}` : les traiter comme des chaînes
    // insérerait « [object Object] » directement dans les offres.
    const mock = mockFetch(loadFixture('personio.xml'));
    const result = await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));

    const serialized = JSON.stringify(result.jobs);
    expect(serialized).not.toContain('object Object');
    expect(result.jobs[1]?.companyName).toBe('cartierfictif');
    expect(result.jobs[1]?.department).toBeUndefined();
  });

  it('signale un flux illisible sans planter', async () => {
    const mock = mockFetch('<<< pas du xml >>>');
    const result = await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));
    expect(result.jobs).toEqual([]);
  });

  it('produit des offres normalisables', async () => {
    const mock = mockFetch(loadFixture('personio.xml'));
    const result = await personioConnector.fetchJobs('cartierfictif', testContext(mock.fetch));
    const normalized = normalizeJob(result.jobs[0]!, { now: new Date('2026-03-01T00:00:00Z') });

    expect(normalized.sections.requirements.length).toBeGreaterThan(0);
    expect(normalized.employmentType).toBe('full_time');
  });
});

describe('registre', () => {
  it('expose les quatre connecteurs', () => {
    expect(
      listConnectors()
        .map((c) => c.id)
        .sort(),
    ).toEqual(['ashby', 'greenhouse', 'lever', 'personio']);
  });

  it('résout un connecteur par identifiant', () => {
    expect(getConnector('lever')?.label).toBe('Lever');
    expect(getConnector('workday')).toBeUndefined();
  });

  it('documente chaque connecteur pour l’interface de configuration', () => {
    for (const connector of listConnectors()) {
      expect(connector.boardHint.length).toBeGreaterThan(10);
      expect(connector.apiDocsUrl).toMatch(/^https:\/\//);
    }
  });
});
