-- Extensions requises par Boussole.
-- pgvector : recherche sémantique (V1). Installée dès le départ pour éviter
-- une migration privilégiée plus tard.
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm : similarité trigramme, utilisée par la déduplication fuzzy côté SQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent : normalisation des accents (marché francophone / Québec).
CREATE EXTENSION IF NOT EXISTS unaccent;
