/**
 * Scraper Google/DuckDuckGo - Méthodes gratuites pour enrichir les données
 * Utilise DuckDuckGo Instant Answer API (gratuite, sans auth)
 */

import * as cheerio from "cheerio";
import { NouvelleEntreprise } from "../db/schema";

export interface EnrichissementWeb {
  email?: string;
  telephone?: string;
  siteWeb?: string;
  description?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
}

/**
 * Recherche via DuckDuckGo (gratuit, sans API key)
 */
export async function searchDuckDuckGo(
  query: string
): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      no_html: "1",
      skip_disambig: "1",
    });

    const response = await fetch(
      `https://api.duckduckgo.com/?${params}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();

    const results: { title: string; url: string; snippet: string }[] = [];

    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.Abstract || "",
      });
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 10)) {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(" - ")[0] || "",
            url: topic.FirstURL,
            snippet: topic.Text || "",
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Scraper de page web pour enrichir les données d'entreprise
 */
export async function scrapeEntreprisePage(url: string): Promise<EnrichissementWeb> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return {};

    const html = await response.text();
    const $ = cheerio.load(html);

    const result: EnrichissementWeb = {};

    // Extraire les emails depuis le HTML
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const texte = $("body").text();
    const emails = texte.match(emailRegex);
    if (emails) {
      // Filtrer les emails génériques
      const emailsValides = emails.filter(
        (e) =>
          !e.includes("example") &&
          !e.includes("@sentry") &&
          !e.includes("@gtm") &&
          !e.includes(".png") &&
          !e.includes(".jpg")
      );
      if (emailsValides.length > 0) {
        result.email = emailsValides[0];
      }
    }

    // Extraire les téléphones
    const telRegex = /(?:\+33|0033|0)[1-9](?:[\s.-]?\d{2}){4}/g;
    const tels = texte.match(telRegex);
    if (tels && tels.length > 0) {
      result.telephone = tels[0].replace(/[\s.-]/g, "");
    }

    // Extraire description
    const metaDesc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content");
    if (metaDesc) {
      result.description = metaDesc.substring(0, 500);
    }

    // Extraire liens réseaux sociaux
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("linkedin.com/company") && !result.linkedin) {
        result.linkedin = href;
      }
      if (href.includes("twitter.com/") && !result.twitter) {
        result.twitter = href;
      }
      if (href.includes("facebook.com/") && !result.facebook) {
        result.facebook = href;
      }
    });

    return result;
  } catch {
    return {};
  }
}

/**
 * Recherche sur Pages Jaunes (gratuit, scraping HTML)
 */
export async function searchPagesJaunes(
  quoi: string,
  ou: string
): Promise<NouvelleEntreprise[]> {
  try {
    const params = new URLSearchParams({
      quoiqui: quoi,
      ou: ou,
    });

    const url = `https://www.pagesjaunes.fr/pagesblanches/recherche?${params}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
        Referer: "https://www.pagesjaunes.fr/",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const entreprises: NouvelleEntreprise[] = [];

    // Scraper les cartes de résultats
    $(".bi-content, .result-content, [class*='result']").each((_, el) => {
      const nom =
        $(el).find(".denomination-links, .nom, h3").first().text().trim();
      const adresse = $(el)
        .find(".address, .adresse, [class*='address']")
        .first()
        .text()
        .trim();
      const tel = $(el)
        .find(".tel, .telephone, [class*='phone']")
        .first()
        .text()
        .trim();

      if (nom) {
        entreprises.push({
          nom,
          adresse,
          telephone: tel,
          ville: ou,
          source: "Pages Jaunes",
          statut: "actif",
        });
      }
    });

    return entreprises;
  } catch (error) {
    console.error("Erreur Pages Jaunes:", error);
    return [];
  }
}

/**
 * Scraper Societe.com (données publiques)
 */
export async function searchSociete(
  query: string,
  ville?: string
): Promise<NouvelleEntreprise[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = ville
      ? `https://www.societe.com/cgi-bin/search?champs=${encodedQuery}&ville=${encodeURIComponent(ville)}`
      : `https://www.societe.com/cgi-bin/search?champs=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const entreprises: NouvelleEntreprise[] = [];

    $(".search-result, .resultat, tbody tr").each((_, el) => {
      const lien = $(el).find("a").first();
      const nom = lien.text().trim();
      const href = lien.attr("href") || "";

      // Extraire SIREN depuis l'URL
      const sirenMatch = href.match(/\/(\d{9})\//);
      const siren = sirenMatch ? sirenMatch[1] : undefined;

      const infos = $(el).find("td, .info").text().trim();
      const codePostalMatch = infos.match(/(\d{5})/);
      const codePostal = codePostalMatch ? codePostalMatch[1] : undefined;

      if (nom && nom.length > 2) {
        entreprises.push({
          nom,
          siren,
          codePostal,
          source: "Societe.com",
          statut: "actif",
        });
      }
    });

    return entreprises.slice(0, 20);
  } catch (error) {
    console.error("Erreur Societe.com:", error);
    return [];
  }
}
