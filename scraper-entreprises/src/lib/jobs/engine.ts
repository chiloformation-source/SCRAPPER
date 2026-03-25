/**
 * Job Engine - Singleton Node.js pour le scraping continu Google Maps
 * Survit au HMR de Next.js via globalThis
 */

import { db, sqlite } from "../db";
import { entreprises } from "../db/schema";
import { processTask, TaskParams } from "./task-processor";
import { VILLES_BBOX } from "../scrapers/overpass";
import { NouvelleEntreprise } from "../db/schema";

// Liste des villes avec noms affichables
const NOMS_VILLES: Record<string, string> = {
  paris: "Paris", lyon: "Lyon", marseille: "Marseille", toulouse: "Toulouse",
  nice: "Nice", nantes: "Nantes", bordeaux: "Bordeaux", lille: "Lille",
  rennes: "Rennes", strasbourg: "Strasbourg", montpellier: "Montpellier",
  grenoble: "Grenoble", dijon: "Dijon", angers: "Angers", reims: "Reims",
  toulon: "Toulon", brest: "Brest", metz: "Metz", perpignan: "Perpignan",
  caen: "Caen", nancy: "Nancy", rouen: "Rouen", amiens: "Amiens",
  aix_en_provence: "Aix-en-Provence", clermont_ferrand: "Clermont-Ferrand",
  versailles: "Versailles", limoges: "Limoges", nimes: "Nîmes",
  pau: "Pau", tours: "Tours", saint_etienne: "Saint-Étienne",
  poitiers: "Poitiers", avignon: "Avignon", annecy: "Annecy",
  la_rochelle: "La Rochelle", boulogne_billancourt: "Boulogne-Billancourt",
  saint_denis: "Saint-Denis", argenteuil: "Argenteuil", montreuil: "Montreuil",
  roubaix: "Roubaix", tourcoing: "Tourcoing", nanterre: "Nanterre",
  mulhouse: "Mulhouse", orleans: "Orléans", valence: "Valence",
  lorient: "Lorient", fort_de_france: "Fort-de-France", cayenne: "Cayenne",
  saint_pierre: "Saint-Pierre", pointe_a_pitre: "Pointe-à-Pitre",
  beziers: "Béziers", colmar: "Colmar", troyes: "Troyes",
  besancon: "Besançon", bourges: "Bourges", saint_malo: "Saint-Malo",
  bayonne: "Bayonne", angouleme: "Angoulême", dunkerque: "Dunkerque",
  calais: "Calais", antibes: "Antibes", cannes: "Cannes",
  cergy: "Cergy", evry: "Évry", chartres: "Chartres",
  cherbourg: "Cherbourg", vannes: "Vannes", quimper: "Quimper",
  la_roche_sur_yon: "La Roche-sur-Yon", saint_nazaire: "Saint-Nazaire",
  montauban: "Montauban", albi: "Albi", tarbes: "Tarbes",
  ales: "Alès", arles: "Arles", hyeres: "Hyères",
  draguignan: "Draguignan", gap: "Gap", ajaccio: "Ajaccio",
  bastia: "Bastia", saint_quentin: "Saint-Quentin", laval: "Laval",
  le_havre: "Le Havre", le_mans: "Le Mans",
};

export interface CreateJobParams {
  nom: string;
  secteur: string;
  villes?: string[]; // Si vide = toutes les villes de France
  options?: {
    enrichirEmails?: boolean;
    delaiMs?: number;
  };
}

export interface JobStatus {
  id: number;
  nom: string;
  statut: string;
  progression: number;
  tachesTerminees: number;
  totalTaches: number;
  entreprisesTrouvees: number;
  erreurs: string[];
  startedAt?: string | null;
  villeEnCours?: string;
}

class JobEngine {
  private running = false;
  private currentJobId: number | null = null;
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private villeEnCours: string = "";

  async initialize() {
    // Reprendre les jobs interrompus au redemarrage
    const interrompus = sqlite.prepare(
      "SELECT id FROM jobs WHERE statut = 'en_cours' LIMIT 1"
    ).all() as { id: number }[];

    if (interrompus.length > 0) {
      console.log(`[JobEngine] Reprise du job ${interrompus[0].id}`);
      sqlite.prepare(
        "UPDATE jobs SET statut = 'en_attente', updated_at = datetime('now') WHERE statut = 'en_cours'"
      ).run();
      sqlite.prepare(
        "UPDATE job_tasks SET statut = 'pending' WHERE statut = 'running'"
      ).run();
    }
  }

  /**
   * Crée un job Google Maps continu.
   * Si `villes` est vide, génère une tâche par ville de France (82 villes).
   */
  async createJob(params: CreateJobParams): Promise<number> {
    // Déterminer les villes
    let villesFinales: string[];
    if (params.villes && params.villes.length > 0) {
      villesFinales = params.villes;
    } else {
      // Toutes les villes de France
      villesFinales = Object.keys(VILLES_BBOX).map(
        (k) => NOMS_VILLES[k] || k.replace(/_/g, " ")
      );
    }

    const [job] = await db.insert(
      (await import("../db/schema")).jobs
    ).values({
      nom: params.nom,
      secteur: params.secteur,
      villes: JSON.stringify(villesFinales),
      sources: JSON.stringify(["googlemaps"]),
      statut: "en_attente",
      options: JSON.stringify(params.options || {}),
    }).returning();

    // Generer une tache par ville
    const tasks: { jobId: number; type: string; params: string }[] = [];

    for (const ville of villesFinales) {
      tasks.push({
        jobId: job.id,
        type: "scrape_googlemaps",
        params: JSON.stringify({
          type: "scrape_googlemaps",
          query: params.secteur,
          ville,
        }),
      });
    }

    if (tasks.length > 0) {
      const insertStmt = sqlite.prepare(
        "INSERT INTO job_tasks (job_id, type, params) VALUES (?, ?, ?)"
      );
      for (const t of tasks) {
        insertStmt.run(t.jobId, t.type, t.params);
      }
      sqlite.prepare(
        "UPDATE jobs SET total_taches = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(tasks.length, job.id);
    }

    return job.id;
  }

  async startJob(jobId: number) {
    if (this.running && this.currentJobId === jobId) return;

    if (this.running) {
      await this.stopCurrentJob();
    }

    sqlite.prepare(
      "UPDATE jobs SET statut = 'en_cours', started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
    ).run(jobId);

    this.currentJobId = jobId;
    this.running = true;
    this.abortController = new AbortController();

    this.loopPromise = this.processLoop(jobId, this.abortController.signal).then(() => {
      this.running = false;
      this.currentJobId = null;
      this.villeEnCours = "";
    });
  }

  async pauseJob(jobId: number) {
    if (this.currentJobId !== jobId) return;
    sqlite.prepare(
      "UPDATE jobs SET statut = 'pause', updated_at = datetime('now') WHERE id = ?"
    ).run(jobId);
    this.abortController?.abort();
    this.running = false;
    this.currentJobId = null;
    this.villeEnCours = "";
  }

  async stopJob(jobId: number) {
    if (this.currentJobId === jobId) {
      await this.stopCurrentJob();
    }
    sqlite.prepare(
      "UPDATE jobs SET statut = 'arrete', finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(jobId);
  }

  private async stopCurrentJob() {
    this.abortController?.abort();
    this.running = false;
    if (this.loopPromise) {
      await this.loopPromise.catch(() => {});
    }
    this.currentJobId = null;
    this.villeEnCours = "";
  }

  private async processLoop(jobId: number, signal: AbortSignal) {
    const opts = this.getJobOptions(jobId);
    let consecutiveErrors = 0;

    while (!signal.aborted) {
      // Recuperer la prochaine tache pending
      const task = sqlite.prepare(
        "SELECT * FROM job_tasks WHERE job_id = ? AND statut = 'pending' ORDER BY id ASC LIMIT 1"
      ).get(jobId) as {
        id: number; type: string; params: string; tentatives: number;
      } | undefined;

      if (!task) {
        // Plus de taches : job termine
        this.updateProgression(jobId);
        const found = sqlite.prepare(
          "SELECT COUNT(*) as n FROM entreprises WHERE job_id = ?"
        ).get(jobId) as { n: number };

        sqlite.prepare(
          "UPDATE jobs SET statut = 'termine', progression = 100, entreprises_trouvees = ?, finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(found.n, jobId);
        console.log(`[JobEngine] Job ${jobId} terminé — ${found.n} entreprises trouvées`);
        break;
      }

      // Extraire la ville en cours pour l'affichage
      try {
        const p = JSON.parse(task.params);
        this.villeEnCours = p.ville || "";
      } catch { /* ignore */ }

      // Marquer comme en cours
      sqlite.prepare(
        "UPDATE job_tasks SET statut = 'running', tentatives = tentatives + 1 WHERE id = ?"
      ).run(task.id);

      try {
        const params: TaskParams = JSON.parse(task.params);
        console.log(`[JobEngine] Tâche ${task.id}: ${params.type} — ${params.ville || "?"}`);

        const result = await processTask(params, signal);

        if (signal.aborted) {
          sqlite.prepare("UPDATE job_tasks SET statut = 'pending' WHERE id = ?").run(task.id);
          break;
        }

        // Sauvegarder les entreprises trouvées
        let saved = 0;
        for (const e of result.entreprises) {
          try {
            const toInsert: NouvelleEntreprise = { ...e, jobId };
            await db.insert(entreprises).values(toInsert).onConflictDoNothing();
            saved++;

            // Enrichissement web si le commerce a un site web mais pas d'email
            if (opts.enrichirEmails && e.siteWeb && !e.email) {
              sqlite.prepare(
                "INSERT INTO job_tasks (job_id, type, params) VALUES (?, ?, ?)"
              ).run(
                jobId,
                "enrich_web",
                JSON.stringify({ type: "enrich_web", entreprise: { ...e, jobId } })
              );
              sqlite.prepare(
                "UPDATE jobs SET total_taches = total_taches + 1 WHERE id = ?"
              ).run(jobId);
            }
          } catch {
            // Doublon place_id — ignorer
          }
        }

        // Marquer tache comme terminee
        sqlite.prepare(
          "UPDATE job_tasks SET statut = 'done', processed_at = datetime('now'), resultat = ? WHERE id = ?"
        ).run(
          JSON.stringify({ saved, total: result.entreprises.length, error: result.error }),
          task.id
        );

        if (result.error) {
          this.addJobError(jobId, `${this.villeEnCours}: ${result.error}`);
        }

        consecutiveErrors = 0;

      } catch (err) {
        consecutiveErrors++;
        const errMsg = String(err);

        if (task.tentatives >= 3) {
          sqlite.prepare(
            "UPDATE job_tasks SET statut = 'failed', resultat = ? WHERE id = ?"
          ).run(JSON.stringify({ error: errMsg }), task.id);
        } else {
          sqlite.prepare(
            "UPDATE job_tasks SET statut = 'pending' WHERE id = ?"
          ).run(task.id);
        }

        this.addJobError(jobId, `${this.villeEnCours}: ${errMsg}`);

        if (consecutiveErrors > 15) {
          this.addJobError(jobId, "Trop d'erreurs consecutives — job mis en pause");
          sqlite.prepare(
            "UPDATE jobs SET statut = 'pause', updated_at = datetime('now') WHERE id = ?"
          ).run(jobId);
          break;
        }
      }

      // Mettre a jour la progression
      this.updateProgression(jobId);

      // Delai entre les taches (plus long pour Google Maps pour éviter les blocages)
      if (!signal.aborted) {
        const delai = opts.delaiMs || 3000;
        await new Promise((r) => setTimeout(r, delai));
      }
    }
  }

  private updateProgression(jobId: number) {
    const stats = sqlite.prepare(
      "SELECT COUNT(*) as total, SUM(CASE WHEN statut IN ('done','failed','skipped') THEN 1 ELSE 0 END) as done FROM job_tasks WHERE job_id = ?"
    ).get(jobId) as { total: number; done: number };

    const found = sqlite.prepare(
      "SELECT COUNT(*) as n FROM entreprises WHERE job_id = ?"
    ).get(jobId) as { n: number };

    const prog = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    // Toujours forcer statut='en_cours' tant que le job tourne (corrige le reset du initialize)
    sqlite.prepare(
      "UPDATE jobs SET statut = 'en_cours', progression = ?, taches_terminees = ?, entreprises_trouvees = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(prog, stats.done, found.n, jobId);
  }

  private addJobError(jobId: number, error: string) {
    const job = sqlite.prepare("SELECT erreurs FROM jobs WHERE id = ?").get(jobId) as { erreurs: string | null } | undefined;
    const erreurs: string[] = job?.erreurs ? JSON.parse(job.erreurs) : [];
    erreurs.push(`[${new Date().toLocaleTimeString("fr-FR")}] ${error}`);
    sqlite.prepare(
      "UPDATE jobs SET erreurs = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(erreurs.slice(-50)), jobId);
  }

  private getJobOptions(jobId: number): { enrichirEmails: boolean; delaiMs: number } {
    const job = sqlite.prepare("SELECT options FROM jobs WHERE id = ?").get(jobId) as { options: string | null } | undefined;
    try {
      return { enrichirEmails: false, delaiMs: 3000, ...JSON.parse(job?.options || "{}") };
    } catch {
      return { enrichirEmails: false, delaiMs: 3000 };
    }
  }

  getStatus(jobId: number): JobStatus | null {
    const job = sqlite.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as {
      id: number; nom: string; statut: string; progression: number;
      taches_terminees: number; total_taches: number; entreprises_trouvees: number;
      erreurs: string | null; started_at: string | null;
    } | undefined;

    if (!job) return null;

    return {
      id: job.id,
      nom: job.nom,
      statut: job.statut,
      progression: job.progression,
      tachesTerminees: job.taches_terminees,
      totalTaches: job.total_taches,
      entreprisesTrouvees: job.entreprises_trouvees,
      erreurs: job.erreurs ? JSON.parse(job.erreurs) : [],
      startedAt: job.started_at,
      villeEnCours: this.currentJobId === job.id ? this.villeEnCours : undefined,
    };
  }

  isRunning(jobId: number) {
    return this.running && this.currentJobId === jobId;
  }

  getVilleEnCours(): string {
    return this.villeEnCours;
  }
}

// Pattern global pour survivre au HMR de Next.js
const g = globalThis as typeof globalThis & { _jobEngine?: JobEngine };
if (!g._jobEngine) {
  g._jobEngine = new JobEngine();
  g._jobEngine.initialize().catch(console.error);
}

export const jobEngine = g._jobEngine;

// Export la liste des villes pour l'UI
export function getVillesDisponibles(): { key: string; nom: string }[] {
  return Object.keys(VILLES_BBOX).map((k) => ({
    key: k,
    nom: NOMS_VILLES[k] || k.replace(/_/g, " "),
  }));
}

export const TOTAL_VILLES_FRANCE = Object.keys(VILLES_BBOX).length;
