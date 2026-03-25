/**
 * Google Maps Scraper — Puppeteer (navigateur headless)
 *
 * Google Maps charge les données business par AJAX, pas dans le HTML.
 * On DOIT utiliser un vrai navigateur pour obtenir les numéros de téléphone.
 *
 * Flux :
 *  1. Ouvrir Google Maps search dans Chrome headless
 *  2. Accepter les cookies si nécessaire
 *  3. Attendre le chargement des résultats
 *  4. Scroller la liste pour charger plus de résultats
 *  5. Pour chaque résultat : cliquer, extraire nom + tel + adresse + site
 *  6. Retourner la liste
 */

import puppeteer, { Browser, Page } from "puppeteer-core";
import { NouvelleEntreprise } from "../db/schema";
import { enrichirContacts } from "./web-enrichment";

// Chrome installé sur le système — détection auto Windows / Linux
const CHROME_PATH = process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome-stable";

// ── Gestion du navigateur singleton ──────────────────────────────────────────
// On garde une instance de Chrome ouverte pour réutiliser entre les tâches
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;

  console.log("[GoogleMaps] Lancement de Chrome headless…");
  _browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,900",
      "--lang=fr-FR",
      // Réduire la détection de bot
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: { width: 1280, height: 900 },
  });

  // Fermer proprement si le processus Node s'arrête
  process.once("exit", () => { _browser?.close().catch(() => {}); });

  return _browser;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acceptCookies(page: Page) {
  try {
    // Attendre un peu pour que le dialog de consentement apparaisse
    await sleep(2000);

    // Méthode 1 : Bouton "Tout accepter" par aria-label
    let accepted = false;
    const selectors = [
      'button[aria-label="Tout accepter"]',
      'button[aria-label="Accept all"]',
      'button#L2AGLb', // ID courant du bouton Google consent
      'button#W0wltc', // ID alternatif
      'form[action*="consent"] button:first-of-type',
    ];

    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        accepted = true;
        console.log(`[GoogleMaps] Cookies acceptés via ${sel}`);
        break;
      }
    }

    // Méthode 2 : chercher par texte dans la page
    if (!accepted) {
      accepted = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || "";
          if (text === "tout accepter" || text === "accept all" || text === "j'accepte") {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      if (accepted) console.log("[GoogleMaps] Cookies acceptés via texte");
    }

    if (accepted) await sleep(2000);
    else console.log("[GoogleMaps] Pas de mur de consentement détecté");

  } catch (err) {
    console.log(`[GoogleMaps] acceptCookies: ${err}`);
  }
}

interface BusinessData {
  nom: string;
  telephone?: string;
  adresse?: string;
  siteWeb?: string;
  note?: number;
  nombreAvis?: number;
  categorie?: string;
}

// ── Extraction des données d'un business depuis le panel de détails ─────────

async function extractBusinessDetail(page: Page): Promise<BusinessData | null> {
  try {
    return await page.evaluate(() => {
      // Nom du business
      const nameEl =
        document.querySelector('h1.DUwDvf') ||
        document.querySelector('[data-attrid="title"] span') ||
        document.querySelector('h1');
      const nom = nameEl?.textContent?.trim() || "";
      if (!nom) return null;

      // Téléphone — chercher dans les boutons d'action ou les attributs data
      let telephone = "";

      // Méthode 1: bouton "Appeler" avec data-tooltip ou aria-label contenant le numéro
      const phoneBtn = document.querySelector(
        'button[data-tooltip*="téléphone"], button[aria-label*="téléphone"], ' +
        'a[data-tooltip*="téléphone"], a[aria-label*="Appeler"], ' +
        'button[data-item-id*="phone"], [data-item-id="phone"]'
      );
      if (phoneBtn) {
        const label = phoneBtn.getAttribute("aria-label") || phoneBtn.getAttribute("data-tooltip") || "";
        const phoneMatch = label.match(/0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}/);
        if (phoneMatch) telephone = phoneMatch[0].replace(/[\s.\-]/g, "");
      }

      // Méthode 2: chercher dans les "info rows" (lignes d'info du panel)
      if (!telephone) {
        const infoRows = document.querySelectorAll('[data-item-id]');
        for (const row of infoRows) {
          const itemId = row.getAttribute("data-item-id") || "";
          if (itemId.startsWith("phone:")) {
            telephone = itemId.replace("phone:tel:", "").replace("phone:", "").replace(/[\s.\-+]/g, "");
            if (telephone.startsWith("33")) telephone = "0" + telephone.slice(2);
            break;
          }
        }
      }

      // Méthode 3: chercher des liens tel:
      if (!telephone) {
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        for (const link of telLinks) {
          const href = link.getAttribute("href") || "";
          const num = href.replace("tel:", "").replace(/[\s.\-+]/g, "");
          if (num.length >= 10) {
            telephone = num.startsWith("33") ? "0" + num.slice(2) : num;
            break;
          }
        }
      }

      // Méthode 4: regex dans le texte visible du panel
      if (!telephone) {
        const panelText = document.querySelector('[role="main"]')?.textContent || "";
        const phoneMatch = panelText.match(/(?:\+33[\s.]?|0)[1-9](?:[\s.]?\d{2}){4}/);
        if (phoneMatch) {
          telephone = phoneMatch[0].replace(/[\s.\-+]/g, "").replace(/^33/, "0");
        }
      }

      // Adresse
      let adresse = "";
      const addrEl = document.querySelector('[data-item-id="address"] .fontBodyMedium') ||
                     document.querySelector('button[data-item-id="address"]');
      if (addrEl) {
        adresse = addrEl.textContent?.trim() || "";
      }

      // Site web
      let siteWeb = "";
      const siteEl = document.querySelector('a[data-item-id="authority"]') ||
                     document.querySelector('[data-item-id*="website"] a');
      if (siteEl) {
        siteWeb = siteEl.getAttribute("href") || "";
      }

      // Note
      let note: number | undefined;
      const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]') ||
                       document.querySelector('[role="img"][aria-label*="étoile"]');
      if (ratingEl) {
        const ratingText = ratingEl.textContent?.replace(",", ".") || "";
        const parsed = parseFloat(ratingText);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) note = parsed;
      }

      // Nombre d'avis
      let nombreAvis: number | undefined;
      const reviewEl = document.querySelector('div.F7nice span[aria-label*="avis"]');
      if (reviewEl) {
        const reviewText = reviewEl.textContent?.replace(/[^\d]/g, "") || "";
        const parsed = parseInt(reviewText);
        if (!isNaN(parsed)) nombreAvis = parsed;
      }

      // Catégorie
      const catEl = document.querySelector('button.DkEaL');
      const categorie = catEl?.textContent?.trim() || "";

      return { nom, telephone, adresse, siteWeb, note, nombreAvis, categorie };
    });
  } catch (err) {
    console.warn(`[GoogleMaps] Erreur extraction: ${err}`);
    return null;
  }
}

// ── Scraper principal ────────────────────────────────────────────────────────

export async function scrapeGoogleMaps(
  query: string,
  ville: string,
  signal?: AbortSignal
): Promise<{ results: NouvelleEntreprise[]; hasMore: false }> {
  const searchUrl = `https://www.google.fr/maps/search/${encodeURIComponent(query + " " + ville)}`;
  console.log(`[GoogleMaps] Scraping "${query}" à ${ville}…`);

  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    if (signal?.aborted) return { results: [], hasMore: false };

    page = await browser.newPage();

    // Stealth : masquer la détection de Puppeteer
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Naviguer vers la recherche Google Maps
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    if (signal?.aborted) { await page.close(); return { results: [], hasMore: false }; }

    // Accepter les cookies RGPD si nécessaire
    await acceptCookies(page);

    // Attendre que les résultats chargent (le feed de résultats à gauche)
    try {
      await page.waitForSelector('[role="feed"], .Nv2PK, div.m6QErb', { timeout: 15000 });
    } catch {
      // Debug : sauvegarder un screenshot pour comprendre ce qui bloque
      const debugPath = require("path").join(process.cwd(), "data", "gmaps-debug.png");
      await page.screenshot({ path: debugPath }).catch(() => {});
      const pageUrl = page.url();
      console.warn(`[GoogleMaps] Pas de résultats. URL: ${pageUrl}`);
      console.warn(`[GoogleMaps] Screenshot debug sauvegardé dans data/gmaps-debug.png`);

      // Peut-être que la page a redirigé vers le consent — re-tenter
      if (pageUrl.includes("consent.google") || pageUrl.includes("accounts.google")) {
        console.warn("[GoogleMaps] Redirigé vers consent/login — on accepte et on retente");
        await acceptCookies(page);
        await sleep(2000);
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await sleep(3000);
        try {
          await page.waitForSelector('[role="feed"], .Nv2PK, div.m6QErb', { timeout: 15000 });
        } catch {
          console.warn("[GoogleMaps] Toujours pas de résultats après re-tentative");
          await page.close();
          return { results: [], hasMore: false };
        }
      } else {
        await page.close();
        return { results: [], hasMore: false };
      }
    }

    if (signal?.aborted) { await page.close(); return { results: [], hasMore: false }; }

    // Scroller la liste des résultats JUSQU'AU BOUT pour tout charger
    const feedSelector = '[role="feed"]';
    let previousCount = 0;
    let sameCountRounds = 0;

    for (let scroll = 0; scroll < 50; scroll++) {
      if (signal?.aborted) break;

      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) feed.scrollTop = feed.scrollHeight;
      }, feedSelector);
      await sleep(1200);

      const currentCount = (await page.$$('.Nv2PK a.hfpxzc')).length;

      // Vérifier si on a atteint la fin de la liste
      if (currentCount === previousCount) {
        sameCountRounds++;
        // Si aucun nouveau résultat après 3 scrolls, on a tout chargé
        if (sameCountRounds >= 3) {
          console.log(`[GoogleMaps] Fin de liste atteinte après ${scroll} scrolls`);
          break;
        }
      } else {
        sameCountRounds = 0;
        previousCount = currentCount;
      }

      // Log progression tous les 10 scrolls
      if (scroll % 10 === 0 && scroll > 0) {
        console.log(`[GoogleMaps] Scroll #${scroll}: ${currentCount} résultats chargés…`);
      }
    }

    // Récupérer TOUS les éléments de résultats
    const resultLinks = await page.$$('.Nv2PK a.hfpxzc');
    const totalResults = resultLinks.length;
    console.log(`[GoogleMaps] ${totalResults} résultats chargés pour "${query}" à ${ville}`);

    const results: NouvelleEntreprise[] = [];
    const seenNames = new Set<string>();

    // Pour CHAQUE résultat : cliquer, extraire les données, revenir — SANS LIMITE
    for (let i = 0; i < totalResults; i++) {
      if (signal?.aborted) break;

      try {
        // Re-sélectionner les liens (le DOM peut changer après chaque clic)
        const links = await page.$$('.Nv2PK a.hfpxzc');
        if (i >= links.length) break;

        // Scroller l'élément en vue avant de cliquer
        await links[i].evaluate((el) => el.scrollIntoView({ block: "center" }));
        await sleep(300);

        // Cliquer sur le résultat
        await links[i].click();
        await sleep(1500); // Attendre le chargement du panel de détails

        // Extraire les données
        const data = await extractBusinessDetail(page);

        if (data && data.nom && !seenNames.has(data.nom.toLowerCase())) {
          seenNames.add(data.nom.toLowerCase());

          results.push({
            nom: data.nom,
            telephone: data.telephone || undefined,
            adresse: data.adresse || undefined,
            siteWeb: data.siteWeb || undefined,
            note: data.note,
            nombreAvis: data.nombreAvis,
            categorie: data.categorie || undefined,
            ville,
            secteurActivite: query,
            source: "Google Maps",
            statut: "actif",
          } as NouvelleEntreprise);
        }

        // Revenir à la liste (bouton retour)
        await page.evaluate(() => {
          const backBtn = document.querySelector('button[aria-label="Retour"]') ||
                          document.querySelector('button.hYkMKe');
          if (backBtn) (backBtn as HTMLElement).click();
        });
        await sleep(600);

      } catch (err) {
        console.warn(`[GoogleMaps] Erreur résultat #${i}: ${err}`);
        // Tenter de revenir à la liste
        try {
          await page.evaluate(() => {
            const backBtn = document.querySelector('button[aria-label="Retour"]') ||
                            document.querySelector('button.hYkMKe');
            if (backBtn) (backBtn as HTMLElement).click();
          });
          await sleep(600);
        } catch { /* ignore */ }
      }

      // Log progression tous les 20 résultats
      if ((i + 1) % 20 === 0) {
        console.log(`[GoogleMaps] ${i + 1}/${totalResults} traités — ${results.length} extraits`);
      }
    }

    const withPhone = results.filter((r) => r.telephone).length;
    console.log(`[GoogleMaps] ${results.length} entreprises extraites (${withPhone} avec tél.) — enrichissement emails…`);

    await page.close();

    // ── ENRICHISSEMENT EMAIL : visiter chaque site web pour trouver l'email ──
    const withSite = results.filter((r) => r.siteWeb && !r.email);
    if (withSite.length > 0) {
      console.log(`[GoogleMaps] Enrichissement: ${withSite.length} sites web à visiter…`);

      // Traiter par batch de 5 en parallèle
      for (let b = 0; b < withSite.length; b += 5) {
        if (signal?.aborted) break;
        const batch = withSite.slice(b, b + 5);
        await Promise.allSettled(
          batch.map(async (ent) => {
            try {
              const contacts = await enrichirContacts(ent, signal);
              if (contacts.email) {
                ent.email = contacts.email;
              }
              // Aussi récupérer le tél si on l'avait pas
              if (!ent.telephone && contacts.telephone) {
                ent.telephone = contacts.telephone;
              }
            } catch { /* timeout ou erreur — on continue */ }
          })
        );
      }

      const withEmail = results.filter((r) => r.email).length;
      const withPhoneAfter = results.filter((r) => r.telephone).length;
      console.log(`[GoogleMaps] TOTAL: ${results.length} entreprises — ${withPhoneAfter} tél. — ${withEmail} emails — "${query}" à ${ville}`);
    } else {
      console.log(`[GoogleMaps] TOTAL: ${results.length} entreprises (${withPhone} tél.) pour "${query}" à ${ville}`);
    }

    return { results, hasMore: false };

  } catch (err) {
    console.error(`[GoogleMaps] Erreur fatale: ${err}`);
    if (page) await page.close().catch(() => {});
    return { results: [], hasMore: false };
  }
}

// Nettoyage : fermer le navigateur
export async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
