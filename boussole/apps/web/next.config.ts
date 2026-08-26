import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Les paquets de l'espace de travail sont livrés en TypeScript compilé ;
  // Next doit les transpiler pour ses propres cibles.
  transpilePackages: ['@boussole/core'],
  // L'interface ne doit jamais être indexée : elle affiche un profil complet.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default config;
