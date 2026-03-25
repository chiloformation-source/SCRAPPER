"use client";

import { useEffect, useState } from "react";
import {
  FolderKanban,
  RefreshCw,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Campagne } from "@/lib/db/schema";

type StatutKey = "terminee" | "en_cours" | "en_attente" | "erreur";

const statutConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  terminee: {
    label: "Terminee",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  en_cours: {
    label: "En cours",
    color: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  en_attente: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  erreur: {
    label: "Erreur",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function CampagnesPage() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campagnes");
      const data = await res.json();
      setCampagnes(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campagnes</h1>
          <p className="text-muted-foreground mt-1">
            Historique de vos recherches de scraping
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="size-4 mr-2" />
            Actualiser
          </Button>
          <Button asChild>
            <Link href="/recherche">Nouvelle campagne</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campagnes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="size-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Aucune campagne</h3>
            <p className="text-muted-foreground mb-4">
              Creez votre premiere campagne en lancant une recherche
            </p>
            <Button asChild>
              <Link href="/recherche">Lancer une recherche</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campagnes.map((c) => {
            const key = (c.statut || "en_attente") as StatutKey;
            const statut = statutConfig[key] || statutConfig.en_attente;
            const StatutIcon = statut.icon;

            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {c.nom}
                    </CardTitle>
                    <Badge
                      className={`${statut.color} border-0 shrink-0 flex items-center gap-1`}
                    >
                      <StatutIcon className="size-3" />
                      {statut.label}
                    </Badge>
                  </div>
                  {c.description && (
                    <CardDescription className="text-xs">
                      {c.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.keywords && (
                      <Badge variant="outline" className="text-xs">
                        Recherche: {c.keywords}
                      </Badge>
                    )}
                    {c.ville && (
                      <Badge variant="outline" className="text-xs">
                        Ville: {c.ville}
                      </Badge>
                    )}
                    {c.codePostal && (
                      <Badge variant="outline" className="text-xs">
                        CP: {c.codePostal}
                      </Badge>
                    )}
                    {c.secteur && (
                      <Badge variant="outline" className="text-xs">
                        Secteur: {c.secteur}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="size-3.5" />
                      <span>
                        <strong>{c.nombreResultats || 0}</strong> entreprises
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDate(c.createdAt)}
                    </div>
                  </div>

                  {c.sources && (
                    <div className="text-xs text-muted-foreground">
                      Sources: {c.sources.split(",").join(", ")}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/entreprises?campagneId=${c.id}`}>
                        Voir les resultats
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" title="Relancer cette campagne">
                      <Link
                        href={`/recherche?${new URLSearchParams({
                          ...(c.keywords ? { query: c.keywords } : {}),
                          ...(c.ville ? { ville: c.ville } : {}),
                          ...(c.sources ? { sources: c.sources } : {}),
                        }).toString()}`}
                      >
                        <RotateCcw className="size-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/api/export?format=csv&campagneId=${c.id}`} download>
                        CSV
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
