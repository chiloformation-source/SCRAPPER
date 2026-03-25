import { NextResponse } from "next/server";
import { db, initDB } from "@/lib/db";
import { entreprises, campagnes } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    initDB();

    const [totalEntreprises] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entreprises);

    const [totalCampagnes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campagnes);

    const avecEmail = await db
      .select({ count: sql<number>`count(*)` })
      .from(entreprises)
      .where(sql`email IS NOT NULL AND email != ''`);

    const avecTel = await db
      .select({ count: sql<number>`count(*)` })
      .from(entreprises)
      .where(sql`telephone IS NOT NULL AND telephone != ''`);

    const topVilles = await db
      .select({
        ville: entreprises.ville,
        count: sql<number>`count(*) as count`,
      })
      .from(entreprises)
      .where(sql`ville IS NOT NULL AND ville != ''`)
      .groupBy(entreprises.ville)
      .orderBy(sql`count DESC`)
      .limit(5);

    const topSecteurs = await db
      .select({
        secteur: entreprises.secteurActivite,
        count: sql<number>`count(*) as count`,
      })
      .from(entreprises)
      .where(sql`secteur_activite IS NOT NULL AND secteur_activite != ''`)
      .groupBy(entreprises.secteurActivite)
      .orderBy(sql`count DESC`)
      .limit(5);

    const recentes = await db
      .select({
        source: entreprises.source,
        count: sql<number>`count(*) as count`,
      })
      .from(entreprises)
      .groupBy(entreprises.source)
      .orderBy(sql`count DESC`)
      .limit(10);

    const total = totalEntreprises.count;
    const nTel = avecTel[0].count;
    const nEmail = avecEmail[0].count;

    // Score moyen de complétude
    const [scoreRow] = await db
      .select({ avg: sql<number>`ROUND(AVG(COALESCE(score_qualite, 0)), 1)` })
      .from(entreprises);

    const tauxTelephone = total > 0 ? Math.round((nTel / total) * 100) : 0;
    const tauxEmail = total > 0 ? Math.round((nEmail / total) * 100) : 0;
    const scoreMoyenQualite = scoreRow?.avg ?? 0;

    return NextResponse.json({
      totalEntreprises: total,
      totalCampagnes: totalCampagnes.count,
      avecEmail: nEmail,
      avecTel: nTel,
      tauxTelephone,
      tauxEmail,
      scoreMoyenQualite,
      topVilles,
      topSecteurs,
      sources: recentes,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
