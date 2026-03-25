"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Search,
  FolderKanban,
  Mail,
  Phone,
  TrendingUp,
  RefreshCw,
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

interface Stats {
  totalEntreprises: number;
  totalCampagnes: number;
  avecEmail: number;
  avecTel: number;
  tauxTelephone: number;
  tauxEmail: number;
  scoreMoyenQualite: number;
  topVilles: Array<{ ville: string; count: number }>;
  topSecteurs: Array<{ secteur: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const kpis = stats
    ? [
        {
          title: "Entreprises",
          value: stats.totalEntreprises.toLocaleString("fr-FR"),
          icon: Building2,
          description: "Total scrappées",
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        {
          title: "Campagnes",
          value: stats.totalCampagnes.toString(),
          icon: FolderKanban,
          description: "Recherches enregistrées",
          color: "text-purple-600",
          bg: "bg-purple-50",
        },
        {
          title: "Avec Email",
          value: stats.avecEmail.toLocaleString("fr-FR"),
          icon: Mail,
          description: `${stats.totalEntreprises > 0 ? Math.round((stats.avecEmail / stats.totalEntreprises) * 100) : 0}% du total`,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        {
          title: "Avec Téléphone",
          value: stats.avecTel.toLocaleString("fr-FR"),
          icon: Phone,
          description: `${stats.totalEntreprises > 0 ? Math.round((stats.avecTel / stats.totalEntreprises) * 100) : 0}% du total`,
          color: "text-orange-600",
          bg: "bg-orange-50",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de votre base d'entreprises
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadStats}>
            <RefreshCw className="size-4 mr-2" />
            Actualiser
          </Button>
          <Button asChild>
            <Link href="/recherche">
              <Search className="size-4 mr-2" />
              Nouvelle recherche
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2" />
                <div className="h-3 bg-muted rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.title} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`size-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpi.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Métriques qualité */}
          {stats && stats.totalEntreprises > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="size-3.5 text-green-500" />
                    Taux Telephone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.tauxTelephone}%</div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${stats.tauxTelephone}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.avecTel} / {stats.totalEntreprises} entreprises</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="size-3.5 text-blue-500" />
                    Taux Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.tauxEmail}%</div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.tauxEmail}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.avecEmail} / {stats.totalEntreprises} entreprises</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="size-3.5 text-purple-500" />
                    Qualite Moyenne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{stats.scoreMoyenQualite}/100</div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${stats.scoreMoyenQualite}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Score moyen de completude</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Villes</CardTitle>
                <CardDescription>Entreprises par localisation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.topVilles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune donnée
                  </p>
                ) : (
                  stats?.topVilles.map((v, i) => (
                    <div key={v.ville} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{v.ville}</span>
                          <Badge variant="secondary">{v.count}</Badge>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (v.count / (stats.topVilles[0]?.count || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Secteurs</CardTitle>
                <CardDescription>Activités les plus représentées</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.topSecteurs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune donnée
                  </p>
                ) : (
                  stats?.topSecteurs.map((s) => (
                    <div key={s.secteur} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]" title={s.secteur}>
                        {s.secteur}
                      </span>
                      <Badge variant="outline">{s.count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Sources de données
                </CardTitle>
                <CardDescription>Répartition par source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune donnée
                  </p>
                ) : (
                  stats?.sources.map((s) => (
                    <div key={s.source} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.source || "Inconnu"}</span>
                      <Badge variant="secondary" className="ml-2">
                        {s.count}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {stats?.totalEntreprises === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="size-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  Aucune entreprise dans la base
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Commencez par lancer une recherche pour scraper des entreprises
                  depuis les sources gratuites disponibles.
                </p>
                <Button asChild>
                  <Link href="/recherche">
                    <Search className="size-4 mr-2" />
                    Lancer une recherche
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}