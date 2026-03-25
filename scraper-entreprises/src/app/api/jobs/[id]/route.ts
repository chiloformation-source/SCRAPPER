import { NextRequest, NextResponse } from "next/server";
import { sqlite, initDB } from "@/lib/db";
import { jobEngine } from "@/lib/jobs/engine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDB();
    const { id } = await params;
    const jobId = parseInt(id);

    const status = jobEngine.getStatus(jobId);
    if (!status) {
      return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
    }

    // Dernieres taches traitees
    const recentTasks = sqlite.prepare(
      "SELECT type, params, statut, resultat, processed_at FROM job_tasks WHERE job_id = ? ORDER BY id DESC LIMIT 10"
    ).all(jobId);

    return NextResponse.json({
      ...status,
      isRunning: jobEngine.isRunning(jobId),
      recentTasks,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDB();
    const { id } = await params;
    const jobId = parseInt(id);
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
      case "resume":
        await jobEngine.startJob(jobId);
        return NextResponse.json({ success: true, statut: "en_cours" });

      case "pause":
        await jobEngine.pauseJob(jobId);
        return NextResponse.json({ success: true, statut: "pause" });

      case "stop":
        await jobEngine.stopJob(jobId);
        return NextResponse.json({ success: true, statut: "arrete" });

      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDB();
    const { id } = await params;
    const jobId = parseInt(id);

    await jobEngine.stopJob(jobId);
    sqlite.prepare("DELETE FROM job_tasks WHERE job_id = ?").run(jobId);
    sqlite.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
