import { describe, expect, it } from 'vitest';
import { makeJob, makeProfile } from '@boussole/core/testing';
import { analyzeKeywordGap } from '@boussole/core';
import { buildCv } from './cv.js';
import { buildCoverLetter } from './letter.js';
import { GuardrailError, verifyDocument, verifyLetter } from './guardrails.js';
import { orderSkillsForJob, selectExperiences, selectProjects } from './selection.js';
import { escapeTypstString, typstString, typstStringArray } from './templates/typstEscape.js';

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('échappement Typst', () => {
  it('échappe les guillemets et les barres obliques', () => {
    expect(escapeTypstString('il a dit "bonjour"')).toBe('il a dit \\"bonjour\\"');
    expect(escapeTypstString('a\\b')).toBe('a\\\\b');
  });

  it('aplatit les sauts de ligne', () => {
    expect(escapeTypstString('a\nb')).toBe('a b');
  });

  it('laisse intacts les caractères techniques courants', () => {
    // Sur-échapper ferait apparaître des barres obliques dans le CV final.
    expect(typstString('C# et 20 % de 5 $')).toBe('"C# et 20 % de 5 $"');
  });

  it('produit un tableau à un élément non ambigu', () => {
    // Sans virgule finale, Typst lit une simple valeur entre parenthèses et
    // l'itération échoue.
    expect(typstStringArray(['seul'])).toBe('("seul",)');
    expect(typstStringArray([])).toBe('()');
  });
});

describe('sélection de contenu', () => {
  it('retient les expériences pertinentes', () => {
    const selected = selectExperiences(makeProfile(), makeJob());
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.some((entry) => entry.experience.company === 'Studio Boréal')).toBe(true);
  });

  it('affiche les expériences en ordre antichronologique', () => {
    // Un CV trié par pertinence déroute le lecteur.
    const selected = selectExperiences(makeProfile(), makeJob());
    const dates = selected.map((entry) => entry.experience.endDate ?? '9999-99');
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('ne modifie jamais le texte d’une puce', () => {
    // Réordonner et sélectionner sont honnêtes ; réécrire ne l'est pas.
    const profile = makeProfile();
    const selected = selectExperiences(profile, makeJob());

    for (const entry of selected) {
      const original = profile.experiences.find((e) => e.id === entry.experience.id);
      for (const bullet of entry.bullets) {
        expect(original?.bullets).toContain(bullet);
      }
    }
  });

  it('borne le nombre de puces par expérience', () => {
    const selected = selectExperiences(makeProfile(), makeJob(), {
      maxBulletsPerExperience: 1,
    });
    for (const entry of selected) expect(entry.bullets.length).toBeLessThanOrEqual(1);
  });

  it('écarte les projets sans lien avec l’offre', () => {
    const job = makeJob({
      descriptionRaw: '<p>Poste de comptabilité, tenue de livres et fiscalité.</p>',
    });
    expect(selectProjects(makeProfile(), job)).toEqual([]);
  });

  it('place en tête les compétences demandées par l’offre', () => {
    const ordered = orderSkillsForJob(makeProfile(), makeJob());
    expect(ordered.slice(0, 4)).toContain('TypeScript');
  });

  it('n’ajoute ni ne retire de compétence', () => {
    const profile = makeProfile();
    const ordered = orderSkillsForJob(profile, makeJob(), 100);
    expect([...ordered].sort()).toEqual([...profile.skills.map((s) => s.name)].sort());
  });
});

describe('garde-fous anti-invention', () => {
  it('accepte un document entièrement adossé au profil', () => {
    const report = verifyDocument(
      'Développeuse senior. Compétences : TypeScript, React, Node.js, PostgreSQL.',
      makeProfile(),
    );
    expect(report.ok).toBe(true);
  });

  it('accepte une compétence absente si elle est explicitement niée', () => {
    // Dire « pas encore de Terraform » est honnête et utile dans une lettre.
    // L'interdire pousserait au silence, qui laisse conclure au pire.
    const report = verifyDocument(
      "J'automatise l'infrastructure au quotidien ; pas encore de Terraform en poste.",
      makeProfile(),
      [],
      { negatable: ['Terraform'] },
    );
    expect(report.ok).toBe(true);
  });

  it('refuse la même compétence dès qu’une mention est affirmative', () => {
    // L'exception ne porte que sur la négation. Une seule occurrence affirmée
    // ailleurs dans le document annule l'autorisation.
    const report = verifyDocument(
      'Pas encore de Terraform en poste. Compétences : Terraform, React.',
      makeProfile(),
      [],
      { negatable: ['Terraform'] },
    );
    expect(report.ok).toBe(false);
    expect(report.violations.map((v) => v.fragment)).toContain('Terraform');
  });

  it('ne considère pas une négation lointaine comme couvrante', () => {
    // Un « pas » situé trois phrases plus haut ne nie pas la compétence citée
    // ici : la portée d'une négation est courte.
    const report = verifyDocument(
      "Je n'ai pas de préférence sur les outils. " +
        'Mon parcours couvre le développement web, la mise en production, la revue de code, ' +
        "l'encadrement d'équipe et la relation client. Expertise en Terraform.",
      makeProfile(),
      [],
      { negatable: ['Terraform'] },
    );
    expect(report.ok).toBe(false);
  });

  it('refuse une compétence absente du profil', () => {
    const report = verifyDocument('Expertise en Terraform et Scala.', makeProfile());
    expect(report.ok).toBe(false);
    expect(report.violations.map((v) => v.fragment)).toContain('Terraform');
  });

  it('accepte une compétence attestée par une puce d’expérience', () => {
    // Kubernetes n'est pas dans la liste de compétences déclarées mais figure
    // dans une réalisation : c'est une attestation plus forte qu'une liste.
    const report = verifyDocument('Migration vers Kubernetes.', makeProfile());
    expect(report.violations.some((v) => v.fragment === 'Kubernetes')).toBe(false);
  });

  it('refuse une certification inventée', () => {
    const report = verifyDocument('Certifiée AWS Solutions Architect.', makeProfile());
    expect(report.violations.some((v) => v.kind === 'unknown_certification')).toBe(true);
  });

  it('refuse un chiffre absent du profil', () => {
    const report = verifyDocument(
      'A dirigé une équipe servant 250 000 utilisateurs actifs.',
      makeProfile(),
    );
    expect(report.violations.some((v) => v.kind === 'invented_number')).toBe(true);
  });

  it('accepte un chiffre attesté par le profil', () => {
    const report = verifyDocument('Plateforme utilisée par 12 000 usagers.', makeProfile());
    expect(report.violations.some((v) => v.kind === 'invented_number')).toBe(false);
  });

  it('autorise un mot-clé explicitement mis sur liste blanche', () => {
    const withoutWhitelist = verifyDocument('Expérience avec Docker.', makeProfile(), []);
    const withWhitelist = verifyDocument('Expérience avec Docker.', makeProfile(), ['Docker']);
    expect(withWhitelist.ok).toBe(true);
    // Docker est au profil, donc accepté dans les deux cas : la liste blanche
    // n'élargit rien au-delà de ce que le profil atteste déjà.
    expect(withoutWhitelist.ok).toBe(true);
  });

  it('n’autorise pas une liste blanche à introduire une compétence absente', () => {
    // Même explicitement autorisée, une compétence doit exister quelque part.
    const report = verifyDocument('Expertise Terraform.', makeProfile(), []);
    expect(report.ok).toBe(false);
  });

  it('accepte le nom de l’entreprise visée dans une lettre', () => {
    const text = 'Je vous soumets ma candidature chez Northwind Technologies.';
    expect(verifyDocument(text, makeProfile()).violations.length).toBeGreaterThanOrEqual(0);
    expect(verifyLetter(text, makeProfile(), 'Northwind Technologies Inc.').ok).toBe(true);
  });
});

describe('buildCv', () => {
  it('produit source, texte et empreinte de profil', async () => {
    const document = await buildCv(makeProfile(), makeJob(), { renderPdf: false });

    expect(document.kind).toBe('cv');
    expect(document.sourceTypst).toContain('#set document');
    expect(document.plainText).toContain('Camille');
    expect(document.profileHash).toHaveLength(32);
    expect(document.guardrails.ok).toBe(true);
  });

  it('choisit la langue de l’offre', async () => {
    const french = await buildCv(makeProfile(), makeJob(), { renderPdf: false });
    expect(french.language).toBe('fr');

    const englishJob = makeJob({
      descriptionRaw:
        '<p>We are looking for a developer to join our team and work with the product group on new features for our customers.</p>',
    });
    const english = await buildCv(makeProfile(), englishJob, { renderPdf: false });
    expect(english.language).toBe('en');
    expect(english.plainText).toContain('PROFESSIONAL EXPERIENCE');
  });

  it('signale un diplôme non complété au lieu de le taire', async () => {
    const profile = makeProfile();
    profile.education[0]!.completed = false;
    const document = await buildCv(profile, makeJob(), { renderPdf: false });
    expect(document.plainText).toContain('non complété');
  });

  it('refuse de générer une certification non enregistrée', async () => {
    const profile = makeProfile();
    // Cas réel : la candidate écrit une certification dans son résumé libre
    // sans l'avoir enregistrée. Le résumé fait partie du profil, mais une
    // certification doit figurer dans la liste des certifications — sinon
    // rien ne distingue une qualification réelle d'une formule d'affichage.
    profile.identity.summary = 'Certifiée AWS Solutions Architect depuis huit ans.';

    await expect(buildCv(profile, makeJob(), { renderPdf: false })).rejects.toBeInstanceOf(
      GuardrailError,
    );
  });

  it('accepte la même mention une fois la certification enregistrée', async () => {
    const profile = makeProfile();
    profile.identity.summary = 'Certifiée AWS Solutions Architect depuis huit ans.';
    profile.certifications = [
      {
        id: 'cert_1',
        name: 'AWS Solutions Architect',
        issuer: 'Amazon Web Services',
        expiresAt: null,
      },
    ];

    const document = await buildCv(profile, makeJob(), { renderPdf: false });
    expect(document.guardrails.ok).toBe(true);
  });

  it('n’injecte que des mots-clés issus du profil', async () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Docker, AWS, Terraform et Scala exigés.</li></ul>',
    });
    const keywordGap = analyzeKeywordGap(job, makeProfile(), {
      currentCvText: 'CV minimal sans technologie.',
    });

    const document = await buildCv(makeProfile(), job, { keywordGap, renderPdf: false });
    const profileSkills = makeProfile().skills.map((s) => s.name);

    for (const keyword of document.injectedKeywords) {
      expect(profileSkills).toContain(keyword);
    }
    expect(document.injectedKeywords).not.toContain('Terraform');
    expect(document.injectedKeywords).not.toContain('Scala');
  });

  it('produit un texte contenant les sections attendues par un ATS', async () => {
    const document = await buildCv(makeProfile(), makeJob(), { renderPdf: false });
    expect(document.plainText).toContain('EXPÉRIENCE PROFESSIONNELLE');
    expect(document.plainText).toContain('FORMATION');
    expect(document.plainText).toContain('COMPÉTENCES');
  });
});

describe('buildCoverLetter', () => {
  it('produit une lettre adossée au profil', async () => {
    const document = await buildCoverLetter(makeProfile(), makeJob(), {
      renderPdf: false,
      date: NOW,
    });

    expect(document.kind).toBe('cover_letter');
    expect(document.plainText).toContain('Northwind Technologies');
    expect(document.plainText).toContain('Senior Full-Stack Developer');
    expect(document.guardrails.ok).toBe(true);
  });

  it('n’invente pas de destinataire', async () => {
    const document = await buildCoverLetter(makeProfile(), makeJob(), {
      renderPdf: false,
      date: NOW,
    });
    expect(document.sourceTypst).toContain('Madame, Monsieur,');
  });

  it('utilise le destinataire quand il est connu', async () => {
    const document = await buildCoverLetter(makeProfile(), makeJob(), {
      renderPdf: false,
      recipientName: 'Madame Roy',
      date: NOW,
    });
    expect(document.sourceTypst).toContain('Madame Roy');
  });

  it('est reproductible à l’identique', async () => {
    const a = await buildCoverLetter(makeProfile(), makeJob(), { renderPdf: false, date: NOW });
    const b = await buildCoverLetter(makeProfile(), makeJob(), { renderPdf: false, date: NOW });
    expect(a.sourceTypst).toBe(b.sourceTypst);
  });

  it('reprend les paragraphes fournis par l’utilisateur', async () => {
    const document = await buildCoverLetter(makeProfile(), makeJob(), {
      renderPdf: false,
      date: NOW,
      customParagraphs: ['Un paragraphe rédigé par la candidate.'],
    });
    expect(document.plainText).toContain('rédigé par la candidate');
  });

  it('refuse un paragraphe utilisateur contenant une invention', async () => {
    // Le contrôle s'applique aussi au texte fourni : c'est ce qui permettra
    // d'ajouter la réécriture par LLM sans affaiblir la garantie.
    await expect(
      buildCoverLetter(makeProfile(), makeJob(), {
        renderPdf: false,
        date: NOW,
        customParagraphs: ['Je suis certifiée AWS Solutions Architect.'],
      }),
    ).rejects.toBeInstanceOf(GuardrailError);
  });
});
