import { isSameSkill } from './skills.js';

/**
 * Compétences voisines : ce qui se transfère honnêtement.
 *
 * Le problème que ce module résout : l'analyse d'écart classait « Kubernetes
 * exigé, absent du profil » exactement comme « SAP exigé, absent du profil ».
 * Pour un candidat qui opère des conteneurs sur ECS depuis trois ans, c'est
 * faux — et c'est une occasion perdue à chaque candidature.
 *
 * Ce que ce module autorise : **nommer ce que le candidat sait réellement
 * faire, dans les termes de l'offre**, en disant explicitement ce qui manque.
 * « Orchestration de conteneurs en production sur ECS ; pas de Kubernetes en
 * production » est une phrase vraie, et bien plus forte que le silence.
 *
 * Ce que ce module n'autorise pas, et ne pourra jamais autoriser : faire
 * entrer la compétence manquante dans un CV. Une compétence transférable ne
 * rejoint **jamais** `safeToAdd`. La phrase produite nomme la compétence
 * possédée ; la compétence absente n'y apparaît qu'accompagnée de sa négation,
 * et uniquement dans une lettre, jamais dans une liste de compétences.
 */

export interface AdjacencyGroup {
  /** La compétence sous-jacente réellement commune aux membres. */
  domain: string;
  domainEn: string;
  members: string[];
  /**
   * Ce que vaut le transfert, 0–1. Volontairement conservateur : deux SGBD
   * relationnels se ressemblent beaucoup plus que deux nuages publics.
   */
  strength: number;
}

/**
 * Groupes curatés. Le critère d'admission est strict : deux compétences ne
 * sont voisines que si quelqu'un qui maîtrise l'une devient productif sur
 * l'autre en quelques semaines, sans repartir de zéro conceptuellement.
 */
export const ADJACENCY_GROUPS: AdjacencyGroup[] = [
  {
    domain: 'bases de données relationnelles',
    domainEn: 'relational databases',
    members: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle'],
    strength: 0.8,
  },
  {
    domain: 'orchestration de conteneurs',
    domainEn: 'container orchestration',
    members: ['Kubernetes', 'Docker'],
    strength: 0.55,
  },
  {
    domain: 'infrastructure infonuagique',
    domainEn: 'cloud infrastructure',
    members: ['AWS', 'Azure', 'Google Cloud'],
    strength: 0.6,
  },
  {
    domain: 'interfaces à composants',
    domainEn: 'component-based front-ends',
    members: ['React', 'Vue.js', 'Angular', 'Svelte'],
    strength: 0.7,
  },
  {
    domain: 'méta-frameworks React',
    domainEn: 'React meta-frameworks',
    members: ['Next.js', 'React'],
    strength: 0.75,
  },
  {
    domain: 'serveurs Node',
    domainEn: 'Node servers',
    members: ['Express', 'NestJS', 'Node.js'],
    strength: 0.75,
  },
  {
    domain: 'cadres web Python',
    domainEn: 'Python web frameworks',
    members: ['Django', 'Flask', 'FastAPI'],
    strength: 0.75,
  },
  {
    domain: 'langages typés orientés objet',
    domainEn: 'statically typed OO languages',
    members: ['Java', 'C#', 'Kotlin', 'Scala'],
    strength: 0.5,
  },
  {
    domain: 'JavaScript typé',
    domainEn: 'typed JavaScript',
    members: ['TypeScript', 'JavaScript'],
    strength: 0.85,
  },
  {
    domain: "chaînes d'intégration continue",
    domainEn: 'continuous integration pipelines',
    members: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CI/CD'],
    strength: 0.8,
  },
  {
    domain: 'infrastructure déclarée en code',
    domainEn: 'infrastructure as code',
    members: ['Terraform', 'Ansible'],
    strength: 0.6,
  },
  {
    domain: 'cadres de réseaux de neurones',
    domainEn: 'neural network frameworks',
    members: ['PyTorch', 'TensorFlow'],
    strength: 0.7,
  },
  {
    domain: 'entrepôts de données analytiques',
    domainEn: 'analytical data warehouses',
    members: ['Snowflake', 'BigQuery', 'Redshift'],
    strength: 0.7,
  },
  {
    domain: 'visualisation décisionnelle',
    domainEn: 'business intelligence tooling',
    members: ['Power BI', 'Tableau'],
    strength: 0.7,
  },
  {
    domain: 'orchestration de traitements de données',
    domainEn: 'data pipeline orchestration',
    members: ['Airflow', 'dbt', 'ETL'],
    strength: 0.55,
  },
  {
    domain: 'développement mobile multiplateforme',
    domainEn: 'cross-platform mobile development',
    members: ['React Native', 'Flutter'],
    strength: 0.6,
  },
  {
    domain: 'méthodes de livraison itérative',
    domainEn: 'iterative delivery methods',
    members: ['Agile', 'Scrum', 'Kanban'],
    strength: 0.85,
  },
];

export interface TransferableMatch {
  /** Compétence exigée par l'offre et absente du profil. */
  missing: string;
  /** Compétence réellement possédée qui s'en approche le plus. */
  via: string;
  domain: string;
  domainEn: string;
  strength: number;
}

/**
 * Cherche, parmi les compétences du profil, la plus proche voisine d'une
 * compétence exigée mais absente. Retourne `undefined` s'il n'y en a pas —
 * l'écart est alors réel et le reste.
 */
export function findTransferable(
  missing: string,
  profileSkills: readonly string[],
): TransferableMatch | undefined {
  let best: TransferableMatch | undefined;

  for (const group of ADJACENCY_GROUPS) {
    const missingInGroup = group.members.some((member) => isSameSkill(member, missing));
    if (!missingInGroup) continue;

    for (const member of group.members) {
      if (isSameSkill(member, missing)) continue;
      const held = profileSkills.find((skill) => isSameSkill(skill, member));
      if (!held) continue;

      if (!best || group.strength > best.strength) {
        best = {
          missing,
          via: member,
          domain: group.domain,
          domainEn: group.domainEn,
          strength: group.strength,
        };
      }
    }
  }

  return best;
}

/**
 * Phrase utilisable telle quelle dans une lettre.
 *
 * Sa forme est imposée : **ce que je sais faire d'abord, ce qui manque
 * ensuite, explicitement.** Inverser l'ordre produirait une phrase d'excuse ;
 * omettre la seconde moitié produirait un mensonge par insinuation. Les deux
 * moitiés sont donc générées ensemble, sans possibilité de n'en garder qu'une.
 */
export function bridgePhrasing(match: TransferableMatch, language: 'fr' | 'en' = 'fr'): string {
  if (language === 'en') {
    return `${match.via} in production (${match.domainEn}); no professional ${match.missing} experience yet.`;
  }
  return `${match.via} en production (${match.domain}) ; pas encore d'expérience professionnelle sur ${match.missing}.`;
}
