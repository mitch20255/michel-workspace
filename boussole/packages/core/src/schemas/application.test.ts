import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  PIPELINE_STAGES,
  STAGE_LABELS_FR,
} from './application.js';

describe('canTransition', () => {
  it('autorise la progression normale du pipeline', () => {
    expect(canTransition('to_review', 'shortlist')).toBe(true);
    expect(canTransition('shortlist', 'documents_ready')).toBe(true);
    expect(canTransition('ready_to_apply', 'applied')).toBe(true);
    expect(canTransition('interview', 'offer')).toBe(true);
  });

  it('autorise le retour en arrière d’une étape', () => {
    expect(canTransition('documents_ready', 'shortlist')).toBe(true);
  });

  it('refuse un saut absurde', () => {
    // Sans cette garde, les statistiques du CRM deviennent ininterprétables.
    expect(canTransition('to_review', 'offer')).toBe(false);
    expect(canTransition('to_review', 'applied')).toBe(false);
  });

  it('autorise le rejet et l’archivage depuis n’importe quelle étape', () => {
    for (const stage of PIPELINE_STAGES) {
      if (stage === 'rejected' || stage === 'archived') continue;
      expect(canTransition(stage, 'rejected')).toBe(true);
      expect(canTransition(stage, 'archived')).toBe(true);
    }
  });

  it('autorise une transition vers la même étape', () => {
    expect(canTransition('applied', 'applied')).toBe(true);
  });

  it('permet de rouvrir une candidature archivée', () => {
    expect(canTransition('archived', 'to_review')).toBe(true);
  });
});

describe('cohérence des tables', () => {
  it('définit une étiquette française pour chaque étape', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(STAGE_LABELS_FR[stage]).toBeTruthy();
    }
  });

  it('définit les transitions autorisées pour chaque étape', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(ALLOWED_TRANSITIONS[stage]).toBeDefined();
    }
  });

  it('ne référence que des étapes valides dans les transitions', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(PIPELINE_STAGES).toContain(target);
      }
    }
  });
});
