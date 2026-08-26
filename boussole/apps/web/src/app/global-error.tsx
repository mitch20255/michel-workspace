'use client';

/**
 * Dernier filet de sécurité : une erreur survenue dans la mise en page racine.
 *
 * Doit rendre ses propres `<html>` et `<body>` — la mise en page normale n'est
 * pas montée quand cette page s'affiche.
 *
 * Le message ne révèle jamais le détail technique : il pourrait contenir un
 * fragment de profil. La trace reste dans les journaux du serveur.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr-CA">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '3rem 1.5rem',
          maxWidth: '32rem',
          margin: '0 auto',
        }}
      >
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Une erreur est survenue</h1>
        <p style={{ marginTop: '0.75rem', lineHeight: 1.6 }}>
          L’interface n’a pas pu s’afficher. Vos données ne sont pas affectées : Boussole n’écrit
          rien tant qu’une action n’a pas abouti.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid currentColor',
            background: 'transparent',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
