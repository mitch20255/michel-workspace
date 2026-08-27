import { describe, expect, it } from 'vitest';
import {
  assertNoNewFacts,
  ImpactInvariantError,
  rewriteBullet,
  rewriteBullets,
  summarizeEdits,
  type ImpactTone,
} from './impact.js';

/**
 * Ce que ces tests protègent : la réécriture d'impact peut renforcer la forme
 * autant qu'on veut, elle ne peut pas fabriquer un fait. C'est la propriété
 * qui rend le niveau `assertive` défendable.
 */

describe('rewriteBullet — niveau factual', () => {
  it('ne touche à rien', () => {
    const bullet = "Participé à la migration de l'infrastructure vers AWS.";
    const result = rewriteBullet(bullet, { tone: 'factual' });

    expect(result.text).toBe(bullet);
    expect(result.edits).toHaveLength(0);
  });
});

describe('rewriteBullet — hissage du résultat', () => {
  it('place la conséquence chiffrée en tête, verbe compris', () => {
    // Le marqueur (« réduisant ») fait partie de l'affirmation : l'amputer
    // laisserait « Les coûts de 30 % », qui ne dit plus rien.
    const result = rewriteBullet(
      "Migré l'infrastructure vers des conteneurs, réduisant les coûts de 30 %.",
      { tone: 'confident' },
    );

    expect(result.text).toBe(
      "Réduisant les coûts de 30 % — migré l'infrastructure vers des conteneurs",
    );
    expect(result.edits.map((e) => e.kind)).toContain('outcome_first');
  });

  it('laisse la phrase intacte quand la conséquence est plus longue que l’action', () => {
    // Hisser produirait une puce déséquilibrée : l'action disparaîtrait
    // derrière une subordonnée à rallonge.
    const bullet =
      'Corrigé un bogue, rétablissant le service de facturation pour la totalité des clients européens touchés depuis la veille.';
    const result = rewriteBullet(bullet, { tone: 'confident' });

    expect(result.edits.some((e) => e.kind === 'outcome_first')).toBe(false);
  });

  it('ne déplace pas une tournure relative, qui exigerait de reformuler', () => {
    // « Ce qui a permis de doubler la conversion — refonte… » n'est pas du
    // français. Le corriger demanderait d'ajouter des mots absents de
    // l'original : l'invariant passe avant la permutation.
    const bullet = 'Refonte du tunnel, ce qui a permis de doubler la conversion.';
    const result = rewriteBullet(bullet, { tone: 'assertive' });

    expect(result.edits.some((e) => e.kind === 'outcome_first')).toBe(false);
    expect(result.text).toContain('ce qui a permis');
  });

  it('exige une virgule avant le marqueur', () => {
    // Sans virgule, « permettant » appartient à la proposition principale et
    // le déplacer produirait une phrase agrammaticale.
    const bullet = 'Conçu une API permettant la synchronisation des stocks.';
    const result = rewriteBullet(bullet, { tone: 'confident' });

    expect(result.text).toBe(bullet.replace(/\.$/, '.'));
    expect(result.edits.some((e) => e.kind === 'outcome_first')).toBe(false);
  });
});

describe('rewriteBullet — atténuateurs de rôle', () => {
  const bullet = "Participé à la refonte du tunnel d'achat.";

  it('les conserve au niveau confident : la portée de l’affirmation ne doit pas bouger', () => {
    const result = rewriteBullet(bullet, { tone: 'confident' });

    expect(result.text.toLowerCase()).toContain('participé');
    expect(result.edits.some((e) => e.kind === 'hedge_removed')).toBe(false);
  });

  it('les retire au niveau assertive', () => {
    const result = rewriteBullet(bullet, { tone: 'assertive' });

    expect(result.text).toBe("Refonte du tunnel d'achat.");
    expect(result.edits.some((e) => e.kind === 'hedge_removed')).toBe(true);
  });

  it('signale explicitement que la portée a changé', () => {
    // C'est le seul endroit du produit où une transformation modifie ce que le
    // document affirme. Elle doit ressortir séparément du reste.
    const summary = summarizeEdits(rewriteBullets([bullet], { tone: 'assertive' }));

    expect(summary.scopeChanging).toHaveLength(1);
    expect(summary.scopeChanging[0]?.rationale).toContain('entretien');
  });

  it('retire aussi les formules d’assignation', () => {
    const result = rewriteBullet('Responsable de la migration des données clients.', {
      tone: 'assertive',
    });

    expect(result.text).toBe('Migration des données clients.');
  });

  it('ne vide jamais une puce qui n’est que son atténuateur', () => {
    const result = rewriteBullet('Participé à', { tone: 'assertive' });

    expect(result.text.trim()).not.toBe('');
  });
});

describe('rewriteBullet — formules de remplissage', () => {
  it('retire une queue de phrase qui n’affirme rien', () => {
    const result = rewriteBullet(
      'Rédigé la documentation technique, dans le cadre de mes fonctions.',
      { tone: 'confident' },
    );

    expect(result.text).toBe('Rédigé la documentation technique');
    expect(result.edits.map((e) => e.kind)).toContain('weakener_removed');
  });

  it('ne retire pas au milieu d’une phrase', () => {
    // « notamment » au milieu porte du sens ; en fin de phrase il n'en porte pas.
    const bullet = 'Encadré trois développeurs, notamment sur les revues de code.';
    const result = rewriteBullet(bullet, { tone: 'confident' });

    expect(result.text).toContain('notamment sur les revues');
  });
});

describe('rewriteBullet — alignement de vocabulaire', () => {
  it('adopte le libellé de l’offre pour une compétence identique', () => {
    const result = rewriteBullet('Développé le tableau de bord en JS.', {
      tone: 'confident',
      jobSkills: ['JavaScript'],
    });

    expect(result.text).toContain('JavaScript');
    expect(result.edits.map((e) => e.kind)).toContain('term_aligned');
  });

  it('n’introduit jamais une compétence différente', () => {
    // L'offre demande Kubernetes, la puce parle de Docker : deux compétences
    // distinctes, aucun remplacement possible.
    const result = rewriteBullet('Déployé les services avec Docker.', {
      tone: 'assertive',
      jobSkills: ['Kubernetes'],
    });

    expect(result.text).toContain('Docker');
    expect(result.text).not.toContain('Kubernetes');
  });
});

describe('assertNoNewFacts — l’invariant du module', () => {
  it('détecte un terme introduit', () => {
    const introduced = assertNoNewFacts(
      'Migré la base de données.',
      'Migré la base de données PostgreSQL.',
    );

    expect(introduced).toContain('postgresql');
  });

  it('accepte une permutation pure', () => {
    expect(
      assertNoNewFacts(
        'Réduit les coûts de 30 % en migrant',
        'En migrant — réduit les coûts de 30 %',
      ),
    ).toEqual([]);
  });

  it('accepte un chiffre déjà présent', () => {
    expect(assertNoNewFacts('12 000 usagers actifs', 'Usagers actifs : 12 000')).toEqual([]);
  });

  it('refuse un chiffre absent', () => {
    expect(assertNoNewFacts('Des milliers d’usagers', '12 000 usagers')).toContain('12');
  });
});

describe('rewriteBullet — aucun niveau ne peut inventer', () => {
  const bullets = [
    "Participé à la migration de l'infrastructure vers AWS, réduisant les coûts de 30 %.",
    'Responsable de la refonte du tunnel de paiement, ce qui a permis de doubler la conversion.',
    'Aidé à mettre en place les tests automatisés, dans le cadre de mes fonctions.',
    "Membre de l'équipe qui a livré la refonte mobile en React Native.",
    'Encadré 4 développeurs juniors.',
  ];
  const tones: ImpactTone[] = ['factual', 'confident', 'assertive'];

  for (const tone of tones) {
    it(`niveau ${tone} : chaque puce reste un sous-ensemble de son original`, () => {
      for (const bullet of bullets) {
        const result = rewriteBullet(bullet, { tone, jobSkills: ['AWS', 'React Native'] });
        expect(assertNoNewFacts(bullet, result.text, ['AWS', 'React Native'])).toEqual([]);
      }
    });
  }

  it('lève une erreur explicite si l’invariant est violé', () => {
    // On ne peut pas provoquer la violation par l'API publique — c'est le but.
    // On vérifie donc que l'erreur porte l'information nécessaire au diagnostic.
    const error = new ImpactInvariantError('avant', 'après', ['kubernetes']);

    expect(error.message).toContain('kubernetes');
    expect(error.name).toBe('ImpactInvariantError');
  });
});
