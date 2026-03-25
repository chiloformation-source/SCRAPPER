/**
 * Scraper 118000.fr — Annuaire téléphonique français
 * Remplace Pages Jaunes (bloqué).
 * Structure URL : /v_{ville}_{dept}/c_{categorie}/{page}
 * Téléphone disponible dans l'attribut data-info de chaque carte.
 * Pas d'email disponible sur ce site.
 */

import * as cheerio from "cheerio";
import { NouvelleEntreprise } from "../db/schema";
import { fetchWithRetry } from "./http-client";

// Mapping ville → slug URL et code département
const VILLES_118: Record<string, { slug: string; dept: string }> = {
  paris: { slug: "paris", dept: "75" },
  lyon: { slug: "lyon", dept: "69" },
  marseille: { slug: "marseille", dept: "13" },
  toulouse: { slug: "toulouse", dept: "31" },
  nice: { slug: "nice", dept: "06" },
  nantes: { slug: "nantes", dept: "44" },
  bordeaux: { slug: "bordeaux", dept: "33" },
  lille: { slug: "lille", dept: "59" },
  rennes: { slug: "rennes", dept: "35" },
  strasbourg: { slug: "strasbourg", dept: "67" },
  montpellier: { slug: "montpellier", dept: "34" },
  grenoble: { slug: "grenoble", dept: "38" },
  dijon: { slug: "dijon", dept: "21" },
  angers: { slug: "angers", dept: "49" },
  reims: { slug: "reims", dept: "51" },
  toulon: { slug: "toulon", dept: "83" },
  brest: { slug: "brest", dept: "29" },
  metz: { slug: "metz", dept: "57" },
  perpignan: { slug: "perpignan", dept: "66" },
  caen: { slug: "caen", dept: "14" },
  nancy: { slug: "nancy", dept: "54" },
  rouen: { slug: "rouen", dept: "76" },
  amiens: { slug: "amiens", dept: "80" },
  limoges: { slug: "limoges", dept: "87" },
  nimes: { slug: "nimes", dept: "30" },
  pau: { slug: "pau", dept: "64" },
  tours: { slug: "tours", dept: "37" },
  saint_etienne: { slug: "saint-etienne", dept: "42" },
  aix_en_provence: { slug: "aix-en-provence", dept: "13" },
  clermont_ferrand: { slug: "clermont-ferrand", dept: "63" },
  le_havre: { slug: "le-havre", dept: "76" },
  le_mans: { slug: "le-mans", dept: "72" },
  avignon: { slug: "avignon", dept: "84" },
  poitiers: { slug: "poitiers", dept: "86" },
  mulhouse: { slug: "mulhouse", dept: "68" },
  annecy: { slug: "annecy", dept: "74" },
  la_rochelle: { slug: "la-rochelle", dept: "17" },
  orleans: { slug: "orleans", dept: "45" },
  dunkerque: { slug: "dunkerque", dept: "59" },
  calais: { slug: "calais", dept: "62" },
  lorient: { slug: "lorient", dept: "56" },
  vannes: { slug: "vannes", dept: "56" },
  quimper: { slug: "quimper", dept: "29" },
  saint_malo: { slug: "saint-malo", dept: "35" },
  bayonne: { slug: "bayonne", dept: "64" },
  valence: { slug: "valence", dept: "26" },
  colmar: { slug: "colmar", dept: "68" },
  troyes: { slug: "troyes", dept: "10" },
  besancon: { slug: "besancon", dept: "25" },
  bourges: { slug: "bourges", dept: "18" },
  angouleme: { slug: "angouleme", dept: "16" },
  cannes: { slug: "cannes", dept: "06" },
  antibes: { slug: "antibes", dept: "06" },
  hyeres: { slug: "hyeres", dept: "83" },
  chartres: { slug: "chartres", dept: "28" },
  cherbourg: { slug: "cherbourg-en-cotentin", dept: "50" },
  montauban: { slug: "montauban", dept: "82" },
  albi: { slug: "albi", dept: "81" },
  tarbes: { slug: "tarbes", dept: "65" },
  laval: { slug: "laval", dept: "53" },
  saint_nazaire: { slug: "saint-nazaire", dept: "44" },
  ajaccio: { slug: "ajaccio", dept: "2a" },
  bastia: { slug: "bastia", dept: "2b" },
};

function normaliserVille118(ville: string): { slug: string; dept: string } | null {
  const key = ville
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\s\-]+/g, "_")
    .trim();

  if (VILLES_118[key]) return VILLES_118[key];

  // Recherche partielle
  const found = Object.keys(VILLES_118).find(
    (k) => k.startsWith(key) || key.startsWith(k) || k.includes(key)
  );
  return found ? VILLES_118[found] : null;
}

function normaliserCategorie(query: string): string {
  // Nettoyer la catégorie pour URL 118000.fr
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

interface Info118 {
  name?: string;
  tel?: string;
  mainLine?: string;
  address?: string;
  cp?: string;
  city?: string;
  urlDetail?: string;
  comCode?: string;
}

/**
 * Scrape 118000.fr pour une activité et une ville données
 * @param query - Activité (restaurant, plombier, coiffeur...)
 * @param ville - Ville française
 * @param page - Numéro de page (commence à 1)
 */
export async function scrapeAnnuaire118(
  query: string,
  ville: string,
  page = 1
): Promise<{ results: NouvelleEntreprise[]; hasMore: boolean }> {
  const villeInfo = normaliserVille118(ville);
  if (!villeInfo) {
    console.warn(`118000.fr: ville inconnue "${ville}"`);
    return { results: [], hasMore: false };
  }

  const categorie = normaliserCategorie(query);
  const pageStr = page > 1 ? `/${page}` : "";
  const url = `https://www.118000.fr/v_${villeInfo.slug}_${villeInfo.dept}/c_${categorie}${pageStr}`;

  const res = await fetchWithRetry(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9",
      "Referer": "https://www.118000.fr/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    },
  }, 2);

  if (!res) {
    console.warn(`118000.fr: pas de réponse pour "${query}" à ${ville}`);
    return { results: [], hasMore: false };
  }

  const html = await res.text();

  // Vérifier si la page a des résultats
  if (html.length < 2000 || html.includes("Aucun résultat") || html.includes("aucun resultat")) {
    return { results: [], hasMore: false };
  }

  const $ = cheerio.load(html);
  const results: NouvelleEntreprise[] = [];

  // Parser chaque carte de résultat
  $("section.card").each((_, el) => {
    try {
      // L'attribut data-info contient un JSON avec toutes les données
      const rawInfo = $(el).find("[data-info]").attr("data-info") || "";
      if (!rawInfo) return;

      const info: Info118 = JSON.parse(rawInfo);

      const nom = info.name?.trim();
      if (!nom || nom.length < 2) return;

      // Téléphone (dans data-info.tel ou data-info.mainLine)
      const telRaw = info.tel || info.mainLine || "";
      let telephone: string | undefined;
      if (telRaw) {
        const cleaned = telRaw.replace(/[\s.\-\(\)]/g, "").replace(/^(\+33|0033)/, "0");
        if (cleaned.length === 10 && /^0[1-9]/.test(cleaned)) {
          telephone = cleaned;
        }
      }

      // Adresse
      const adresse = info.address?.trim() || undefined;
      const codePostal = info.cp?.trim() || undefined;
      const villeResult = info.city
        ? info.city.charAt(0).toUpperCase() + info.city.slice(1).toLowerCase()
        : ville || undefined;

      // Coordonnées
      const lat = parseFloat($(el).find("[data-lat]").attr("data-lat") || "");
      const lon = parseFloat($(el).find("[data-lng]").attr("data-lng") || "");

      // Lien vers la fiche détaillée
      const siteWeb = undefined; // 118000.fr ne donne pas le site web de l'entreprise

      results.push({
        nom,
        telephone,
        adresse,
        codePostal,
        ville: villeResult,
        latitude: isNaN(lat) ? undefined : lat,
        longitude: isNaN(lon) ? undefined : lon,
        siteWeb,
        source: "118000.fr",
        statut: "actif",
      });
    } catch {
      // Ignorer les cartes mal formées
    }
  });

  // Vérifier s'il y a une page suivante
  const hasMore = results.length >= 15 && $("ul#pagination [data-page]").length > 1;

  console.log(`118000.fr: ${results.length} résultats pour "${query}" à ${ville} (page ${page})`);

  return { results, hasMore };
}
