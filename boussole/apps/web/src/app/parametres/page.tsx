import { apiSafe } from '@/lib/api';
import type { SettingsResponse } from '@/lib/types';
import { Card, Empty } from '@/components/ui';
import { LlmSettingsForm } from './form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await apiSafe<SettingsResponse>('/settings');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Boussole fonctionne entièrement sans modèle de langage. L’activer est un choix, pas un
          prérequis.
        </p>
      </div>

      <Card title="Modèle de langage" subtitle="Votre clé, votre décision — désactivé par défaut">
        {!settings ? (
          <Empty>Paramètres indisponibles : vérifier que l’API est démarrée.</Empty>
        ) : (
          <LlmSettingsForm settings={settings} />
        )}
      </Card>

      <Card title="Ce qui change selon le fournisseur">
        <div className="space-y-3 text-sm text-(--color-ink-muted)">
          <p>
            <strong className="text-(--color-ink)">Aucun</strong> — état par défaut. Rien ne quitte
            votre machine. Le scoring, la déduplication, la détection d’offres fantômes, la
            génération de CV et de lettres et la préparation d’entretien fonctionnent tous sans
            modèle : ils sont déterministes.
          </p>
          <p>
            <strong className="text-(--color-ink)">Ollama</strong> — le modèle tourne sur votre
            machine. Aucune clé, aucun tiers, aucun consentement demandé : rien ne sort.
          </p>
          <p>
            <strong className="text-(--color-ink)">Anthropic ou service compatible OpenAI</strong> —
            vos données transitent chez un tiers. Boussole n’envoie jamais votre nom, votre
            courriel, votre téléphone, votre adresse ni vos réponses aux questions sensibles : le
            profil est pseudonymisé avant l’envoi, et un contrôle mécanique bloque la requête si une
            donnée identifiante s’y trouve malgré tout.
          </p>
          <p className="text-xs text-(--color-ink-faint)">
            Le consentement est distinct de la configuration : enregistrer une clé ne vaut pas
            accord pour transmettre vos données. Changer de fournisseur le réinitialise — accepter
            un service ne vaut pas acceptation pour un autre.
          </p>
        </div>
      </Card>

      {settings && (
        <Card
          title="Pondération du scoring"
          subtitle="Valeurs actuelles — modifiables via l’API en attendant l’éditeur"
        >
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {Object.entries(settings.scoring.weights).map(([key, weight]) => (
              <li key={key} className="flex items-baseline justify-between gap-3">
                <span className="text-(--color-ink-muted)">{key}</span>
                <span className="tabular-nums">{Math.round(weight * 100)} %</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-(--color-ink-faint)">
            Quelqu’un qui déménage ne pondère pas la localisation comme quelqu’un qui a un bail :
            ces poids sont faits pour être ajustés.
          </p>
        </Card>
      )}
    </div>
  );
}
