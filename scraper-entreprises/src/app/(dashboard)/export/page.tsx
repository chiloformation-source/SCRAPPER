"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileJson,
  Filter,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ExportPage() {
  const [search, setSearch] = useState("");
  const [ville, setVille] = useState("");
  const [campagneId, setCampagneId] = useState("");

  const buildParams = () => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (ville) p.set("ville", ville);
    if (campagneId) p.set("campagneId", campagneId);
    return p.toString();
  };

  const formats = [
    {
      id: "csv",
      label: "CSV (Excel)",
      description: "Compatible Microsoft Excel, Google Sheets, LibreOffice. Encodage UTF-8 avec BOM.",
      icon: FileSpreadsheet,
      color: "text-green-600",
      bg: "bg-green-50",
      extension: ".csv",
    },
    {
      id: "json",
      label: "JSON",
      description: "Format structuré pour intégration dans des applications ou bases de données.",
      icon: FileJson,
      color: "text-blue-600",
      bg: "bg-blue-50",
      extension: ".json",
    },
  ];

  const champsCsv = [
    "Nom", "SIREN", "SIRET", "Forme Juridique", "Secteur d'activité",
    "Code NAF", "Adresse", "Code Postal", "Ville", "Département",
    "Région", "Téléphone", "Email", "Site Web", "LinkedIn",
    "Effectifs", "Chiffre d'affaires", "Date de création", "Dirigeant", "Source",
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export des données</h1>
        <p className="text-muted-foreground mt-1">
          Exportez vos entreprises en CSV ou JSON pour les utiliser dans vos outils
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4" />
            Filtres d'export
          </CardTitle>
          <CardDescription>
            Laissez vide pour exporter toutes les entreprises
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Mot-clé</Label>
              <Input
                id="search"
                placeholder="Nom, secteur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ville">Ville</Label>
              <Input
                id="ville"
                placeholder="Paris, Lyon..."
                value={ville}
                onChange={(e) => setVille(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campagneId">ID Campagne</Label>
              <Input
                id="campagneId"
                placeholder="Ex: 1, 2, 3..."
                value={campagneId}
                onChange={(e) => setCampagneId(e.target.value)}
                type="number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {formats.map((fmt) => (
          <Card key={fmt.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${fmt.bg}`}>
                  <fmt.icon className={`size-5 ${fmt.color}`} />
                </div>
                {fmt.label}
              </CardTitle>
              <CardDescription>{fmt.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline" className="font-mono">
                entreprises{fmt.extension}
              </Badge>
              <Button asChild className="w-full" variant="outline">
                <a
                  href={`/api/export?format=${fmt.id}&${buildParams()}`}
                  download={`entreprises${fmt.extension}`}
                >
                  <Download className="size-4 mr-2" />
                  Télécharger {fmt.label}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            Champs exportés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {champsCsv.map((champ) => (
              <div key={champ} className="flex items-center gap-1.5 text-sm">
                <div className="size-1.5 rounded-full bg-primary" />
                {champ}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
