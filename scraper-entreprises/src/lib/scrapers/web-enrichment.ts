/**
 * Enrichissement avancé des contacts via scraping du site web
 * v2 - Fetching PARALLÈLE des pages, timeout 4s par page
 */

import * as cheerio from "cheerio";
import { NouvelleEntreprise } from "../db/schema";
import { fetchWithRetry } from "./http-client";

const TEL_REGEX_FR = /(?:\+33[\s.\-]?|0)([1-9])(?:[\s.\-]?\d{2}){4}/g;
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}\b/g;

function cleanTel(raw: string): string {
  const c = raw.replace(/[\s.\-\(\)]/g, "").replace(/^\+33/, "0");
  return c.length >= 10 ? c : "";
}

function filterEmail(email: string): boolean {
  const bad = [
    "example", "sentry", "@2x", ".png", ".jpg", ".gif", ".svg", ".webp",
    "noreply", "no-reply", "donotreply", "test@", "user@", "@domain",
    "@email", "votre@", "your@", "privacy", "legal@", "dpo@", "rgpd@",
    "wixpress", "wordpress", "shopify", "squarespace", "mailchimp",
    "google", "facebook", "twitter", "instagram", "linkedin",
  ];
  return (
    !bad.some((b) => email.toLowerCase().includes(b)) &&
    email.length < 80 &&
    email.length > 5 &&
    email.includes("@") &&
    email.includes(".") &&
    !email.endsWith(".js") &&
    !email.endsWith(".css") &&
    !email.endsWith(".png")
  );
}

function extractEmailsFromText(text: string): string[] {
  return [...new Set((text.match(EMAIL_REGEX) || []).filter(filterEmail))];
}

function extractTelsFromText(text: string): string[] {
  return [...new Set((text.match(TEL_REGEX_FR) || []).map(cleanTel).filter(Boolean))];
}

interface ContactsEnrichis {
  email?: string;
  telephone?: string;
  emails: string[];
  telephones: string[];
}

function parseJsonLd(html: string): Partial<ContactsEnrichis> {
  const result: Partial<ContactsEnrichis> = {};
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
          if (node.telephone && !result.telephone) {
            result.telephone = cleanTel(String(node.telephone)) || undefined;
          }
          if (node.email && !result.email) {
            const e = String(node.email);
            if (filterEmail(e)) result.email = e;
          }
          const cp = node.contactPoint as Record<string, unknown> | undefined;
          if (cp?.telephone && !result.telephone) {
            result.telephone = cleanTel(String(cp.telephone)) || undefined;
          }
          if (cp?.email && !result.email) {
            const e = String(cp.email);
            if (filterEmail(e)) result.email = e;
          }
        }
      }
    } catch {
      // JSON invalide
    }
  }

  return result;
}

function parseHtml(html: string): ContactsEnrichis {
  const $ = cheerio.load(html);
  const emails: string[] = [];
  const telephones: string[] = [];

  // 1. Liens mailto et tel (priorité maximale)
  $("a[href^='mailto:']").each((_, el) => {
    const email = $(el).attr("href")?.replace("mailto:", "").split("?")[0].trim();
    if (email && filterEmail(email)) emails.push(email);
  });

  $("a[href^='tel:']").each((_, el) => {
    const tel = cleanTel($(el).attr("href")?.replace("tel:", "").trim() || "");
    if (tel) telephones.push(tel);
  });

  // 2. JSON-LD schema.org
  const ld = parseJsonLd(html);
  if (ld.email && !emails.includes(ld.email)) emails.push(ld.email);
  if (ld.telephone && !telephones.includes(ld.telephone)) telephones.push(ld.telephone);

  // 3. Attributs itemprop
  $("[itemprop='telephone'], [itemprop='phone']").each((_, el) => {
    const tel = cleanTel($(el).attr("content") || $(el).text().trim());
    if (tel) telephones.push(tel);
  });
  $("[itemprop='email']").each((_, el) => {
    const email = $(el).attr("content") || $(el).text().trim();
    if (email && filterEmail(email)) emails.push(email);
  });

  // 4. Footer - zone riche en contacts
  const footerText = $("footer, #footer, .footer, [class*='footer'], [id*='footer']").text();
  if (footerText) {
    emails.push(...extractEmailsFromText(footerText));
    telephones.push(...extractTelsFromText(footerText));
  }

  // 5. Zone de contact
  const contactZone = $(
    "[class*='contact'], [id*='contact'], .coordonnees, .coordinates, [class*='coord']"
  ).text();
  if (contactZone) {
    emails.push(...extractEmailsFromText(contactZone));
    telephones.push(...extractTelsFromText(contactZone));
  }

  // 6. Body entier en dernier recours
  if (emails.length === 0 || telephones.length === 0) {
    const bodyText = $("body").text();
    if (emails.length === 0) emails.push(...extractEmailsFromText(bodyText));
    if (telephones.length === 0) telephones.push(...extractTelsFromText(bodyText));
  }

  const uniqueEmails = [...new Set(emails)].filter(filterEmail);
  const uniqueTels = [...new Set(telephones)].filter((t) => t.length >= 10);

  return {
    email: uniqueEmails[0],
    telephone: uniqueTels[0],
    emails: uniqueEmails,
    telephones: uniqueTels,
  };
}

/**
 * Fetch une page avec timeout dédié
 */
async function fetchPage(
  url: string,
  timeoutMs: number,
  outerSignal?: AbortSignal
): Promise<string | null> {
  if (outerSignal?.aborted) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  // Propager l'annulation externe
  const onAbort = () => ctrl.abort();
  outerSignal?.addEventListener("abort", onAbort);

  try {
    const res = await fetchWithRetry(url, {}, 1, ctrl.signal);
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onAbort);
    return res ? await res.text() : null;
  } catch {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onAbort);
    return null;
  }
}

function mergeContacts(target: ContactsEnrichis, source: ContactsEnrichis) {
  if (!target.email && source.email) target.email = source.email;
  if (!target.telephone && source.telephone) target.telephone = source.telephone;
  target.emails = [...new Set([...target.emails, ...source.emails])];
  target.telephones = [...new Set([...target.telephones, ...source.telephones])];
}

// Pages à tester en PHASE 1 (en parallèle)
const PAGES_PHASE1 = ["", "/contact", "/nous-contacter"];
// Pages à tester en PHASE 2 (séquentiellement, si besoin)
const PAGES_PHASE2 = [
  "/contactez-nous",
  "/contact-us",
  "/a-propos",
  "/about",
  "/mentions-legales",
  "/qui-sommes-nous",
  "/equipe",
];

export async function enrichirContacts(
  entreprise: NouvelleEntreprise,
  signal?: AbortSignal
): Promise<ContactsEnrichis> {
  if (!entreprise.siteWeb && !entreprise.nom) {
    return { emails: [], telephones: [] };
  }

  let baseUrl = entreprise.siteWeb;

  // Si pas de site web → DuckDuckGo rapide
  if (!baseUrl) {
    const { trouverSiteWeb } = await import("./contacts");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      baseUrl = await trouverSiteWeb(entreprise.nom, entreprise.ville);
    } catch {
      // Ignorer
    } finally {
      clearTimeout(timer);
    }
  }

  if (!baseUrl) return { emails: [], telephones: [] };

  const base = baseUrl.replace(/\/$/, "");
  const combined: ContactsEnrichis = { emails: [], telephones: [] };

  // ── PHASE 1 : 3 pages en PARALLÈLE (4s timeout chacune) ──
  const phase1Results = await Promise.allSettled(
    PAGES_PHASE1.map((p) => fetchPage(p ? `${base}${p}` : base, 4000, signal))
  );

  for (const r of phase1Results) {
    if (r.status === "fulfilled" && r.value) {
      mergeContacts(combined, parseHtml(r.value));
    }
  }

  // Stop si on a déjà les deux
  if (combined.email && combined.telephone) return combined;
  if (signal?.aborted) return combined;

  // ── PHASE 2 : pages restantes en séquentiel (3s timeout) ──
  for (const page of PAGES_PHASE2) {
    if (signal?.aborted) break;
    if (combined.email && combined.telephone) break;

    const html = await fetchPage(`${base}${page}`, 3000, signal);
    if (html) mergeContacts(combined, parseHtml(html));
  }

  return combined;
}
