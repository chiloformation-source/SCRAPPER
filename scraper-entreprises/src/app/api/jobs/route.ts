import { NextRequest, NextResponse } from "next/server";
import { sqlite, initDB } from "@/lib/db";
import { jobEngine, TOTAL_VILLES_FRANCE } from "@/lib/jobs/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    initDB();
    const allJobs = sqlite.prepare(
      "SELECT id, nom, secteur, villes, sources, statut, progression, total_taches, taches_terminees, entreprises_trouvees, created_at, started_at, finished_at FROM jobs ORDER BY created_at DESC LIMIT 50"
    ).all() as {
      id: number; nom: string; secteur: string; villes: string; sources: string;
      statut: string; progression: number; total_taches: number;
      taches_terminees: number; entreprises_trouvees: number;
      created_at: string; started_at: string | null; finished_at: string | null;
    }[];

    return NextResponse.json({
      jobs: allJobs.map((j) => ({
        ...j,
        villes: j.villes ? JSON.parse(j.villes) : [],
        sources: j.sources ? JSON.parse(j.sources) : [],
        isRunning: jobEngine.isRunning(j.id),
        villeEnCours: jobEngine.isRunning(j.id) ? jobEngine.getVilleEnCours() : undefined,
      })),
      totalVillesFrance: TOTAL_VILLES_FRANCE,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    initDB();
    const body = await request.json();

    if (!body.secteur) {
      return NextResponse.json(
        { error: "secteur est requis (ex: restaurant, coiffeur)" },
        { status: 400 }
      );
    }

    // Créer le job — si pas de villes, prend TOUTES les villes de France
    const jobId = await jobEngine.createJob({
      nom: body.nom || `${body.secteur} — France entière (${TOTAL_VILLES_FRANCE} villes)`,
      secteur: body.secteur,
      villes: body.villes, // undefined = toutes les villes
      options: {
        enrichirEmails: body.enrichirEmails || false,
        delaiMs: body.delaiMs || 3000,
      },
    });

    // Auto-demarrer
    if (body.autoStart !== false) {
      await jobEngine.startJob(jobId);
    }

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
