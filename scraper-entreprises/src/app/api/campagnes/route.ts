import { NextResponse } from "next/server";
import { db, initDB } from "@/lib/db";
import { campagnes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    initDB();
    const results = await db
      .select()
      .from(campagnes)
      .orderBy(desc(campagnes.createdAt));

    return NextResponse.json({ data: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
