import { NextRequest, NextResponse } from "next/server";
import { db, initDB } from "@/lib/db";
import { entreprises } from "@/lib/db/schema";
import { like, or, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    initDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const campagneId = searchParams.get("campagneId");
    const format = searchParams.get("format") || "csv";

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(entreprises.nom, `%${search}%`),
          like(entreprises.ville, `%${search}%`)
        )
      );
    }
    if (campagneId) {
      conditions.push(eq(entreprises.campagneId, parseInt(campagneId)));
    }

    const data = await db
      .select()
      .from(entreprises)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    if (format === "json") {
      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": 'attachment; filename="entreprises.json"',
        },
      });
    }

    // CSV
    const headers = [
      "Nom", "SIREN", "SIRET", "Forme Juridique", "Secteur",
      "Code NAF", "Adresse", "Code Postal", "Ville", "Département",
      "Région", "Téléphone", "Email", "Site Web", "LinkedIn",
      "Effectifs", "CA (€)", "Date Création", "Dirigeant", "Source"
    ];

    const rows = data.map((e) => [
      e.nom || "",
      e.siren || "",
      e.siret || "",
      e.formeJuridique || "",
      e.secteurActivite || "",
      e.codeNaf || "",
      e.adresse || "",
      e.codePostal || "",
      e.ville || "",
      e.departement || "",
      e.region || "",
      e.telephone || "",
      e.email || "",
      e.siteWeb || "",
      e.linkedin || "",
      e.effectifs || "",
      e.chiffreAffaires?.toString() || "",
      e.dateCreation || "",
      e.dirigeant || "",
      e.source || "",
    ]);

    const csv = [
      headers.join(";"),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
      ),
    ].join("\n");

    const bom = "\uFEFF"; // BOM pour Excel
    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="entreprises.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
