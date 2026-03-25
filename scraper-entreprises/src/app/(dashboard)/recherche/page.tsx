"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  MapPin,
  Play,
  Pause,
  Square,
  Building2,
  Phone,
  Mail,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  nom: string;
  secteur: string;
  statut: string;
  progression: number;
  total_taches: number;
  taches_terminees: number;
  entreprises_trouvees: number;
  isRunning: boolean;
  villeEnCours?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  villes: string[];
}

interface JobTask {
  type: string;
  params: string;
  statut: string;
  resultat: string | null;
  processed_at: string | null;
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [enrichirEmails, setEnrichirEmails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Jobs
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalVilles, setTotalVilles] = useState(82);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [jobTasks, setJobTasks] = useState<JobTask[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // ── Charger les jobs existants ──────────────────────────────────────────────
  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
      if (data.totalVillesFrance) setTotalVilles(data.totalVillesFrance);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchJobs();
    // Poll toutes les 3s pour voir la progression
    pollRef.current = setInterval(fetchJobs, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  // ── Lancer une recherche continue ───────────────────────────────────────────
  const handleLancer = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secteur: query.trim(),
          enrichirEmails,
          delaiMs: 3000,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la creation du job");
        return;
      }

      setQuery("");
      fetchJobs();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Controle des jobs ───────────────────────────────────────────────────────
  const controlJob = async (jobId: number, action: "start" | "resume" | "pause" | "stop") => {
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchJobs();
    } catch { /* ignore */ }
  };

  const deleteJob = async (jobId: number) => {
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      fetchJobs();
    } catch { /* ignore */ }
  };

  // ── Voir les taches d'un job ────────────────────────────────────────────────
  const toggleExpand = async (jobId: number) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      setJobTasks(data.recentTasks || []);
    } catch { /* ignore */ }
  };

  // ── Helpers affichage ───────────────────────────────────────────────────────
  const statutColor = (s: string) => {
    switch (s) {
      case "en_cours": return "bg-blue-100 text-blue-800";
      case "termine": return "bg-green-100 text-green-800";
      case "pause": return "bg-yellow-100 text-yellow-800";
      case "arrete": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const statutLabel = (s: string) => {
    switch (s) {
      case "en_cours": return "En cours";
      case "termine": return "Termine";
      case "pause": return "En pause";
      case "arrete": return "Arrete";
      case "en_attente": return "En attente";
      default: return s;
    }
  };

  const hasRunningJobs = jobs.some((j) => j.isRunning);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Recherche Google Maps
        </h1>
        <p className="text-muted-foreground mt-1">
          Scraping continu — cherche dans les <strong>{totalVilles} plus grandes villes de France</strong>
        </p>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-red-500" />
            Nouvelle recherche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="query">Activite / Mot-cle</Label>
            <Input
              id="query"
              placeholder="restaurant, plombier, coiffeur, boulangerie..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLancer()}
              disabled={loading}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              La recherche va scanner Google Maps dans {totalVilles} villes de France automatiquement.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enrichirEmails}
              onChange={(e) => setEnrichirEmails(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            <span className="text-sm">
              Enrichir les emails (visite les sites web trouves — plus lent)
            </span>
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <Button
            onClick={handleLancer}
            disabled={loading || !query.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Search className="size-4 mr-2" />
            )}
            Lancer la recherche sur toute la France
          </Button>
        </CardContent>
      </Card>

      {/* Jobs en cours / historique */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recherches</h2>

          {jobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isActive = job.statut === "en_cours";
            const isPaused = job.statut === "pause";
            const isDone = job.statut === "termine";

            return (
              <Card key={job.id} className={isActive ? "border-blue-300 shadow-md" : ""}>
                <CardContent className="pt-6">
                  {/* Header du job */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="size-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold text-lg">{job.secteur}</span>
                        <Badge className={statutColor(job.statut)}>{statutLabel(job.statut)}</Badge>
                        {job.isRunning && job.villeEnCours && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            <MapPin className="size-3 mr-1" />
                            {job.villeEnCours}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {job.nom}
                      </p>
                    </div>

                    {/* Boutons controle */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(isPaused || job.statut === "en_attente" || job.statut === "arrete") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => controlJob(job.id, "resume")}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Play className="size-3.5 mr-1" /> Reprendre
                        </Button>
                      )}
                      {isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => controlJob(job.id, "pause")}
                          className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                        >
                          <Pause className="size-3.5 mr-1" /> Pause
                        </Button>
                      )}
                      {(isActive || isPaused) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => controlJob(job.id, "stop")}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <Square className="size-3.5 mr-1" /> Stop
                        </Button>
                      )}
                      {(isDone || job.statut === "arrete") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteJob(job.id)}
                          className="text-red-500"
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progression */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>
                        {job.taches_terminees} / {job.total_taches} villes
                      </span>
                      <span className="font-mono">{job.progression}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isActive ? "bg-blue-500" : isDone ? "bg-green-500" : isPaused ? "bg-yellow-400" : "bg-gray-400"
                        }`}
                        style={{ width: `${Math.max(1, job.progression)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <div className="text-2xl font-bold">{job.entreprises_trouvees}</div>
                      <div className="text-xs text-muted-foreground">Entreprises</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <div className="text-2xl font-bold">{job.taches_terminees}</div>
                      <div className="text-xs text-muted-foreground">Villes faites</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <div className="text-2xl font-bold">{job.total_taches - job.taches_terminees}</div>
                      <div className="text-xs text-muted-foreground">Restantes</div>
                    </div>
                  </div>

                  {/* Liens */}
                  <div className="mt-4 flex items-center gap-3">
                    {job.entreprises_trouvees > 0 && (
                      <Link href="/entreprises" className="text-sm text-blue-600 hover:underline">
                        Voir les {job.entreprises_trouvees} entreprises
                      </Link>
                    )}
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      Dernières tâches
                    </button>
                  </div>

                  {/* Taches (expandable) */}
                  {isExpanded && (
                    <div className="mt-3 border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-1.5">Ville</th>
                            <th className="text-left px-3 py-1.5">Statut</th>
                            <th className="text-left px-3 py-1.5">Resultat</th>
                            <th className="text-left px-3 py-1.5">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobTasks.map((t, i) => {
                            let ville = "?";
                            let result = "";
                            try {
                              const p = JSON.parse(t.params);
                              ville = p.ville || p.query || "?";
                            } catch { /* ignore */ }
                            try {
                              if (t.resultat) {
                                const r = JSON.parse(t.resultat);
                                result = r.saved !== undefined ? `${r.saved} trouvées` : r.error || "";
                              }
                            } catch { /* ignore */ }

                            return (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-1.5 font-medium">{ville}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                    t.statut === "done" ? "bg-green-500" :
                                    t.statut === "failed" ? "bg-red-500" :
                                    t.statut === "running" ? "bg-blue-500" :
                                    "bg-gray-400"
                                  }`} />
                                  {t.statut}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">{result}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {t.processed_at ? new Date(t.processed_at).toLocaleTimeString("fr-FR") : "-"}
                                </td>
                              </tr>
                            );
                          })}
                          {jobTasks.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">
                                Aucune tache traitee pour le moment
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Message si aucun job */}
      {jobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Aucune recherche en cours</p>
          <p className="text-sm mt-1">
            Entrez un secteur ci-dessus pour lancer une recherche Google Maps sur toute la France
          </p>
        </div>
      )}
    </div>
  );
}
