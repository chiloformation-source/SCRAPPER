import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "scraper.db");

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF"); // OFF pour permettre les migrations

export const db = drizzle(sqlite, { schema });

export function initDB() {
  // 1. Creer les tables de base (sans les nouvelles colonnes pour la compatibilite)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS campagnes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      keywords TEXT,
      secteur TEXT,
      ville TEXT,
      code_postal TEXT,
      statut TEXT DEFAULT 'en_attente',
      nombre_resultats INTEGER DEFAULT 0,
      sources TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entreprises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      siren TEXT,
      siret TEXT,
      forme_juridique TEXT,
      secteur_activite TEXT,
      code_naf TEXT,
      adresse TEXT,
      code_postal TEXT,
      ville TEXT,
      departement TEXT,
      region TEXT,
      pays TEXT DEFAULT 'France',
      telephone TEXT,
      email TEXT,
      site_web TEXT,
      linkedin TEXT,
      twitter TEXT,
      facebook TEXT,
      effectifs TEXT,
      chiffre_affaires REAL,
      date_creation TEXT,
      dirigeant TEXT,
      description TEXT,
      source TEXT,
      statut TEXT DEFAULT 'actif',
      campagne_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      secteur TEXT,
      villes TEXT,
      sources TEXT,
      statut TEXT DEFAULT 'en_attente',
      progression INTEGER DEFAULT 0,
      total_taches INTEGER DEFAULT 0,
      taches_terminees INTEGER DEFAULT 0,
      entreprises_trouvees INTEGER DEFAULT 0,
      erreurs TEXT,
      options TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS job_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      params TEXT NOT NULL,
      statut TEXT DEFAULT 'pending',
      resultat TEXT,
      tentatives INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_entreprises_nom ON entreprises(nom);
    CREATE INDEX IF NOT EXISTS idx_entreprises_ville ON entreprises(ville);
    CREATE INDEX IF NOT EXISTS idx_entreprises_siren ON entreprises(siren);
    CREATE INDEX IF NOT EXISTS idx_entreprises_campagne ON entreprises(campagne_id);
    CREATE INDEX IF NOT EXISTS idx_job_tasks_job_id ON job_tasks(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_tasks_statut ON job_tasks(statut);
  `);

  // 2. Migration des colonnes manquantes (compatible toutes versions SQLite)
  const colsEntreprises = new Set(
    (sqlite.pragma("table_info(entreprises)") as { name: string }[]).map((c) => c.name)
  );

  const migrationsEntreprises: [string, string][] = [
    ["categorie", "TEXT"],
    ["latitude", "REAL"],
    ["longitude", "REAL"],
    ["place_id", "TEXT"],
    ["note", "REAL"],
    ["nombre_avis", "INTEGER"],
    ["horaires", "TEXT"],
    ["job_id", "INTEGER"],
    ["enrichi_at", "TEXT"],
    ["score_qualite", "INTEGER DEFAULT 0"],
  ];

  for (const [col, type] of migrationsEntreprises) {
    if (!colsEntreprises.has(col)) {
      sqlite.exec(`ALTER TABLE entreprises ADD COLUMN ${col} ${type}`);
    }
  }

  // 3. Index apres migration
  try {
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_entreprises_job ON entreprises(job_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entreprises_place_id
        ON entreprises(place_id) WHERE place_id IS NOT NULL;
    `);
  } catch {
    // Ignorer si doublons existent deja
  }
}

initDB();

export { sqlite };
