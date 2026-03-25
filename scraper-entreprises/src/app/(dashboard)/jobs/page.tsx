"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Plus,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const SECTEURS = [
  "restaurant", "hotel", "agence_immobiliere", "medecin", "pharmacie",
  "dentiste", "coiffeur", "boulangerie", "garage", "plombier",
  "electricien", "supermarche", "optique", "veterinaire", "banque",
  "avocat", "comptable", "sport", "ecole", "cinema",
];

const SOURCES_DISPO = [
  { id: "overpass", label: "OpenStreetMap", desc: "Gratuit, sans limite, tres rapide" },
  { id: "pages_jaunes", label: "Pages Jaunes", desc: "Telephones pros - pagination auto" },
  { id: "kompass", label: "Kompass", desc: "Annuaire B2B" },
  { id: "europages", label: "Europages", desc: "B2B europeen" },
  { id: "api_gouv", label: "API Gouvernement", desc: "Donnees legales" },
];

const VILLES_COMMUNES = [
  "Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Bordeaux",
  "Lille", "Rennes", "Strasbourg", "Montpellier", "Grenoble",
];

interface JobTask {
  type: string;
  params: string;
  statut: string;
  resultat: string | null;
  processed_at: string | null;
}

interface Job {
  id: number;
  nom: string;
  secteur: string;
  villes: string[];
  sources: string[];
  statut: string;
  progression: number;
  total_taches: number;
  taches_terminees: number;
  entreprises_trouvees: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    en_attente: { label: "En attente", variant: "secondary" },
    en_cours: { label: "En cours", variant: "default" },
    pause: { label: "Pause", variant: "outline" },
    arrete: { label: "Arrete", variant: "destructive" },
    termine: { label: "Termine", variant: "secondary" },
    erreur: { label: "Erreur", variant: "destructive" },
  };
  const s = map[statut] || { label: statut, variant: "outline" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [jobTasks, setJobTasks] = useState<Record<number, JobTask[]>>({});

  // Formulaire creation
  const [secteur, setSecteur] = useState("restaurant");
  const [villesInput, setVillesInput] = useState("Paris");
  const [sourcesSelect, setSourcesSelect] = useState(["overpass", "pages_jaunes"]);
  const [enrichirEmails, setEnrichirEmails] = useState(false);
  const [enrichirTel, setEnrichirTel] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      toast.error("Erreur chargement jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    // Polling toutes les 3s si un job est actif
    const interval = setInterval(() => {
      if (jobs.some((j) => j.statut === "en_cours")) {
        loadJobs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadJobs, jobs]);

  const doAction = async (jobId: number, action: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadJobs();
      toast.success(`Job ${action === "start" ? "lance" : action === "pause" ? "mis en pause" : "arrete"}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = async (jobId: number) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      setJobTasks((prev) => ({ ...prev, [jobId]: data.recentTasks || [] }));
    } catch { /* silencieux */ }
  };

  const doDelete = async (jobId: number) => {
    if (!confirm("Supprimer ce job et toutes ses taches ?")) return;
    setActionLoading(jobId);
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      await loadJobs();
      toast.success("Job supprime");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSource = (id: string) => {
    setSourcesSelect((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secteur) return toast.error("Selectionnez un secteur");
    const villes = villesInput.split(",").map((v) => v.trim()).filter(Boolean);
    if (villes.length === 0) return toast.error("Saisissez au moins une ville");
    if (sourcesSelect.length === 0) return toast.error("Selectionnez au moins une source");

    setCreating(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secteur,
          villes,
          sources: sourcesSelect,
          enrichirEmails,
          enrichirTel,
          autoStart: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Job lance ! ID: ${data.jobId}`);
      setShowCreate(false);
      await loadJobs();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  };

  const activeJobs = jobs.filter((j) => j.statut === "en_cours").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs de scraping continu</h1>
          <p className="text-muted-foreground mt-1">
            Scraping sans limite — tourne en arriere-plan jusqu'a epuisement des resultats
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadJobs}>
            <RefreshCw className="size-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-2" />
            Nouveau job
          </Button>
        </div>
      </div>

      {activeJobs > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="size-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm text-blue-700 font-medium">
            {activeJobs} job{activeJobs > 1 ? "s" : ""} en cours d'execution
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Zap className="size-12 mb-3" />
            <p>Aucun job cree</p>
            <p className="text-xs mt-1">Cliquez sur "Nouveau job" pour commencer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className={job.statut === "en_cours" ? "border-blue-300 shadow-sm" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {job.statut === "en_cours" && (
                        <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                      )}
                      {job.nom}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {Array.isArray(job.villes) ? job.villes.join(", ") : job.villes}
                      {" • "}
                      {Array.isArray(job.sources) ? job.sources.join(", ") : job.sources}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatutBadge statut={job.statut} />
                    <span className="text-xs text-muted-foreground">#{job.id}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="text-xl font-bold text-green-600">
                      {job.entreprises_trouvees.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Entreprises</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="text-xl font-bold">
                      {job.taches_terminees}
                      <span className="text-sm text-muted-foreground">/{job.total_taches}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Taches</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="text-xl font-bold text-blue-600">{job.progression}%</div>
                    <div className="text-xs text-muted-foreground">Progression</div>
                  </div>
                </div>

                {job.total_taches > 0 && (
                  <Progress value={job.progression} className="h-2" />
                )}

                {/* ETA pour les jobs actifs */}
                {job.statut === "en_cours" && job.total_taches > 0 && (
                  (() => {
                    const restantes = job.total_taches - job.taches_terminees;
                    const etaSec = restantes * 30;
                    const etaMin = Math.ceil(etaSec / 60);
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded">
                        <Clock className="size-3" />
                        ETA : {etaMin > 60 ? `${Math.ceil(etaMin / 60)}h${etaMin % 60 > 0 ? ` ${etaMin % 60}min` : ""}` : `${etaMin} min`}
                        {" "}({restantes} tache{restantes > 1 ? "s" : ""} restante{restantes > 1 ? "s" : ""})
                      </div>
                    );
                  })()
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {(job.statut === "en_attente" || job.statut === "pause" || job.statut === "arrete") && (
                    <Button size="sm" onClick={() => doAction(job.id, "start")} disabled={actionLoading === job.id}>
                      <Play className="size-3.5 mr-1" />
                      {job.statut === "pause" ? "Reprendre" : "Lancer"}
                    </Button>
                  )}
                  {job.statut === "en_cours" && (
                    <Button size="sm" variant="outline" onClick={() => doAction(job.id, "pause")} disabled={actionLoading === job.id}>
                      <Pause className="size-3.5 mr-1" />Pause
                    </Button>
                  )}
                  {job.statut === "en_cours" && (
                    <Button size="sm" variant="outline" onClick={() => doAction(job.id, "stop")} disabled={actionLoading === job.id}>
                      <Square className="size-3.5 mr-1" />Arreter
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleExpand(job.id)}
                    className="ml-auto gap-1"
                  >
                    <ListTodo className="size-3.5" />
                    Taches
                    {expandedJobId === job.id ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doDelete(job.id)} disabled={actionLoading === job.id}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Tâches récentes expandable */}
                {expandedJobId === job.id && (
                  <div className="border-t pt-3 mt-1 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">10 dernieres taches</p>
                    {(jobTasks[job.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Aucune tache traitee</p>
                    ) : (
                      jobTasks[job.id].map((t, i) => {
                        const params = (() => { try { return JSON.parse(t.params); } catch { return {}; } })();
                        const resultat = (() => { try { return JSON.parse(t.resultat || "null"); } catch { return null; } })();
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/40">
                            <span className={`size-1.5 rounded-full flex-shrink-0 ${t.statut === "done" ? "bg-green-500" : t.statut === "error" ? "bg-red-400" : "bg-yellow-400"}`} />
                            <span className="font-mono text-muted-foreground w-24 flex-shrink-0">{t.type}</span>
                            <span className="flex-1 truncate">{params.secteur || params.query || params.nom || "-"} {params.ville || params.villes || ""}</span>
                            {resultat?.count !== undefined && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">{resultat.count}</Badge>
                            )}
                            <span className={`text-muted-foreground ${t.statut === "error" ? "text-destructive" : ""}`}>{t.statut}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog creation */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nouveau job de scraping</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Secteur */}
            <div className="space-y-2">
              <Label>Secteur d'activite</Label>
              <div className="flex flex-wrap gap-2">
                {SECTEURS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSecteur(s)}
                    className={`px-3 py-1 rounded-full text-sm border transition-all ${
                      secteur === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Villes */}
            <div className="space-y-2">
              <Label htmlFor="villes">Villes (separees par virgule)</Label>
              <Input
                id="villes"
                value={villesInput}
                onChange={(e) => setVillesInput(e.target.value)}
                placeholder="Paris, Lyon, Marseille..."
              />
              <div className="flex flex-wrap gap-1">
                {VILLES_COMMUNES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      const current = villesInput.split(",").map((x) => x.trim()).filter(Boolean);
                      if (!current.includes(v)) {
                        setVillesInput([...current, v].join(", "));
                      }
                    }}
                    className="px-2 py-0.5 text-xs rounded border hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <Label>Sources</Label>
              <div className="space-y-2">
                {SOURCES_DISPO.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => toggleSource(s.id)}
                    className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-all ${
                      sourcesSelect.includes(s.id)
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    <div className={`size-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                      sourcesSelect.includes(s.id) ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {sourcesSelect.includes(s.id) && <CheckCircle2 className="size-3 text-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options enrichissement */}
            <div className="space-y-2">
              <Label>Enrichissement</Label>
              <div className="flex gap-3">
                {[
                  { key: "tel", label: "Telephone auto", value: enrichirTel, set: setEnrichirTel },
                  { key: "email", label: "Email auto", value: enrichirEmails, set: setEnrichirEmails },
                ].map(({ key, label, value, set }) => (
                  <div
                    key={key}
                    onClick={() => set(!value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm ${
                      value ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <CheckCircle2 className={`size-4 ${value ? "text-primary" : "text-muted-foreground"}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={creating} className="flex-1">
                {creating ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
                Lancer le job
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
