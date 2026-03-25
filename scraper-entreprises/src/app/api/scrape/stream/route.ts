/**
 * GET /api/scrape/stream — Résultats en temps réel via Server-Sent Events
 * Paramètres URL : query, ville, sources (csv), limit
 */

import { NextRequest } from "next/server";
import { scraperEntreprises, SourceScraping, ModeRecherche } from "@/lib/scrapers";
import { db, initDB } from "@/lib/db";
import { entreprises, campagnes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query") || "";
  const ville = searchParams.get("ville") || undefined;
  const villesParam = searchParams.get("villes") || "";
  const villes = villesParam ? villesParam.split(",").filter(Boolean) : undefined;
  const sourcesParam = searchParams.get("sources") || "openstreetmap,annuaire118,api_gouv";
  const limit = parseInt(searchParams.get("limit") || "100");
  const mode = (searchParams.get("mode") || "complet") as ModeRecherche;
  const saveCampagne = searchParams.get("saveCampagne") === "1";
  const campagneName = searchParams.get("campagneName") || "";

  const sources = sourcesParam.split(",").filter(Boolean) as SourceScraping[];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        initDB();

        let campagneId: number | undefined;
        if (saveCampagne && campagneName) {
          const [campagne] = await db.insert(campagnes).values({
            nom: campagneName,
            keywords: query,
            ville: ville,
            statut: "en_cours",
            sources: sources.join(","),
          }).returning();
          campagneId = campagne.id;
        }

        const resultat = await scraperEntreprises({
          query,
          ville: villes ? undefined : ville,
          villes,
          sources,
          limit,
          mode,
          onEntreprise: (e) => send("entreprise", e),
        });

        // Sauvegarder en base
        let saves = 0;
        for (const e of resultat.entreprises) {
          try {
            await db.insert(entreprises).values({ ...e, campagneId }).onConflictDoNothing();
            saves++;
          } catch { /* doublon */ }
        }

        if (campagneId) {
          await db.update(campagnes)
            .set({ statut: "terminée", nombreResultats: saves, updatedAt: new Date().toISOString() })
            .where(eq(campagnes.id, campagneId));
        }

        send("stats", { ...resultat.sourceStats });
        send("done", {
          total: resultat.total,
          saved: saves,
          qualite: resultat.qualite,
          erreurs: resultat.erreurs,
          campagneId,
        });
      } catch (err) {
        const msg = String(err);
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
