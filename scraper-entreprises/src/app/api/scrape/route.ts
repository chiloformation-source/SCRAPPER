import { NextRequest, NextResponse } from "next/server";
import { scraperEntreprises, ParametresRecherche, SourceScraping } from "@/lib/scrapers";
import { db, initDB } from "@/lib/db";
import { entreprises, campagnes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    initDB();
    const body = await request.json();

    const params: ParametresRecherche = {
      query: body.query || "",
      ville: body.ville,
      codePostal: body.codePostal,
      codeNaf: body.codeNaf,
      sources: (body.sources as SourceScraping[]) || ["pages_jaunes", "openstreetmap"],
      limit: body.limit || 100,
    };

    if (!params.query && !params.ville && !params.codePostal) {
      return NextResponse.json(
        { error: "Au moins un critère de recherche est requis" },
        { status: 400 }
      );
    }

    // Créer une campagne si demandé
    let campagneId: number | undefined;
    if (body.saveCampagne && body.campagneName) {
      const [campagne] = await db.insert(campagnes).values({
        nom: body.campagneName,
        keywords: params.query,
        ville: params.ville,
        codePostal: params.codePostal,
        secteur: params.codeNaf,
        statut: "en_cours",
        sources: params.sources?.join(","),
      }).returning();
      campagneId = campagne.id;
    }

    // Lancer le scraping avec enrichissement automatique
    const resultat = await scraperEntreprises(params);

    // Sauvegarder en base
    let saves = 0;
    for (const e of resultat.entreprises) {
      try {
        await db.insert(entreprises).values({
          ...e,
          campagneId,
        }).onConflictDoNothing();
        saves++;
      } catch {
        // Ignorer les doublons
      }
    }

    // Mettre à jour la campagne
    if (campagneId) {
      await db.update(campagnes)
        .set({
          statut: "terminée",
          nombreResultats: saves,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(campagnes.id, campagneId));
    }

    return NextResponse.json({
      success: true,
      total: resultat.total,
      saved: saves,
      sourceStats: resultat.sourceStats,
      erreurs: resultat.erreurs,
      entreprises: resultat.entreprises,
      qualite: resultat.qualite,
      campagneId,
    });
  } catch (error) {
    console.error("Erreur scraping:", error);
    return NextResponse.json(
      { error: "Erreur lors du scraping: " + String(error) },
      { status: 500 }
    );
  }
}
