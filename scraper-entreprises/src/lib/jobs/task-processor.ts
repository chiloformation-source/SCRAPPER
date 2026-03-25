/**
 * Processeur de taches - Google Maps uniquement
 */

import { NouvelleEntreprise } from "../db/schema";
import { scrapeGoogleMaps } from "../scrapers/googlemaps";
import { enrichirContacts } from "../scrapers/web-enrichment";
import { randomDelay } from "../scrapers/http-client";

export interface TaskParams {
  type: "scrape_googlemaps" | "enrich_web";
  query?: string;
  ville?: string;
  entreprise?: NouvelleEntreprise;
}

export interface TaskResult {
  entreprises: NouvelleEntreprise[];
  hasMore: boolean;
  nextPage?: number;
  error?: string;
}

export async function processTask(
  params: TaskParams,
  signal?: AbortSignal
): Promise<TaskResult> {
  // Delai aleatoire entre requetes pour eviter les blocages
  await randomDelay(2000, 5000);

  if (signal?.aborted) {
    return { entreprises: [], hasMore: false };
  }

  try {
    switch (params.type) {
      case "scrape_googlemaps": {
        const r = await scrapeGoogleMaps(
          params.query || "restaurant",
          params.ville || "Paris",
          signal
        );
        return { entreprises: r.results, hasMore: false };
      }

      case "enrich_web": {
        if (!params.entreprise) return { entreprises: [], hasMore: false };
        const contacts = await enrichirContacts(params.entreprise, signal);
        const enriched = {
          ...params.entreprise,
          email: params.entreprise.email || contacts.email,
          telephone: params.entreprise.telephone || contacts.telephone,
          enrichiAt: new Date().toISOString(),
        };
        return { entreprises: [enriched], hasMore: false };
      }

      default:
        return { entreprises: [], hasMore: false };
    }
  } catch (err) {
    return {
      entreprises: [],
      hasMore: false,
      error: String(err),
    };
  }
}
