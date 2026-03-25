"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Key,
  Database,
  Info,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function ParametresPage() {
  const [pappersKey, setPappersKey] = useState("");
  const [inseeToken, setInseeToken] = useState("");

  useEffect(() => {
    // Charger depuis localStorage
    setPappersKey(localStorage.getItem("PAPPERS_API_KEY") || "");
    setInseeToken(localStorage.getItem("INSEE_TOKEN") || "");
  }, []);

  const sauvegarder = () => {
    if (pappersKey) localStorage.setItem("PAPPERS_API_KEY", pappersKey);
    if (inseeToken) localStorage.setItem("INSEE_TOKEN", inseeToken);
    toast.success("Paramètres sauvegardés");
  };

  const sources = [
    {
      nom: "API Gouvernement (recherche-entreprises.api.gouv.fr)",
      statut: "Disponible",
      auth: "Aucune",
      limite: "Illimitée",
      color: "text-green-600",
    },
    {
      nom: "Societe.com",
      statut: "Disponible",
      auth: "Aucune (scraping HTML)",
      limite: "Variable",
      color: "text-green-600",
    },
    {
      nom: "Pages Jaunes",
      statut: "Disponible",
      auth: "Aucune (scraping HTML)",
      limite: "Variable",
      color: "text-green-600",
    },
    {
      nom: "Pappers.fr",
      statut: "Clé API requise",
      auth: "API Key gratuite",
      limite: "1000 req/mois",
      color: "text-yellow-600",
    },
    {
      nom: "INSEE SIRENE",
      statut: "Token requis",
      auth: "Token Bearer gratuit",
      limite: "Illimitée",
      color: "text-yellow-600",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Configurez vos clés API pour accéder à plus de sources
        </p>
      </div>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Toutes les sources fonctionnent <strong>sans clé API</strong>. Les clés
          optionnelles permettent d'accéder à plus de données et lever les
          limites.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4" />
            Sources disponibles
          </CardTitle>
          <CardDescription>État des sources de données gratuites</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.map((s) => (
            <div
              key={s.nom}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{s.nom}</p>
                <p className="text-xs text-muted-foreground">
                  Auth: {s.auth} • Limite: {s.limite}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`${s.color} bg-transparent border-0`}
              >
                <CheckCircle2 className="size-3 mr-1" />
                {s.statut}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-4" />
            Clés API optionnelles
          </CardTitle>
          <CardDescription>
            Ces clés sont gratuites et permettent plus de résultats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pappers">
              Clé API Pappers.fr{" "}
              <Badge variant="secondary" className="ml-1 text-xs">
                Gratuit - 1000 req/mois
              </Badge>
            </Label>
            <Input
              id="pappers"
              type="password"
              placeholder="Obtenir sur pappers.fr/api"
              value={pappersKey}
              onChange={(e) => setPappersKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Inscription gratuite sur{" "}
              <span className="font-mono">pappers.fr/api</span> → Données
              enrichies sur les entreprises françaises
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="insee">
              Token INSEE SIRENE{" "}
              <Badge variant="secondary" className="ml-1 text-xs">
                Gratuit - illimité
              </Badge>
            </Label>
            <Input
              id="insee"
              type="password"
              placeholder="Obtenir sur api.insee.fr"
              value={inseeToken}
              onChange={(e) => setInseeToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Inscription gratuite sur{" "}
              <span className="font-mono">api.insee.fr</span> → Base SIRENE
              officielle complète
            </p>
          </div>

          <Button onClick={sauvegarder} className="w-full md:w-auto">
            <Settings className="size-4 mr-2" />
            Sauvegarder
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Base de données locale
          </CardTitle>
          <CardDescription>SQLite - Stockage local sécurisé</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emplacement</span>
              <span className="font-mono text-xs">./data/scraper.db</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Format</span>
              <span>SQLite (WAL mode)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ORM</span>
              <span>Drizzle ORM</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
