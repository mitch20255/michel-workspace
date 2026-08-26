import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Boussole',
  description: 'Assistant de recherche d’emploi, sous votre contrôle.',
  // L'interface affiche un profil candidat complet : elle ne doit jamais
  // être indexée, même si elle se retrouve exposée par erreur.
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/offres', label: 'Offres' },
  { href: '/crm', label: 'Candidatures' },
  { href: '/profil', label: 'Profil' },
  { href: '/sources', label: 'Sources' },
  { href: '/parametres', label: 'Paramètres' },
  { href: '/journal', label: 'Journal' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
          <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-(--color-border-subtle) py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="text-lg">
                🧭
              </span>
              Boussole
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-(--color-ink-muted) transition-colors hover:text-(--color-ink)"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="flex-1 py-6">{children}</main>

          <footer className="border-t border-(--color-border-subtle) py-4 text-xs text-(--color-ink-faint)">
            Boussole n’envoie aucune candidature à votre place et n’invente jamais d’information sur
            votre parcours. Chaque action reste visible dans le journal.
          </footer>
        </div>
      </body>
    </html>
  );
}
