import { describe, expect, it } from 'vitest';
import { allowedKeywordsForDocuments, analyzeKeywordGap } from './keywordGap.js';
import { makeJob, makeProfile } from '../testing/fixtures.js';

/**
 * Ces tests protègent la barrière anti-hallucination du produit.
 * Toute régression ici signifie que Boussole peut écrire dans un CV une
 * compétence que le candidat ne possède pas. À traiter comme un incident.
 */

describe('analyzeKeywordGap — classification', () => {
  it('marque comme couvertes les compétences présentes des deux côtés', () => {
    const report = analyzeKeywordGap(makeJob(), makeProfile());
    const typescript = report.items.find((i) => i.keyword === 'TypeScript');
    expect(typescript?.status).toBe('matched');
  });

  it('marque comme écart réel une exigence absente du profil', () => {
    const job = makeJob({
      descriptionRaw:
        '<h3>Exigences</h3><ul><li>Maîtrise de Kubernetes et Terraform en production.</li></ul>',
    });
    const report = analyzeKeywordGap(job, makeProfile());
    const terraform = report.items.find((i) => i.keyword === 'Terraform');
    expect(terraform?.status).toBe('not_in_profile');
  });

  it('distingue « absente du CV » de « absente du profil »', () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Expérience avec Docker exigée.</li></ul>',
    });
    // Le CV courant ne mentionne pas Docker, mais le profil si.
    const report = analyzeKeywordGap(job, makeProfile(), {
      currentCvText: 'Développeuse full-stack. TypeScript, React, Node.js, PostgreSQL.',
    });
    const docker = report.items.find((i) => i.keyword === 'Docker');
    expect(docker?.status).toBe('missing_from_cv');
    expect(docker?.profileEvidence).toBeTruthy();
  });
});

describe('analyzeKeywordGap — barrière anti-hallucination', () => {
  it('n’autorise jamais l’ajout d’une compétence absente du profil', () => {
    const job = makeJob({
      descriptionRaw:
        '<h3>Exigences</h3><ul><li>Kubernetes, Terraform, Scala et Salesforce exigés.</li></ul>',
    });
    const report = analyzeKeywordGap(job, makeProfile(), { currentCvText: 'CV minimal.' });
    const allowed = allowedKeywordsForDocuments(report);

    for (const gap of report.realGaps) {
      expect(allowed).not.toContain(gap.keyword);
    }
    expect(allowed.length + report.realGaps.length).toBeGreaterThan(0);
  });

  it('n’autorise que des compétences réellement détenues', () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Docker, AWS, Terraform et Scala requis.</li></ul>',
    });
    const report = analyzeKeywordGap(job, makeProfile(), {
      currentCvText: 'CV sans technologies.',
    });
    const profileSkills = makeProfile().skills.map((s) => s.name);

    for (const keyword of allowedKeywordsForDocuments(report)) {
      // Chaque mot-clé injectable doit être adossé à une preuve dans le profil.
      const item = report.items.find((i) => i.keyword === keyword);
      expect(item?.profileEvidence).toBeTruthy();
      const known =
        profileSkills.includes(keyword) ||
        makeProfile().experiences.some((e) => e.skills.includes(keyword)) ||
        makeProfile().projects.some((p) => p.skills.includes(keyword));
      expect(known).toBe(true);
    }
  });

  it('accompagne chaque écart réel d’un conseil qui interdit l’ajout au CV', () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Terraform obligatoire.</li></ul>',
    });
    const report = analyzeKeywordGap(job, makeProfile());
    for (const gap of report.realGaps) {
      expect(gap.advice.toLowerCase()).toContain('ne pas');
    }
  });
});

describe('analyzeKeywordGap — couverture', () => {
  it('calcule une couverture bornée entre 0 et 1', () => {
    const report = analyzeKeywordGap(makeJob(), makeProfile());
    expect(report.coverage).toBeGreaterThanOrEqual(0);
    expect(report.coverage).toBeLessThanOrEqual(1);
    expect(report.requiredCoverage).toBeGreaterThanOrEqual(0);
    expect(report.requiredCoverage).toBeLessThanOrEqual(1);
  });

  it('ne prétend pas à une couverture parfaite sans exigence identifiée', () => {
    // Sans exigence détectable, retourner 1 laisserait croire à une
    // adéquation parfaite alors qu'on ne sait simplement rien.
    const job = makeJob({ descriptionRaw: '<p>Un texte sans structure ni exigence.</p>' });
    const report = analyzeKeywordGap(job, makeProfile());
    expect(report.requiredCoverage).toBe(0);
  });

  it('sépare les trois catégories sans recouvrement', () => {
    const report = analyzeKeywordGap(makeJob(), makeProfile(), { currentCvText: 'CV court.' });
    const total = report.matched.length + report.safeToAdd.length + report.realGaps.length;
    expect(total).toBe(report.items.length);
  });
});
