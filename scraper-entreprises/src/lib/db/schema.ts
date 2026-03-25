import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  real,
} from "drizzle-orm/sqlite-core";

export const entreprises = sqliteTable("entreprises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nom: text("nom").notNull(),
  siren: text("siren"),
  siret: text("siret"),
  formeJuridique: text("forme_juridique"),
  secteurActivite: text("secteur_activite"),
  codeNaf: text("code_naf"),
  categorie: text("categorie"),
  adresse: text("adresse"),
  codePostal: text("code_postal"),
  ville: text("ville"),
  departement: text("departement"),
  region: text("region"),
  pays: text("pays").default("France"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  telephone: text("telephone"),
  email: text("email"),
  siteWeb: text("site_web"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  facebook: text("facebook"),
  effectifs: text("effectifs"),
  chiffreAffaires: real("chiffre_affaires"),
  dateCreation: text("date_creation"),
  dirigeant: text("dirigeant"),
  description: text("description"),
  // Donnees Google Business
  placeId: text("place_id"),
  note: real("note"),
  nombreAvis: integer("nombre_avis"),
  horaires: text("horaires"),
  source: text("source"),
  statut: text("statut").default("actif"),
  scoreQualite: integer("score_qualite").default(0),
  campagneId: integer("campagne_id"),
  jobId: integer("job_id"),
  enrichiAt: text("enrichi_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const campagnes = sqliteTable("campagnes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nom: text("nom").notNull(),
  description: text("description"),
  keywords: text("keywords"),
  secteur: text("secteur"),
  ville: text("ville"),
  codePostal: text("code_postal"),
  statut: text("statut").default("en_attente"),
  nombreResultats: integer("nombre_resultats").default(0),
  sources: text("sources"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nom: text("nom").notNull(),
  secteur: text("secteur"),
  villes: text("villes"),
  sources: text("sources"),
  statut: text("statut").default("en_attente"),
  progression: integer("progression").default(0),
  totalTaches: integer("total_taches").default(0),
  tachesTerminees: integer("taches_terminees").default(0),
  entreprisesTrouvees: integer("entreprises_trouvees").default(0),
  erreurs: text("erreurs"),
  options: text("options"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

export const jobTasks = sqliteTable("job_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  type: text("type").notNull(),
  params: text("params").notNull(),
  statut: text("statut").default("pending"),
  resultat: text("resultat"),
  tentatives: integer("tentatives").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  processedAt: text("processed_at"),
});

export type Entreprise = typeof entreprises.$inferSelect;
export type NouvelleEntreprise = typeof entreprises.$inferInsert;
export type Campagne = typeof campagnes.$inferSelect;
export type NouvelleCampagne = typeof campagnes.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NouveauJob = typeof jobs.$inferInsert;
export type JobTask = typeof jobTasks.$inferSelect;
