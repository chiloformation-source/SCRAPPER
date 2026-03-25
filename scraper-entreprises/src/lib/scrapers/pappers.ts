/**
 * Scraper Pappers.fr - API gratuite pour les données d'entreprises françaises
 * Utilise l'API publique Pappers (1000 req/mois gratuits)
 * Documentation: https://www.pappers.fr/api/documentation
 */

import { NouvelleEntreprise } from "../db/schema";

const PAPPERS_BASE = "https://api.pappers.fr/v2";

// Clé API Pappers gratuite (à obtenir sur pappers.fr)
const API_KEY = process.env.PAPPERS_API_KEY || "";

export interface PappersEntreprise {
  siren: string;
  nom_entreprise: string;
  siege?: {
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
    departement?: string;
    region?: string;
  };
  forme_juridique?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  date_creation?: string;
  dirigeants?: Array<{
    nom?: string;
    prenom?: string;
    qualite?: string;
  }>;
  finances?: Array<{
    annee?: number;
    chiffre_affaires?: number;
    effectif?: number;
  }>;
  site_web?: string;
  numero_tva_intracommunautaire?: string;
}

export async function searchPappers(
  query: string,
  options: {
    ville?: string;
    codePostal?: string;
    codeNaf?: string;
    page?: number;
    perPage?: number;
  } = {}
): Promise<NouvelleEntreprise[]> {
  if (!API_KEY) {
    console.warn("Clé API Pappers non configurée, utilisation du mode sans authentification");
    return searchPappersSansClef(query, options);
  }

  try {
    const params = new URLSearchParams({
      q: query,
      api_token: API_KEY,
      par_page: String(options.perPage || 20),
      page: String(options.page || 1),
    });

    if (options.ville) params.append("siege", options.ville);
    if (options.codePostal) params.append("code_postal", options.codePostal);
    if (options.codeNaf) params.append("code_naf", options.codeNaf);

    const response = await fetch(`${PAPPERS_BASE}/recherche?${params}`);

    if (!response.ok) {
      throw new Error(`Pappers API erreur: ${response.status}`);
    }

    const data = await response.json();

    return (data.resultats || []).map((e: PappersEntreprise) =>
      mapPappersToEntreprise(e)
    );
  } catch (error) {
    console.error("Erreur Pappers API:", error);
    return [];
  }
}

// Mode sans clé - utilise les données publiques de base
async function searchPappersSansClef(
  query: string,
  options: { ville?: string; codePostal?: string } = {}
): Promise<NouvelleEntreprise[]> {
  try {
    // Utiliser l'API publique INSEE SIRENE comme fallback
    return await searchSirene(query, options);
  } catch {
    return [];
  }
}

function mapPappersToEntreprise(e: PappersEntreprise): NouvelleEntreprise {
  const dirigeant = e.dirigeants?.[0];
  const finance = e.finances?.[0];

  return {
    nom: e.nom_entreprise,
    siren: e.siren,
    formeJuridique: e.forme_juridique,
    codeNaf: e.code_naf,
    secteurActivite: e.libelle_code_naf,
    adresse: e.siege?.adresse_ligne_1,
    codePostal: e.siege?.code_postal,
    ville: e.siege?.ville,
    departement: e.siege?.departement,
    region: e.siege?.region,
    siteWeb: e.site_web,
    dateCreation: e.date_creation,
    dirigeant: dirigeant
      ? `${dirigeant.prenom || ""} ${dirigeant.nom || ""}`.trim()
      : undefined,
    chiffreAffaires: finance?.chiffre_affaires,
    effectifs: finance?.effectif ? String(finance.effectif) : undefined,
    source: "Pappers.fr",
    statut: "actif",
  };
}

/**
 * API INSEE SIRENE - 100% gratuite, sans authentification pour les recherches de base
 */
export async function searchSirene(
  query: string,
  options: { ville?: string; codePostal?: string; codeNaf?: string } = {}
): Promise<NouvelleEntreprise[]> {
  try {
    let queryStr = `denominationUniteLegale:*${encodeURIComponent(query)}*`;

    if (options.codePostal) {
      queryStr += ` AND codePostalEtablissement:${options.codePostal}`;
    }
    if (options.ville) {
      queryStr += ` AND libelleCommuneEtablissement:*${encodeURIComponent(options.ville)}*`;
    }
    if (options.codeNaf) {
      queryStr += ` AND activitePrincipaleUniteLegale:${options.codeNaf}`;
    }

    const params = new URLSearchParams({
      q: queryStr,
      nombre: "20",
      champs: "siret,denominationUniteLegale,activitePrincipaleUniteLegale,categorieJuridiqueUniteLegale,dateCreationUniteLegale,codePostalEtablissement,libelleCommuneEtablissement,numeroVoieEtablissement,typeVoieEtablissement,libelleVoieEtablissement",
    });

    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siret?${params}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.INSEE_TOKEN || ""}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      // Fallback vers l'API alternative
      return searchSireneAlt(query, options);
    }

    const data = await response.json();

    return (data.etablissements || []).map((e: Record<string, unknown>) => {
      const unite = e.uniteLegale as Record<string, unknown>;
      const adresse = e.adresseEtablissement as Record<string, unknown>;

      return {
        nom: String(unite?.denominationUniteLegale || ""),
        siret: String(e.siret || ""),
        siren: String(e.siret || "").substring(0, 9),
        codeNaf: String(unite?.activitePrincipaleUniteLegale || ""),
        adresse: [
          adresse?.numeroVoieEtablissement,
          adresse?.typeVoieEtablissement,
          adresse?.libelleVoieEtablissement,
        ]
          .filter(Boolean)
          .join(" "),
        codePostal: String(adresse?.codePostalEtablissement || ""),
        ville: String(adresse?.libelleCommuneEtablissement || ""),
        dateCreation: String(unite?.dateCreationUniteLegale || ""),
        source: "INSEE SIRENE",
        statut: "actif",
      };
    });
  } catch (error) {
    console.error("Erreur SIRENE API:", error);
    return searchSireneAlt(query, options);
  }
}

/**
 * Alternative: API Recherche Entreprise data.gouv.fr (100% gratuite, sans auth)
 */
export async function searchSireneAlt(
  query: string,
  options: { ville?: string; codePostal?: string } = {}
): Promise<NouvelleEntreprise[]> {
  try {
    // Combiner query + ville pour filtrer géographiquement
    const q = options.ville ? `${query} ${options.ville}` : query;
    const params = new URLSearchParams({
      q,
      per_page: "25",
    });

    if (options.codePostal) params.append("code_postal", options.codePostal);

    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    return (data.results || []).map((e: Record<string, unknown>) => {
      const siege = e.siege as Record<string, unknown>;

      return {
        nom: String(e.nom_complet || e.nom_raison_sociale || ""),
        siren: String(e.siren || ""),
        siret: String(siege?.siret || ""),
        formeJuridique: String(e.nature_juridique || ""),
        codeNaf: String(e.activite_principale || ""),
        secteurActivite: String(e.section_activite_principale || ""),
        adresse: String(siege?.adresse || ""),
        codePostal: String(siege?.code_postal || ""),
        ville: String(siege?.commune || ""),
        departement: String(siege?.departement || ""),
        region: String(siege?.region || ""),
        dateCreation: String(e.date_creation || ""),
        dirigeant: e.dirigeants
          ? (e.dirigeants as Array<Record<string, unknown>>)
              .map((d) => `${d.prenom || ""} ${d.nom || ""}`.trim())
              .filter(Boolean)
              .join(", ")
          : undefined,
        effectifs: String(e.tranche_effectif_salarie || ""),
        source: "Recherche Entreprises (data.gouv.fr)",
        statut: String(e.etat_administratif) === "A" ? "actif" : "fermé",
      };
    });
  } catch (error) {
    console.error("Erreur API recherche-entreprises:", error);
    return [];
  }
}
