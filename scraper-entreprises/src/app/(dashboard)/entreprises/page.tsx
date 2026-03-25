"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Search,
  Download,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Entreprise } from "@/lib/db/schema";

const PAGE_SIZE = 50;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-muted-foreground" />}
    </button>
  );
}

function SortIcon({ col, sortBy, order }: { col: string; sortBy: string; order: string }) {
  if (sortBy !== col) return <ChevronUp className="size-3 text-muted-foreground/30" />;
  return order === "asc" ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />;
}

export default function EntreprisesPage() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ville, setVille] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Entreprise | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [villeInput, setVilleInput] = useState("");
  // Filtres avancés
  const [avecTel, setAvecTel] = useState("");
  const [avecEmail, setAvecEmail] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  // Bulk
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  const loadEntreprises = useCallback(async () => {
    setLoading(true);
    setCheckedIds(new Set());
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sortBy,
        order: sortOrder,
      });
      if (search) params.set("search", search);
      if (ville) params.set("ville", ville);
      if (avecTel) params.set("avecTel", avecTel);
      if (avecEmail) params.set("avecEmail", avecEmail);
      if (filterSource) params.set("source", filterSource);

      const res = await fetch(`/api/entreprises?${params}`);
      const data = await res.json();
      setEntreprises(data.data || []);
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [page, search, ville, avecTel, avecEmail, filterSource, sortBy, sortOrder]);

  useEffect(() => {
    loadEntreprises();
  }, [loadEntreprises]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setVille(villeInput);
    setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette entreprise ?")) return;
    try {
      await fetch(`/api/entreprises?id=${id}`, { method: "DELETE" });
      toast.success("Entreprise supprimee");
      loadEntreprises();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${checkedIds.size} entreprises ?`)) return;
    try {
      await fetch("/api/entreprises", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds) }),
      });
      toast.success(`${checkedIds.size} entreprises supprimees`);
      loadEntreprises();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleBulkExport = () => {
    const selected = entreprises.filter((e) => checkedIds.has(e.id));
    const rows = [
      ["Nom", "Telephone", "Email", "Adresse", "Ville", "Code Postal", "Site Web", "Source"],
      ...selected.map((e) => [
        e.nom, e.telephone || "", e.email || "",
        e.adresse || "", e.ville || "", e.codePostal || "",
        e.siteWeb || "", e.source || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "export_selection.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((o) => o === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const toggleCheck = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === entreprises.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(entreprises.map((e) => e.id)));
    }
  };

  const withTel = entreprises.filter((e) => e.telephone).length;
  const withEmail = entreprises.filter((e) => e.email).length;

  const exportUrl = new URLSearchParams();
  if (search) exportUrl.set("search", search);
  if (ville) exportUrl.set("ville", ville);
  if (avecTel) exportUrl.set("avecTel", avecTel);
  if (avecEmail) exportUrl.set("avecEmail", avecEmail);
  if (filterSource) exportUrl.set("source", filterSource);

  const activeFilters = [avecTel, avecEmail, filterSource].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entreprises</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-muted-foreground text-sm">{entreprises.length} affichees</span>
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <Phone className="size-3.5" />{withTel} tel.
            </span>
            <span className="flex items-center gap-1 text-sm text-blue-600 font-medium">
              <Mail className="size-3.5" />{withEmail} email
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadEntreprises}>
            <RefreshCw className="size-4 mr-2" />Actualiser
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export?format=csv&${exportUrl}`} download>
              <Download className="size-4 mr-2" />Export CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export?format=json&${exportUrl}`} download>
              <Download className="size-4 mr-2" />Export JSON
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          {/* Barre de recherche */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, SIREN..." className="pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Ville..." className="pl-9 w-36" value={villeInput} onChange={(e) => setVilleInput(e.target.value)} />
            </div>
            <Button type="submit" variant="outline">Filtrer</Button>
            {(search || ville) && (
              <Button type="button" variant="ghost" onClick={() => { setSearch(""); setVille(""); setSearchInput(""); setVilleInput(""); setPage(1); }}>
                Reset
              </Button>
            )}
          </form>

          {/* Filtres avancés */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="size-3" />Filtres :
              {activeFilters > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{activeFilters}</Badge>}
            </span>

            {/* Avec tél */}
            <button
              type="button"
              onClick={() => { setAvecTel(avecTel === "true" ? "" : "true"); setPage(1); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-all ${avecTel === "true" ? "border-green-500 bg-green-50 text-green-700 font-medium" : "border-muted text-muted-foreground hover:border-muted-foreground/50"}`}
            >
              <Phone className="size-3" />Avec tél.
            </button>

            {/* Avec email */}
            <button
              type="button"
              onClick={() => { setAvecEmail(avecEmail === "true" ? "" : "true"); setPage(1); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-all ${avecEmail === "true" ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-muted text-muted-foreground hover:border-muted-foreground/50"}`}
            >
              <Mail className="size-3" />Avec email
            </button>

            {/* Les deux */}
            <button
              type="button"
              onClick={() => { const both = avecTel === "true" && avecEmail === "true"; setAvecTel(both ? "" : "true"); setAvecEmail(both ? "" : "true"); setPage(1); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-all ${avecTel === "true" && avecEmail === "true" ? "border-purple-500 bg-purple-50 text-purple-700 font-medium" : "border-muted text-muted-foreground hover:border-muted-foreground/50"}`}
            >
              Les deux
            </button>

            {/* Source filter */}
            <select
              value={filterSource}
              onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
              className="px-2.5 py-1 rounded-full border border-muted text-xs bg-background text-muted-foreground hover:border-muted-foreground/50 transition-all"
            >
              <option value="">Toutes les sources</option>
              <option value="OpenStreetMap">OpenStreetMap</option>
              <option value="118000">Annuaire 118000</option>
              <option value="API Gouvernement">API Gouvernement</option>
              <option value="Pages Jaunes">Pages Jaunes</option>
              <option value="Kompass">Kompass</option>
            </select>

            {/* Reset filtres avancés */}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => { setAvecTel(""); setAvecEmail(""); setFilterSource(""); setPage(1); }}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-3" />Effacer
              </button>
            )}
          </div>

          {/* Barre bulk */}
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium text-primary">{checkedIds.size} selectionnee(s)</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleBulkExport}>
                <Download className="size-3" />Export CSV
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleBulkDelete}>
                <Trash2 className="size-3" />Supprimer
              </Button>
              <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setCheckedIds(new Set())}>
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : entreprises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Building2 className="size-12 mb-3" />
              <p>Aucune entreprise trouvee</p>
              <p className="text-xs mt-1">Lancez un scraping depuis la page Recherche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 px-3">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={checkedIds.size === entreprises.length && entreprises.length > 0}
                        onChange={toggleAll}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableHead>
                    <TableHead className="min-w-[180px] cursor-pointer select-none" onClick={() => toggleSort("nom")}>
                      <span className="flex items-center gap-1">Nom <SortIcon col="nom" sortBy={sortBy} order={sortOrder} /></span>
                    </TableHead>
                    <TableHead className="min-w-[140px] cursor-pointer select-none" onClick={() => toggleSort("telephone")}>
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5 text-green-500" />Telephone <SortIcon col="telephone" sortBy={sortBy} order={sortOrder} />
                      </span>
                    </TableHead>
                    <TableHead className="min-w-[180px] cursor-pointer select-none" onClick={() => toggleSort("email")}>
                      <span className="flex items-center gap-1">
                        <Mail className="size-3.5 text-blue-500" />Email <SortIcon col="email" sortBy={sortBy} order={sortOrder} />
                      </span>
                    </TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("source")}>
                      <span className="flex items-center gap-1">Source <SortIcon col="source" sortBy={sortBy} order={sortOrder} /></span>
                    </TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entreprises.map((e) => {
                    const checked = checkedIds.has(e.id);
                    // Badge qualité
                    const score = (e.telephone ? 1 : 0) + (e.email ? 1 : 0) + (e.adresse ? 1 : 0) + (e.siteWeb ? 1 : 0);
                    const dotColor = score >= 3 ? "bg-green-500" : score >= 1 ? "bg-yellow-500" : "bg-red-400";
                    return (
                      <TableRow
                        key={e.id}
                        className={`cursor-pointer hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                        onClick={() => setSelected(e)}
                      >
                        <TableCell className="px-3" onClick={(ev) => ev.stopPropagation()}>
                          <input type="checkbox" className="rounded" checked={checked} onChange={() => {}} onClick={(ev) => toggleCheck(e.id, ev as unknown as React.MouseEvent)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`size-2 rounded-full flex-shrink-0 ${dotColor}`} title={`Score qualite: ${score}/4`} />
                            <div className="font-medium max-w-[200px] truncate">{e.nom}</div>
                          </div>
                          {e.siren && <div className="text-xs text-muted-foreground font-mono">{e.siren}</div>}
                        </TableCell>
                        <TableCell>
                          {e.telephone ? (
                            <div className="group flex items-center">
                              <a href={`tel:${e.telephone}`} onClick={(ev) => ev.stopPropagation()} className="text-sm font-medium text-green-700 hover:underline">{e.telephone}</a>
                              <CopyButton value={e.telephone} />
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {e.email ? (
                            <div className="group flex items-center">
                              <a href={`mailto:${e.email}`} onClick={(ev) => ev.stopPropagation()} className="text-sm font-medium text-blue-700 hover:underline truncate max-w-[160px] block">{e.email}</a>
                              <CopyButton value={e.email} />
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {e.ville ? (
                            <div>
                              <div className="text-sm">{e.ville}</div>
                              {e.codePostal && <div className="text-xs text-muted-foreground">{e.codePostal}</div>}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{e.source || "N/A"}</Badge>
                        </TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {entreprises.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">Page {page}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />Precedent
                </Button>
                <Button variant="outline" size="sm" disabled={entreprises.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
                  Suivant<ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              {selected?.nom}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="grid gap-3 p-4 rounded-lg bg-muted/40 border">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Contacts</p>
                  {selected.telephone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-green-500 flex-shrink-0" />
                      <a href={`tel:${selected.telephone}`} className="text-base font-semibold text-green-700 hover:underline">{selected.telephone}</a>
                      <button onClick={() => { navigator.clipboard.writeText(selected.telephone!); toast.success("Telephone copie"); }} className="p-1 rounded hover:bg-muted">
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4 flex-shrink-0" /><span className="text-sm">Pas de telephone</span>
                    </div>
                  )}
                  {selected.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-blue-500 flex-shrink-0" />
                      <a href={`mailto:${selected.email}`} className="text-base font-semibold text-blue-700 hover:underline break-all">{selected.email}</a>
                      <button onClick={() => { navigator.clipboard.writeText(selected.email!); toast.success("Email copie"); }} className="p-1 rounded hover:bg-muted">
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-4 flex-shrink-0" /><span className="text-sm">Pas d&apos;email</span>
                    </div>
                  )}
                  {selected.siteWeb && (
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-purple-500 flex-shrink-0" />
                      <a href={selected.siteWeb} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 hover:underline truncate">{selected.siteWeb}</a>
                      <ExternalLink className="size-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: "SIREN", value: selected.siren },
                    { label: "SIRET", value: selected.siret },
                    { label: "Forme juridique", value: selected.formeJuridique },
                    { label: "Code NAF", value: selected.codeNaf },
                    { label: "Secteur", value: selected.secteurActivite },
                    { label: "Date creation", value: selected.dateCreation },
                    { label: "Dirigeant", value: selected.dirigeant },
                    { label: "Effectifs", value: selected.effectifs },
                    { label: "Chiffre d'affaires", value: selected.chiffreAffaires ? `${selected.chiffreAffaires.toLocaleString("fr-FR")} EUR` : undefined },
                    { label: "Adresse", value: [selected.adresse, selected.codePostal, selected.ville].filter(Boolean).join(", ") },
                    { label: "Source", value: selected.source },
                  ].map(({ label, value }) =>
                    value ? (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
