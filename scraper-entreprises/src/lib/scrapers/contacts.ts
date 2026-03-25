/**
 * Scrapers spécialisés pour extraire Nom + Téléphone + Email
 * Sources : Pages Jaunes, Kompass, Europages, sites web entreprises
 * v3 - Cookie pre-flight + JSON-LD + tel:/mailto: links
 */

import * as cheerio from "cheerio";
import { NouvelleEntreprise } from "../db/schema";
import { buildHeaders, fetchWithRetry, getRandomUA } from "./http-client";

const HEADERS = buildHeaders();

const EMAIL_REGEX = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}\b/g;
const TEL_REGEX_FR = /(?:\+33[\s.\-]?|0)([1-9])(?:[\s.\-]?\d{2}){4}/g;

function cleanTel(raw: string): string {
  const cleaned = raw.replace(/[\s.\-\(\)]/g, "").replace(/^\+33/, "0");
  return cleaned.length >= 10 ? cleaned : "";
}

function filterEmail(email: string): boolean {
  const bad = [
    "example", "sentry", "@2x", ".png", ".jpg", ".gif", ".svg", ".webp",
    "noreply", "no-reply", "donotreply", "test@", "user@", "@domain",
    "@email", "votre@", "your@", "privacy@", "legal@", "dpo@", "rgpd@",
    "info@pagesjaunes", "info@kompass",
  ];
  return (
    !bad.some((b) => email.toLowerCase().includes(b)) &&
    email.length < 80 &&
    email.includes(".") &&
    !email.endsWith(".js") &&
    !email.endsWith(".css")
  );
}

function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_REGEX) || []).filter(filterEmail))];
}

function extractTels(text: string): string[] {
  return [...new Set((text.match(TEL_REGEX_FR) || []).map(cleanTel).filter(Boolean))];
}

// ── Cookie cache pour Pages Jaunes ───────────────────────────────────────────
let pjCookieCache = "";
let pjCookieExpiry = 0;

/**
 * Pré-vol : récupère les cookies de session Pages Jaunes en visitant la homepage
 */
async function getPJCookies(): Promise<string> {
  if (pjCookieCache && Date.now() < pjCookieExpiry) {
    return pjCookieCache;
  }

  try {
    const res = await fetch("https://www.pagesjaunes.fr/", {
      headers: {
        "User-Agent": getRandomUA(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!res.ok && res.status !== 200) console.warn(`PJ pre-flight: HTTP ${res.status}`);

    const cookies: string[] = [];
    // Node.js 18+ - getSetCookie() retourne toutes les valeurs Set-Cookie
    if (typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
      const setCookies = (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie();
      for (const c of setCookies) {
        const nameValue = c.split(";")[0].trim();
        if (nameValue) cookies.push(nameValue);
      }
    }

    if (cookies.length > 0) {
      pjCookieCache = cookies.join("; ");
      pjCookieExpiry = Date.now() + 8 * 60 * 1000; // 8 min
      // cookies PJ obtenus
    } else {
      console.warn("PJ pre-flight: aucun cookie reçu");
    }
  } catch (err) {
    console.warn("PJ pre-flight erreur:", err);
  }

  return pjCookieCache;
}

/**
 * Parse les blocs JSON-LD d'une page HTML pour extraire des entreprises
 */
function parseJsonLdEntreprises(html: string, source: string): NouvelleEntreprise[] {
  const results: NouvelleEntreprise[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const nodes: Record<string, unknown>[] = item["@graph"]
          ? (item["@graph"] as Record<string, unknown>[])
          : [item];

        for (const node of nodes) {
          const type = String(node["@type"] || "");
          const isLocalBusiness =
            type.includes("LocalBusiness") ||
            type.includes("Restaurant") ||
            type.includes("Store") ||
            type.includes("Organization") ||
            type.includes("Hotel") ||
            type.includes("FoodEstablishment");

          if (!isLocalBusiness) continue;

          const nom = String(node.name || "").trim();
          if (!nom || nom.length < 2) continue;

          const addr = node.address as Record<string, unknown> | undefined;
          const adresse = addr?.streetAddress ? String(addr.streetAddress) : undefined;
          const codePostal = addr?.postalCode ? String(addr.postalCode) : undefined;
          const ville = addr?.addressLocality ? String(addr.addressLocality) : undefined;

          const telRaw = String(node.telephone || "").trim();
          const telephone = telRaw ? cleanTel(telRaw) || undefined : undefined;
          const email = node.email ? String(node.email).trim() : undefined;

          let siteWeb: string | undefined;
          const urlVal = node.url || node.sameAs;
          if (typeof urlVal === "string" && urlVal.startsWith("http")) {
            siteWeb = urlVal;
          } else if (Array.isArray(urlVal)) {
            siteWeb = (urlVal as string[]).find((u) => u.startsWith("http"));
          }

          results.push({
            nom,
            telephone,
            email: email && filterEmail(email) ? email : undefined,
            adresse,
            codePostal,
            ville,
            siteWeb,
            source,
            statut: "actif",
          });
        }
      }
    } catch {
      // JSON invalide
    }
  }

  return results;
}

export interface PaginatedResults {
  results: NouvelleEntreprise[];
  hasMore: boolean;
}

/**
 * Pages Jaunes - Source principale pour téléphones pros
 * Stratégie v3 :
 * 1. Pre-vol cookies pour éviter le 403
 * 2. JSON-LD (le plus fiable)
 * 3. a[href^="tel:"] comme ancre + remontée DOM
 * 4. Sélecteurs CSS en fallback
 */
export async function scrapePagesJaunes(
  quoi: string,
  ou: string,
  page = 1
): Promise<PaginatedResults> {
  try {
    // Obtenir les cookies de session
    const cookies = await getPJCookies();

    const url = `https://www.pagesjaunes.fr/pagejaunes/recherche?quoiqui=${encodeURIComponent(quoi)}&ou=${encodeURIComponent(ou)}&proximite=0&page=${page}`;

    const requestHeaders: Record<string, string> = {
      "User-Agent": getRandomUA(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Cache-Control": "max-age=0",
      Referer: "https://www.pagesjaunes.fr/",
    };

    if (cookies) {
      requestHeaders["Cookie"] = cookies;
    }

    const res = await fetchWithRetry(url, { headers: requestHeaders });

    if (!res) {
      console.warn("Pages Jaunes: pas de réponse (null)");
      return { results: [], hasMore: false };
    }

    const html = await res.text();

    // Détecter page anti-bot
    const htmlLower = html.toLowerCase();
    const isBlocked =
      html.length < 500 ||
      htmlLower.includes("access denied") ||
      htmlLower.includes("vous êtes bloqué") ||
      htmlLower.includes("__cf_chl_") ||
      (htmlLower.includes("captcha") && html.length < 5000);

    if (isBlocked) {
      console.warn(`Pages Jaunes: page bloquée (anti-bot), taille=${html.length}`);
      return { results: [], hasMore: false };
    }

    console.log(`Pages Jaunes HTML: ${html.length} chars`);

    const $ = cheerio.load(html);

    // ── APPROCHE 1 : JSON-LD ──────────────────────────────
    const ldResults = parseJsonLdEntreprises(html, "Pages Jaunes");
    console.log(`PJ JSON-LD: ${ldResults.length} résultats`);
    if (ldResults.length > 0) {
      const hasMore =
        ldResults.length >= 20 &&
        !!$(
          "a[aria-label*='suivant'], a[aria-label*='next'], [class*='pagination'] a[rel='next'], .pagination .next"
        ).length;
      return { results: ldResults, hasMore };
    }

    // ── APPROCHE 2 : a[href^="tel:"] comme ancre ─────────
    const telLinksCount = $("a[href^='tel:']").length;
    const results: NouvelleEntreprise[] = [];
    const seenNoms = new Set<string>();

    $("a[href^='tel:']").each((_, telEl) => {
      const telHref = $(telEl).attr("href") || "";
      const telephone = cleanTel(telHref.replace("tel:", "").trim());
      if (!telephone) return;

      // Remonter dans le DOM pour trouver le bloc de la fiche
      const card = $(telEl).closest(
        "[class*='bi-'], [class*='result'], [class*='card'], article, li.item, div.item"
      );

      if (!card.length) return;

      // Nom : premier heading ou lien principal dans la carte
      const nom =
        card.find("h2, h3, h4, [class*='denomination'], [class*='name'], [class*='title']").first().text().trim() ||
        card.find("a[href*='/pages/'], a[href*='/trouver/']").first().text().trim();

      if (!nom || nom.length < 2 || seenNoms.has(nom.toLowerCase())) return;
      seenNoms.add(nom.toLowerCase());

      // Adresse
      const adresseEl = card.find(
        "[class*='address'], [class*='adresse'], .adr, [itemtype*='PostalAddress'], address"
      ).first();
      const adresseText = adresseEl.text().replace(/\s+/g, " ").trim();
      const cpVille = adresseText.match(/(\d{5})\s+(.+)$/);

      // Email
      const mailtoHref = card.find("a[href^='mailto:']").attr("href");
      const email = mailtoHref
        ? mailtoHref.replace("mailto:", "").split("?")[0].trim()
        : undefined;

      // Site web
      const siteWebEl = card
        .find("a[href^='http']:not([href*='pagesjaunes']):not([href*='facebook']):not([href*='google'])")
        .first();
      const siteWeb = siteWebEl.attr("href") || undefined;

      results.push({
        nom,
        telephone,
        email: email && filterEmail(email) ? email : undefined,
        adresse: adresseText || undefined,
        codePostal: cpVille?.[1] || undefined,
        ville: cpVille?.[2]?.trim() || ou || undefined,
        siteWeb,
        source: "Pages Jaunes",
        statut: "actif",
      });
    });

    if (results.length > 0) {
      const hasMore =
        results.length >= 20 &&
        !!(
          $("a[aria-label*='suivant'], [class*='pagination'] .next, a[rel='next']").length
        );
      return { results, hasMore };
    }

    // ── APPROCHE 3 : CSS fallback ─────────────────────────
    const fallbackResults: NouvelleEntreprise[] = [];

    $("[class*='bi-container'], .bi, article[class*='result'], [class*='ListItem']").each((_, el) => {
      const nom =
        $(el)
          .find("[class*='bi-denomination'], .denomination-links, h3, h2, [class*='name']")
          .first()
          .text()
          .trim();
      if (!nom || nom.length < 2) return;

      let telephone = "";
      const telEl = $(el).find("a[href^='tel:']").first();
      if (telEl.length) {
        telephone = cleanTel(telEl.attr("href")?.replace("tel:", "") || "");
      }
      if (!telephone) {
        const tels = extractTels($(el).text());
        if (tels.length) telephone = tels[0];
      }

      const adresse = $(el)
        .find("[class*='address'], [class*='adresse'], .adr, address")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const cpVille = adresse.match(/(\d{5})\s+(.+)$/);

      const siteWeb =
        $(el)
          .find("a[href^='http']:not([href*='pagesjaunes'])")
          .first()
          .attr("href") || undefined;

      fallbackResults.push({
        nom,
        telephone: telephone || undefined,
        adresse: adresse || undefined,
        codePostal: cpVille?.[1] || undefined,
        ville: cpVille?.[2]?.trim() || ou || undefined,
        siteWeb,
        source: "Pages Jaunes",
        statut: "actif",
      });
    });

    const hasMore =
      fallbackResults.length >= 20 &&
      !!$("[class*='pagination'] a[class*='next'], .next-page, a[aria-label='Page suivante']").length;

    return { results: fallbackResults, hasMore };
  } catch (err) {
    console.error("Pages Jaunes erreur:", err);
    return { results: [], hasMore: false };
  }
}

/**
 * Kompass - Annuaire professionnel B2B
 */
export async function scrapeKompass(
  quoi: string,
  ou: string
): Promise<NouvelleEntreprise[]> {
  try {
    const url = `https://fr.kompass.com/searchCompanies/?text=${encodeURIComponent(quoi)}&location=${encodeURIComponent(ou)}`;

    const res = await fetchWithRetry(url, { headers: HEADERS });
    if (!res) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    // JSON-LD first
    const ldResults = parseJsonLdEntreprises(html, "Kompass");
    if (ldResults.length > 0) return ldResults;

    const results: NouvelleEntreprise[] = [];

    $(".company-result, [class*='company-item'], .result-item, [class*='CompanyCard']").each((_, el) => {
      const nom = $(el).find("h2, h3, .company-name, [class*='name']").first().text().trim();
      if (!nom || nom.length < 2) return;

      const telephone =
        cleanTel($(el).find("a[href^='tel:']").attr("href")?.replace("tel:", "") || "") ||
        cleanTel($(el).find("[class*='phone']").first().text().trim()) ||
        undefined;

      const email =
        $(el).find("a[href^='mailto:']").attr("href")?.replace("mailto:", "").split("?")[0].trim() ||
        undefined;

      const adresse = $(el).find("[class*='address'], [class*='location']").first().text().trim();
      const siteWeb = $(el).find("a[href^='http']:not([href*='kompass'])").first().attr("href");

      results.push({
        nom,
        telephone: telephone || undefined,
        email: email && filterEmail(email) ? email : undefined,
        adresse: adresse || undefined,
        siteWeb,
        source: "Kompass",
        statut: "actif",
      });
    });

    return results;
  } catch {
    return [];
  }
}

/**
 * Europages - Annuaire B2B européen
 */
export async function scrapeEuropages(
  quoi: string,
  ou: string
): Promise<NouvelleEntreprise[]> {
  try {
    const url = `https://www.europages.fr/entreprises/${encodeURIComponent(ou)}/${encodeURIComponent(quoi)}.html`;

    const res = await fetchWithRetry(url, { headers: HEADERS });
    if (!res) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    // JSON-LD first
    const ldResults = parseJsonLdEntreprises(html, "Europages");
    if (ldResults.length > 0) return ldResults;

    const results: NouvelleEntreprise[] = [];

    $("[class*='company-card'], [class*='result-card'], article").each((_, el) => {
      const nom = $(el)
        .find("h2, h3, [class*='company-name'], [class*='title']")
        .first()
        .text()
        .trim();
      if (!nom || nom.length < 2) return;

      const telephone =
        cleanTel($(el).find("a[href^='tel:']").attr("href")?.replace("tel:", "") || "") ||
        cleanTel($(el).find("[class*='phone'], [class*='tel']").first().text().trim()) ||
        undefined;

      const email =
        $(el).find("a[href^='mailto:']").attr("href")?.replace("mailto:", "").split("?")[0] ||
        undefined;

      const adresse = $(el)
        .find("[class*='address'], [class*='location'], [class*='city']")
        .first()
        .text()
        .trim();

      results.push({
        nom,
        telephone: telephone || undefined,
        email: email && filterEmail(email) ? email : undefined,
        adresse: adresse || undefined,
        ville: ou || undefined,
        source: "Europages",
        statut: "actif",
      });
    });

    return results;
  } catch {
    return [];
  }
}

// Domaines à exclure lors de la recherche de site officiel
const DOMAINES_ANNUAIRE = [
  "pages-jaunes.fr", "pagesjaunes.fr", "118000.fr", "118712.fr",
  "kompass.com", "europages.com", "europages.fr", "societe.com",
  "verif.com", "manageo.fr", "pappers.fr", "infogreffe.fr",
  "annuaire.laposte.fr", "mappy.fr", "le118008.fr", "facebook.com",
  "linkedin.com", "instagram.com", "twitter.com", "tripadvisor",
  "yelp.com", "foursquare.com", "google.com", "wikipedia.org",
  "sirene.fr", "data.gouv.fr", "legifrance.gouv.fr",
];

function isAnnuaire(url: string): boolean {
  return DOMAINES_ANNUAIRE.some((d) => url.includes(d));
}

/**
 * Trouver le site web d'une entreprise via DuckDuckGo HTML SERP
 * (plus efficace que l'API Instant Answers pour les petits commerces français)
 */
export async function trouverSiteWeb(
  nom: string,
  ville?: string | null
): Promise<string | undefined> {
  try {
    const q = ville ? `${nom} ${ville} site officiel` : `${nom} site officiel`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": getRandomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    }, 1);

    if (!res) return undefined;
    const html = await res.text();
    const $ = cheerio.load(html);

    // DuckDuckGo HTML: les résultats sont dans .result__a avec href
    const found: string[] = [];
    $("a.result__a").each((_, el) => {
      const href = $(el).attr("href") || "";
      // DuckDuckGo redirige via uddg= param
      const uddg = new URL("https://x.com" + href).searchParams.get("uddg");
      const finalUrl = uddg ? decodeURIComponent(uddg) : href;
      if (finalUrl.startsWith("http") && !isAnnuaire(finalUrl)) {
        found.push(finalUrl);
      }
    });

    if (found.length > 0) return found[0];
  } catch {
    // Ignorer
  }
  return undefined;
}
