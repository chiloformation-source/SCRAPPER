/**
 * Orchestrateur des scrapers - Pipeline automatique en 4 étapes
 * 1. Scraping parallèle de toutes les sources
 * 2. Recherche de sites web manquants (DuckDuckGo, batch de 5)
 * 3. Enrichissement automatique contacts (batch de 5, parallèle)
 * 4. Stats de qualité
 */

import { searchSireneAlt, searchSirene } from "./pappers";
import { searchSociete } from "./google";
import {
  scrapePagesJaunes,
  scrapeKompass,
  scrapeEuropages,
  trouverSiteWeb,
} from "./contacts";
import { enrichirContacts } from "./web-enrichment";
import { scrapeOverpass, scrapeOverpassMulti } from "./overpass";
import { scrapeAnnuaire118 } from "./annuaire118";
import { scrapeGoogleMaps } from "./googlemaps";
import { NouvelleEntreprise } from "../db/schema";

export type ModeRecherche = "rapide" | "complet";

export interface ParametresRecherche {
  query: string;
  ville?: string;
  /** Multi-villes : si renseigné, remplace `ville` et lance en parallèle (max 5) */
  villes?: string[];
  codePostal?: string;
  codeNaf?: string;
  secteur?: string;
  sources?: SourceScraping[];
  limit?: number;
  /** Rapide = OSM uniquement, sans enrichissement web */
  mode?: ModeRecherche;
  /** @deprecated enrichissement toujours actif désormais */
  enrichirEmails?: boolean;
  /** Callback SSE : appelé pour chaque nouvelle entreprise ajoutée */
  onEntreprise?: (e: NouvelleEntreprise) => void;
}

export type SourceScraping =
  | "api_gouv"
  | "pages_jaunes"
  | "annuaire118"
  | "googlemaps"
  | "kompass"
  | "europages"
  | "sirene"
  | "societe"
  | "openstreetmap";

export interface QualiteResultat {
  avecTel: number;
  avecEmail: number;
  avecAdresse: number;
  enrichies: number;
}

export interface ResultatScraping {
  entreprises: NouvelleEntreprise[];
  sourceStats: Record<string, number>;
  erreurs: string[];
  total: number;
  qualite: QualiteResultat;
}

/**
 * Clé de déduplication normalisée (insensible aux accents et casse)
 */
function normKey(e: NouvelleEntreprise): string {
  if (e.siren) return `siren:${e.siren}`;
  return (e.nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge : garde la valeur existante, prend la nouvelle si manquante
 * Préfère la valeur avec le plus d'informations (plus longue / non nulle)
 */
function mergeEntreprise(
  existing: NouvelleEntreprise,
  nouveau: NouvelleEntreprise
): NouvelleEntreprise {
  return {
    ...existing,
    telephone: existing.telephone || nouveau.telephone,
    email: existing.email || nouveau.email,
    siteWeb: existing.siteWeb || nouveau.siteWeb,
    adresse: existing.adresse || nouveau.adresse,
    ville: existing.ville || nouveau.ville,
    codePostal: existing.codePostal || nouveau.codePostal,
    siren: existing.siren || nouveau.siren,
    siret: existing.siret || nouveau.siret,
    formeJuridique: existing.formeJuridique || nouveau.formeJuridique,
    dirigeant: existing.dirigeant || nouveau.dirigeant,
    effectifs: existing.effectifs || nouveau.effectifs,
    secteurActivite: existing.secteurActivite || nouveau.secteurActivite,
    codeNaf: existing.codeNaf || nouveau.codeNaf,
    dateCreation: existing.dateCreation || nouveau.dateCreation,
  };
}

/**
 * Exécute une fonction en parallèle par lots de `batchSize`
 */
async function pBatch<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(fn));
  }
}

export async function scraperEntreprises(
  params: ParametresRecherche
): Promise<ResultatScraping> {
  // ── Multi-villes : récurse sur chaque ville puis fusionne ──────────────
  const villes = params.villes && params.villes.length > 0 ? params.villes : null;
  if (villes) {
    const villesMax = villes.slice(0, 5);
    const results = await Promise.allSettled(
      villesMax.map((v) =>
        scraperEntreprises({ ...params, ville: v, villes: undefined })
      )
    );
    const merged: ResultatScraping = {
      entreprises: [],
      sourceStats: {},
      erreurs: [],
      total: 0,
      qualite: { avecTel: 0, avecEmail: 0, avecAdresse: 0, enrichies: 0 },
    };
    const seen = new Set<string>();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { value } = r;
      for (const e of value.entreprises) {
        const key = normKey(e);
        if (!seen.has(key)) {
          seen.add(key);
          merged.entreprises.push(e);
        }
      }
      for (const [k, v] of Object.entries(value.sourceStats)) {
        merged.sourceStats[k] = (merged.sourceStats[k] || 0) + v;
      }
      merged.erreurs.push(...value.erreurs);
      merged.qualite.avecTel += value.qualite.avecTel;
      merged.qualite.avecEmail += value.qualite.avecEmail;
      merged.qualite.avecAdresse += value.qualite.avecAdresse;
      merged.qualite.enrichies += value.qualite.enrichies;
    }
    merged.total = merged.entreprises.length;
    return merged;
  }

  const modeRapide = params.mode === "rapide";
  const sources = params.sources ||
    (modeRapide ? ["openstreetmap"] : ["openstreetmap", "annuaire118", "api_gouv"]);
  const entreprisesMap = new Map<string, NouvelleEntreprise>();
  const sourceStats: Record<string, number> = {};
  const erreurs: string[] = [];

  const addResults = (results: NouvelleEntreprise[], label: string) => {
    sourceStats[label] = (sourceStats[label] || 0) + results.length;
    for (const e of results) {
      const key = normKey(e);
      if (!entreprisesMap.has(key)) {
        entreprisesMap.set(key, e);
        params.onEntreprise?.(e);
      } else {
        entreprisesMap.set(key, mergeEntreprise(entreprisesMap.get(key)!, e));
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 1 : Scraping parallèle de toutes les sources
  // ═══════════════════════════════════════════════════════════════
  const promises: Promise<void>[] = [];

  if (sources.includes("pages_jaunes") && params.query) {
    promises.push(
      scrapePagesJaunes(params.query, params.ville || "France")
        .then((r) => addResults(r.results, "Pages Jaunes"))
        .catch((err) => {
          erreurs.push(`Pages Jaunes: ${err.message}`);
          sourceStats["Pages Jaunes"] = 0;
        })
    );
  }

  if (sources.includes("kompass") && params.query) {
    promises.push(
      scrapeKompass(params.query, params.ville || "France")
        .then((r) => addResults(r, "Kompass"))
        .catch((err) => {
          erreurs.push(`Kompass: ${err.message}`);
          sourceStats["Kompass"] = 0;
        })
    );
  }

  if (sources.includes("europages") && params.query) {
    promises.push(
      scrapeEuropages(params.query, params.ville || "France")
        .then((r) => addResults(r, "Europages"))
        .catch((err) => {
          erreurs.push(`Europages: ${err.message}`);
          sourceStats["Europages"] = 0;
        })
    );
  }

  if (sources.includes("openstreetmap") && params.query && params.ville) {
    promises.push(
      // scrapeOverpassMulti couvre plusieurs catégories OSM en parallèle
      scrapeOverpassMulti(params.query, params.ville)
        .then((r) => addResults(r.results, "OpenStreetMap"))
        .catch((err) => {
          erreurs.push(`OpenStreetMap: ${err.message}`);
          sourceStats["OpenStreetMap"] = 0;
        })
    );
  }

  if (sources.includes("annuaire118") && params.query && params.ville) {
    promises.push(
      scrapeAnnuaire118(params.query, params.ville)
        .then((r) => addResults(r.results, "Annuaire 118000"))
        .catch((err) => {
          erreurs.push(`Annuaire 118000: ${err.message}`);
          sourceStats["Annuaire 118000"] = 0;
        })
    );
  }

  if (sources.includes("googlemaps") && params.query && params.ville) {
    promises.push(
      scrapeGoogleMaps(params.query, params.ville)
        .then((r) => addResults(r.results, "Google Maps"))
        .catch((err) => {
          erreurs.push(`Google Maps: ${err.message}`);
          sourceStats["Google Maps"] = 0;
        })
    );
  }

  if (sources.includes("api_gouv")) {
    promises.push(
      searchSireneAlt(params.query, {
        ville: params.ville,
        codePostal: params.codePostal,
      })
        .then((r) => addResults(r, "API Gouvernement"))
        .catch((err) => {
          erreurs.push(`API Gouvernement: ${err.message}`);
          sourceStats["API Gouvernement"] = 0;
        })
    );
  }

  if (sources.includes("sirene")) {
    promises.push(
      searchSirene(params.query, {
        ville: params.ville,
        codePostal: params.codePostal,
        codeNaf: params.codeNaf,
      })
        .then((r) => addResults(r, "INSEE SIRENE"))
        .catch((err) => {
          erreurs.push(`INSEE SIRENE: ${err.message}`);
          sourceStats["INSEE SIRENE"] = 0;
        })
    );
  }

  if (sources.includes("societe") && params.query) {
    promises.push(
      searchSociete(params.query, params.ville)
        .then((r) => addResults(r, "Societe.com"))
        .catch((err) => {
          erreurs.push(`Societe.com: ${err.message}`);
          sourceStats["Societe.com"] = 0;
        })
    );
  }

  await Promise.allSettled(promises);

  // Trier par richesse des données avant de limiter (ceux avec contacts en premier)
  const allEntreprises = Array.from(entreprisesMap.values()).sort((a, b) => {
    const scoreA = (a.telephone ? 3 : 0) + (a.email ? 2 : 0) + (a.adresse ? 1 : 0) + (a.siteWeb ? 1 : 0);
    const scoreB = (b.telephone ? 3 : 0) + (b.email ? 2 : 0) + (b.adresse ? 1 : 0) + (b.siteWeb ? 1 : 0);
    return scoreB - scoreA;
  });

  const limitedForEnrichment = params.limit
    ? allEntreprises.slice(0, params.limit)
    : allEntreprises;

  // Reconstruire la map avec les entreprises limitées
  entreprisesMap.clear();
  for (const e of limitedForEnrichment) {
    entreprisesMap.set(normKey(e), e);
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 2 : Recherche de site web pour les entreprises sans URL
  // (batch 5, timeout 3s chacune, max 15 recherches)
  // Skippée en mode rapide
  // ═══════════════════════════════════════════════════════════════
  const sansWeb = modeRapide ? [] : limitedForEnrichment.filter((e) => !e.siteWeb).slice(0, 15);

  if (sansWeb.length > 0) {
    await pBatch(sansWeb, 5, async (e) => {
      try {
        const site = await Promise.race([
          trouverSiteWeb(e.nom, e.ville),
          new Promise<undefined>((r) => setTimeout(() => r(undefined), 3000)),
        ]);
        if (site) {
          const key = normKey(e);
          const existing = entreprisesMap.get(key);
          if (existing && !existing.siteWeb) {
            entreprisesMap.set(key, { ...existing, siteWeb: site });
          }
        }
      } catch {
        // Ignorer
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 3 : Enrichissement contacts AUTOMATIQUE
  // Pour toutes les entreprises sans email OU sans téléphone
  // (batch 5, timeout 8s, max 30 entreprises)
  // Skippée en mode rapide
  // ═══════════════════════════════════════════════════════════════
  const currentEntreprises = Array.from(entreprisesMap.values());
  const toEnrich = modeRapide
    ? []
    : currentEntreprises
        .filter((e) => (!e.email || !e.telephone) && (e.siteWeb || e.nom))
        .slice(0, 30);

  let enrichiesCount = 0;

  if (toEnrich.length > 0) {
    await pBatch(toEnrich, 5, async (e) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);

        const contacts = await enrichirContacts(e, ctrl.signal);
        clearTimeout(timer);

        const key = normKey(e);
        const existing = entreprisesMap.get(key);
        if (existing) {
          const wasEmpty = !existing.email || !existing.telephone;
          const updated = {
            ...existing,
            email: existing.email || contacts.email,
            telephone: existing.telephone || contacts.telephone,
            siteWeb: existing.siteWeb, // garder le site web trouvé à l'étape 2
          };
          entreprisesMap.set(key, updated);

          if (wasEmpty && (contacts.email || contacts.telephone)) {
            enrichiesCount++;
          }
        }
      } catch {
        // Ignorer
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 4 : Score de complétude + Stats de qualité + retour
  // ═══════════════════════════════════════════════════════════════
  // Calculer le score de complétude pour chaque entreprise (0-100)
  for (const [key, e] of entreprisesMap.entries()) {
    const score =
      (e.telephone ? 25 : 0) +
      (e.email ? 25 : 0) +
      (e.adresse ? 25 : 0) +
      (e.siteWeb ? 25 : 0);
    entreprisesMap.set(key, { ...e, scoreQualite: score });
  }

  const finalEntreprises = Array.from(entreprisesMap.values());

  const qualite: QualiteResultat = {
    avecTel: finalEntreprises.filter((e) => e.telephone).length,
    avecEmail: finalEntreprises.filter((e) => e.email).length,
    avecAdresse: finalEntreprises.filter((e) => e.adresse || e.ville).length,
    enrichies: enrichiesCount,
  };

  return {
    entreprises: finalEntreprises,
    sourceStats,
    erreurs,
    total: finalEntreprises.length,
    qualite,
  };
}

export const SOURCES_DISPONIBLES: Array<{
  id: SourceScraping;
  label: string;
  description: string;
  contactInfo: boolean;
}> = [
  {
    id: "pages_jaunes",
    label: "Pages Jaunes",
    description: "Annuaire pro (peut etre bloque selon IP)",
    contactInfo: true,
  },
  {
    id: "annuaire118",
    label: "Annuaire 118000",
    description: "Annuaire telephonique francais - telephones garantis",
    contactInfo: true,
  },
  {
    id: "openstreetmap",
    label: "OpenStreetMap",
    description: "Gratuit, sans limite - telephone + email + horaires",
    contactInfo: true,
  },
  {
    id: "kompass",
    label: "Kompass",
    description: "Annuaire B2B - Telephones et emails",
    contactInfo: true,
  },
  {
    id: "europages",
    label: "Europages",
    description: "Annuaire B2B europeen - Contacts directs",
    contactInfo: true,
  },
  {
    id: "api_gouv",
    label: "API Gouvernement",
    description: "Registre officiel - Donnees legales (sans contacts)",
    contactInfo: false,
  },
  {
    id: "societe",
    label: "Societe.com",
    description: "Donnees publiques - SIREN/SIRET",
    contactInfo: false,
  },
];

export const SECTEURS_NAF: Array<{ code: string; label: string }> = [
  { code: "62", label: "Informatique et services informatiques" },
  { code: "47", label: "Commerce de detail" },
  { code: "41", label: "Construction de batiments" },
  { code: "86", label: "Activites pour la sante humaine" },
  { code: "55", label: "Hebergement" },
  { code: "56", label: "Restauration" },
  { code: "69", label: "Activites juridiques et comptables" },
  { code: "70", label: "Conseil et management" },
  { code: "73", label: "Publicite et marketing" },
  { code: "74", label: "Autres activites specialisees" },
  { code: "78", label: "Activites liees a l'emploi" },
  { code: "71", label: "Ingenierie et architecture" },
  { code: "85", label: "Enseignement" },
  { code: "90", label: "Arts et spectacles" },
  { code: "96", label: "Autres services personnels" },
];
