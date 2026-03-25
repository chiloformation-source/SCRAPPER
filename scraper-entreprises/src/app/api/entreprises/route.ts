import { NextRequest, NextResponse } from "next/server";
import { db, initDB } from "@/lib/db";
import { entreprises } from "@/lib/db/schema";
import { like, or, desc, asc, eq, and, isNotNull, isNull, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    initDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const ville = searchParams.get("ville") || "";
    const campagneId = searchParams.get("campagneId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    // Filtres avancés
    const avecTel = searchParams.get("avecTel");
    const avecEmail = searchParams.get("avecEmail");
    const source = searchParams.get("source") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(entreprises.nom, `%${search}%`),
          like(entreprises.siren, `%${search}%`),
          like(entreprises.secteurActivite, `%${search}%`)
        )
      );
    }

    if (ville) {
      conditions.push(like(entreprises.ville, `%${ville}%`));
    }

    if (campagneId) {
      conditions.push(eq(entreprises.campagneId, parseInt(campagneId)));
    }

    if (avecTel === "true") conditions.push(isNotNull(entreprises.telephone));
    if (avecTel === "false") conditions.push(isNull(entreprises.telephone));
    if (avecEmail === "true") conditions.push(isNotNull(entreprises.email));
    if (avecEmail === "false") conditions.push(isNull(entreprises.email));
    if (source) conditions.push(like(entreprises.source, `%${source}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Tri dynamique
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colMap: Record<string, any> = {
      nom: entreprises.nom,
      telephone: entreprises.telephone,
      email: entreprises.email,
      source: entreprises.source,
      createdAt: entreprises.createdAt,
    };
    const sortCol = colMap[sortBy] || entreprises.createdAt;
    const orderFn = order === "asc" ? asc(sortCol) : desc(sortCol);

    const results = await db
      .select()
      .from(entreprises)
      .where(whereClause)
      .orderBy(orderFn)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: results,
      page,
      limit,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Suppression bulk par IDs
  try {
    initDB();
    const body = await request.json();
    const ids: number[] = body.ids || [];
    if (ids.length === 0) return NextResponse.json({ error: "IDs requis" }, { status: 400 });
    for (const id of ids) {
      await db.delete(entreprises).where(eq(entreprises.id, id));
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    initDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await db.delete(entreprises).where(eq(entreprises.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
