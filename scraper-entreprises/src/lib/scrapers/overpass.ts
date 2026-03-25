/**
 * Overpass API (OpenStreetMap) - 100% gratuit, sans cle API
 * Fournit : nom, telephone, email, site web, adresse, horaires
 * Couverture : France entiere via bbox des villes
 */

import { NouvelleEntreprise } from "../db/schema";

// ── Mapping secteur utilisateur -> tags OSM ────────────────────────────────
export const SECTEURS_OSM: Record<string, string[]> = {
  // Restauration
  restaurant: ["amenity=restaurant"],
  cafe: ["amenity=cafe"],
  bar: ["amenity=bar", "amenity=pub"],
  brasserie: ["amenity=restaurant", "amenity=bar"],
  bistro: ["amenity=restaurant"],
  fast_food: ["amenity=fast_food"],
  pizzeria: ["amenity=restaurant"],
  boulangerie: ["shop=bakery"],
  patisserie: ["shop=pastry", "shop=bakery"],
  glacier: ["shop=ice_cream"],
  traiteur: ["shop=deli"],
  epicerie: ["shop=convenience", "shop=greengrocer"],

  // Hébergement
  hotel: ["tourism=hotel"],
  auberge: ["tourism=hostel", "tourism=guest_house"],
  camping: ["tourism=camp_site"],
  gite: ["tourism=guest_house", "tourism=chalet"],
  airbnb: ["tourism=apartment"],

  // Commerce
  supermarche: ["shop=supermarket"],
  hypermarche: ["shop=supermarket"],
  pharmacie: ["amenity=pharmacy"],
  librairie: ["shop=books"],
  fleuriste: ["shop=florist"],
  bijouterie: ["shop=jewelry"],
  vetements: ["shop=clothes"],
  chaussures: ["shop=shoes"],
  electromenager: ["shop=electronics"],
  informatique: ["shop=computer"],
  telephone: ["shop=mobile_phone"],
  jouets: ["shop=toys"],
  sport: ["shop=sports"],
  bricolage: ["shop=doityourself"],
  jardinerie: ["shop=garden_centre"],
  auto: ["shop=car"],
  moto: ["shop=motorcycle"],
  velo: ["shop=bicycle"],
  optique: ["shop=optician"],
  lunettes: ["shop=optician"],
  tabac: ["shop=tobacco"],
  presse: ["shop=newsagent"],
  bureau: ["shop=stationery"],

  // Beaute & Bien-être
  coiffeur: ["shop=hairdresser"],
  salon_coiffure: ["shop=hairdresser"],
  esthetique: ["shop=beauty"],
  spa: ["leisure=spa"],
  massage: ["shop=massage"],
  manucure: ["shop=beauty"],
  barbier: ["shop=hairdresser"],

  // Sante
  medecin: ["amenity=doctors"],
  docteur: ["amenity=doctors"],
  dentiste: ["amenity=dentist"],
  veterinaire: ["amenity=veterinary"],
  hopital: ["amenity=hospital"],
  clinique: ["amenity=clinic"],
  kinesitherapeute: ["amenity=physiotherapist"],
  osteopathe: ["amenity=alternative"],
  ophtalmo: ["amenity=doctors"],
  dermatologue: ["amenity=doctors"],
  psy: ["amenity=doctors"],
  infirmier: ["amenity=doctors"],
  laboratoire: ["amenity=laboratory"],

  // Services
  banque: ["amenity=bank"],
  assurance: ["office=insurance"],
  avocat: ["office=lawyer"],
  notaire: ["office=notary"],
  comptable: ["office=accountant"],
  architecte: ["office=architect"],
  agence_immobiliere: ["shop=estate_agent"],
  immobilier: ["shop=estate_agent"],
  agence_voyage: ["shop=travel_agency"],
  voyage: ["shop=travel_agency"],
  agence_interim: ["office=employment_agency"],
  interim: ["office=employment_agency"],
  securite: ["office=security"],
  detective: ["office=detective"],
  traducteur: ["office=translator"],

  // Artisanat
  plombier: ["craft=plumber"],
  electricien: ["craft=electrician"],
  menuisier: ["craft=carpenter"],
  maçon: ["craft=mason"],
  maconnerie: ["craft=mason"],
  peintre: ["craft=painter"],
  carreleur: ["craft=tiler"],
  serrurier: ["craft=locksmith"],
  chauffagiste: ["craft=hvac"],
  couvreur: ["craft=roofer"],
  jardinier: ["craft=gardener"],
  nettoyage: ["office=cleaning"],
  demenagement: ["office=moving"],

  // Transport
  taxi: ["amenity=taxi"],
  autoecole: ["amenity=driving_school"],
  garage: ["shop=car_repair"],
  carrosserie: ["shop=car_repair"],
  parking: ["amenity=parking"],
  location_voiture: ["shop=car_rental"],

  // Loisirs & Culture
  salle_sport: ["leisure=fitness_centre"],
  gym: ["leisure=fitness_centre"],
  fitness: ["leisure=fitness_centre"],
  piscine: ["leisure=swimming_pool"],
  tennis: ["leisure=tennis"],
  cinema: ["amenity=cinema"],
  theatre: ["amenity=theatre"],
  musee: ["tourism=museum"],
  galerie: ["tourism=gallery"],
  bibliotheque: ["amenity=library"],
  salle_fete: ["amenity=community_centre"],
  bowling: ["leisure=bowling_alley"],
  karting: ["leisure=sports_centre"],
  escalade: ["leisure=sports_centre"],

  // Education
  ecole: ["amenity=school"],
  lycee: ["amenity=school"],
  college: ["amenity=school"],
  universite: ["amenity=university"],
  creche: ["amenity=childcare"],
  garderie: ["amenity=childcare"],
  formation: ["amenity=college"],
  soutien_scolaire: ["office=educational_institution"],

  // Alimentation specialisee
  boucherie: ["shop=butcher"],
  poissonnerie: ["shop=seafood"],
  fromagerie: ["shop=cheese"],
  cave_vin: ["shop=wine"],
  bio: ["shop=organic"],
  chocolatier: ["shop=chocolate"],
  confiserie: ["shop=confectionery"],
};

interface OverpassNode {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

// ── Bounding boxes de 80+ villes françaises ───────────────────────────────
export const VILLES_BBOX: Record<string, [number, number, number, number]> = {
  // Grandes métropoles
  paris: [48.815, 2.224, 48.902, 2.469],
  lyon: [45.707, 4.772, 45.808, 4.899],
  marseille: [43.214, 5.317, 43.381, 5.483],
  toulouse: [43.537, 1.340, 43.668, 1.511],
  nice: [43.630, 7.158, 43.745, 7.320],
  nantes: [47.168, -1.638, 47.291, -1.471],
  bordeaux: [44.790, -0.643, 44.898, -0.527],
  lille: [50.578, 2.997, 50.680, 3.135],
  rennes: [48.072, -1.738, 48.145, -1.618],
  strasbourg: [48.520, 7.710, 48.620, 7.810],
  montpellier: [43.565, 3.826, 43.650, 3.939],
  grenoble: [45.138, 5.686, 45.222, 5.768],
  dijon: [47.280, 5.012, 47.345, 5.082],
  angers: [47.438, -0.594, 47.504, -0.519],
  reims: [49.218, 3.994, 49.283, 4.068],
  toulon: [43.100, 5.887, 43.165, 5.966],
  brest: [48.371, -4.534, 48.439, -4.448],
  metz: [49.088, 6.144, 49.143, 6.218],
  perpignan: [42.669, 2.858, 42.724, 2.938],
  caen: [49.157, -0.404, 49.209, -0.330],
  nancy: [48.672, 6.163, 48.714, 6.220],
  rouen: [49.404, 1.068, 49.462, 1.129],
  amiens: [49.876, 2.278, 49.916, 2.322],

  // Villes moyennes
  aix_en_provence: [43.497, 5.401, 43.558, 5.481],
  clermont_ferrand: [45.753, 3.073, 45.806, 3.147],
  versailles: [48.790, 2.099, 48.822, 2.149],
  limoges: [45.826, 1.233, 45.866, 1.298],
  nimes: [43.812, 4.320, 43.855, 4.379],
  pau: [43.278, -0.386, 43.325, -0.324],
  tours: [47.363, 0.666, 47.407, 0.726],
  saint_etienne: [45.408, 4.373, 45.460, 4.439],
  poitiers: [46.560, 0.326, 46.601, 0.386],
  avignon: [43.929, 4.796, 43.960, 4.839],
  annecy: [45.889, 6.110, 45.924, 6.152],
  la_rochelle: [46.145, -1.180, 46.180, -1.133],
  boulogne_billancourt: [48.822, 2.226, 48.849, 2.261],
  saint_denis: [48.920, 2.340, 48.950, 2.380],
  argenteuil: [48.930, 2.237, 48.965, 2.278],
  montreuil: [48.855, 2.430, 48.879, 2.466],
  roubaix: [50.665, 3.153, 50.698, 3.198],
  tourcoing: [50.716, 3.147, 50.745, 3.188],
  nanterre: [48.883, 2.192, 48.910, 2.225],
  mulhouse: [47.728, 7.317, 47.770, 7.380],
  orleans: [47.879, 1.877, 47.921, 1.940],
  valence: [44.920, 4.880, 44.960, 4.940],
  lorient: [47.736, -3.393, 47.771, -3.344],
  fort_de_france: [14.589, -61.088, 14.631, -61.045],
  cayenne: [4.908, -52.353, 4.948, -52.312],
  saint_pierre: [20.878, 55.446, 20.906, 55.476],
  pointe_a_pitre: [16.220, -61.554, 16.250, -61.520],
  béziers: [43.328, 3.188, 43.370, 3.247],
  colmar: [48.061, 7.338, 48.093, 7.383],
  troyes: [48.285, 4.058, 48.322, 4.102],
  besancon: [47.228, 5.974, 47.265, 6.041],
  bourges: [47.065, 2.375, 47.103, 2.433],
  saint_malo: [48.629, -2.047, 48.662, -1.984],
  bayonne: [43.470, -1.500, 43.509, -1.458],
  angouleme: [45.632, 0.137, 45.663, 0.175],
  dunkerque: [51.010, 2.329, 51.046, 2.385],
  calais: [50.940, 1.819, 50.975, 1.887],
  antibes: [43.572, 7.069, 43.620, 7.130],
  cannes: [43.539, 6.982, 43.584, 7.047],
  cergy: [49.026, 2.046, 49.059, 2.099],
  evry: [48.621, 2.420, 48.648, 2.451],
  chartres: [48.433, 1.467, 48.464, 1.514],
  cherbourg: [49.623, -1.648, 49.655, -1.607],
  vannes: [47.646, -2.773, 47.680, -2.736],
  quimper: [47.981, -4.126, 48.015, -4.082],
  la_roche_sur_yon: [46.662, -1.453, 46.688, -1.416],
  saint_nazaire: [47.268, -2.238, 47.302, -2.188],
  montauban: [44.006, 1.330, 44.041, 1.382],
  albi: [43.916, 2.124, 43.949, 2.175],
  tarbes: [43.219, 0.068, 43.249, 0.108],
  alès: [44.113, 4.069, 44.145, 4.100],
  arles: [43.663, 4.604, 43.695, 4.643],
  hyeres: [43.090, 6.109, 43.127, 6.160],
  draguignan: [43.526, 6.452, 43.560, 6.502],
  gap: [44.550, 6.065, 44.582, 6.108],
  ajaccio: [41.906, 8.714, 41.942, 8.775],
  bastia: [42.682, 9.430, 42.718, 9.476],
  saint_quentin: [49.838, 3.267, 49.870, 3.318],
  laval: [48.059, -0.784, 48.092, -0.740],
  le_havre: [49.478, 0.090, 49.524, 0.158],
  le_mans: [47.988, 0.178, 48.032, 0.230],
  amiéns: [49.876, 2.278, 49.916, 2.322],
};

// ── Normalisation de ville ─────────────────────────────────────────────────
function normaliserVille(ville: string): string {
  return ville
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\s\-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

export function getBbox(ville: string): [number, number, number, number] | null {
  const key = normaliserVille(ville);
  if (VILLES_BBOX[key]) return VILLES_BBOX[key];
  // Recherche partielle (ex: "aix" trouve "aix_en_provence")
  const found = Object.keys(VILLES_BBOX).find(
    (k) => k.startsWith(key) || key.startsWith(k) || k.includes(key)
  );
  return found ? VILLES_BBOX[found] : null;
}

/**
 * Trouve le(s) tag(s) OSM pour un secteur libre (fuzzy match)
 * Ex: "coiffeur" -> ["shop=hairdresser"]
 *     "coiffure" -> ["shop=hairdresser"]
 *     "restaurant italien" -> ["amenity=restaurant"]
 */
export function trouverTagsOSM(query: string): string[] {
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  // Match exact
  if (SECTEURS_OSM[q]) return SECTEURS_OSM[q];
  if (SECTEURS_OSM[q.replace(/\s+/g, "_")]) return SECTEURS_OSM[q.replace(/\s+/g, "_")];

  // Match partiel - chercher les clés qui contiennent le mot
  const mots = q.split(/\s+/);
  for (const mot of mots) {
    if (mot.length < 3) continue;
    const found = Object.keys(SECTEURS_OSM).find(
      (k) => k.includes(mot) || mot.includes(k)
    );
    if (found) return SECTEURS_OSM[found];
  }

  // Fallback générique sur le premier mot
  const premier = mots[0];
  if (premier) return [`amenity=${premier}`, `shop=${premier}`, `office=${premier}`];

  return [];
}

// ── Construction de la requête Overpass ───────────────────────────────────
function buildOverpassQuery(tags: string[], bbox: [number, number, number, number], limit = 50): string {
  const [s, w, n, e] = bbox;
  const bboxStr = `${s},${w},${n},${e}`;
  // Un seul tag pour eviter les timeouts (le plus specifique)
  const [key, value] = tags[0].split("=");
  const filters = `
  node["${key}"="${value}"]["name"](${bboxStr});
  way["${key}"="${value}"]["name"](${bboxStr});`;

  return `[out:json][timeout:15][maxsize:134217728];(${filters});out center ${limit};`;
}

// ── Conversion noeud OSM -> NouvelleEntreprise ────────────────────────────
function osmTagsToEntreprise(node: OverpassNode, secteur: string): NouvelleEntreprise | null {
  const t = node.tags;
  const nom = t.name || t["name:fr"];
  if (!nom || nom.length < 2) return null;

  const lat = node.lat ?? node.center?.lat;
  const lon = node.lon ?? node.center?.lon;

  // Telephone
  let telephone = t.phone || t["contact:phone"] || t["phone:FR"] || t.tel || t["contact:mobile"];
  if (telephone) {
    // Normaliser le format français
    telephone = telephone.replace(/\s/g, "").replace(/^(\+33|0033)/, "0");
    if (telephone.length < 10) telephone = undefined as unknown as string;
  }

  // Email
  const email = t.email || t["contact:email"];

  // Site web
  const siteWeb = t.website || t["contact:website"] || t["url"];

  // Adresse
  const num = t["addr:housenumber"] || "";
  const rue = t["addr:street"] || "";
  const adresse = [num, rue].filter(Boolean).join(" ") || undefined;
  const codePostal = t["addr:postcode"] || undefined;
  const ville = t["addr:city"] || t["addr:town"] || t["addr:village"] || undefined;

  // Horaires
  const horaires = t.opening_hours || undefined;

  // Categorie
  const categorie = t.amenity || t.shop || t.tourism || t.craft || t.office || t.leisure || secteur;

  return {
    nom,
    telephone: telephone || undefined,
    email: email || undefined,
    siteWeb: siteWeb || undefined,
    adresse,
    codePostal,
    ville,
    latitude: lat,
    longitude: lon,
    categorie,
    secteurActivite: secteur,
    horaires,
    source: "OpenStreetMap",
    statut: "actif",
  };
}

// Endpoints Overpass par ordre de fiabilite
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// ── Cache mémoire session (survit au HMR grâce à globalThis) ──────────────
interface OsmCacheEntry {
  results: NouvelleEntreprise[];
  ts: number;
}
const OSM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
declare const globalThis: { _osmCache?: Map<string, OsmCacheEntry> };
function getOsmCache(): Map<string, OsmCacheEntry> {
  if (!globalThis._osmCache) globalThis._osmCache = new Map();
  return globalThis._osmCache;
}
function osmCacheGet(key: string): NouvelleEntreprise[] | null {
  const cache = getOsmCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > OSM_CACHE_TTL) { cache.delete(key); return null; }
  return entry.results;
}
function osmCacheSet(key: string, results: NouvelleEntreprise[]) {
  getOsmCache().set(key, { results, ts: Date.now() });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Scrape les entreprises via Overpass API (OpenStreetMap)
 * @param secteur - Type d'activite (restaurant, plombier, etc.)
 * @param ville - Ville française (Paris, Lyon, etc.)
 * @param signal - AbortSignal optionnel
 */
export async function scrapeOverpass(
  secteur: string,
  ville: string,
  signal?: AbortSignal
): Promise<{ results: NouvelleEntreprise[]; hasMore: false }> {
  const tags = trouverTagsOSM(secteur);
  if (tags.length === 0) {
    console.warn(`OpenStreetMap: aucun tag OSM pour "${secteur}"`);
    return { results: [], hasMore: false };
  }

  const bbox = getBbox(ville);
  if (!bbox) {
    console.warn(`OpenStreetMap: ville inconnue "${ville}" — ajoutez-la à VILLES_BBOX`);
    return { results: [], hasMore: false };
  }

  const query = buildOverpassQuery(tags, bbox);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ScraperPro/1.0 (scraper-entreprises internal)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: signal ?? AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        if (res.status === 504 || res.status === 503 || res.status === 429) continue;
        return { results: [], hasMore: false };
      }

      const data = await res.json();
      const elements: OverpassNode[] = data.elements || [];
      console.log(`OpenStreetMap: ${elements.length} résultats pour "${secteur}" à ${ville}`);

      const results: NouvelleEntreprise[] = [];
      for (const el of elements) {
        const e = osmTagsToEntreprise(el, secteur);
        if (e) results.push(e);
      }

      return { results, hasMore: false };
    } catch (err) {
      const msg = String(err);
      if (msg.includes("abort") || msg.includes("timeout") || msg.includes("fetch")) continue;
      console.warn(`Overpass erreur: ${msg}`);
      return { results: [], hasMore: false };
    }
  }

  console.warn(`OpenStreetMap: aucun serveur disponible pour "${secteur}" à ${ville}`);
  return { results: [], hasMore: false };
}

/**
 * Recherche OSM multi-tags : lance plusieurs requêtes pour couvrir plus de résultats
 * Ex: "restaurant" -> amenity=restaurant + amenity=cafe
 */
export async function scrapeOverpassMulti(
  secteur: string,
  ville: string,
  signal?: AbortSignal
): Promise<{ results: NouvelleEntreprise[]; hasMore: false }> {
  // ── Cache ─────────────────────────────────────────────────────────────────
  const cacheKey = `osm_${secteur}_${ville}`.toLowerCase().replace(/\s+/g, "_");
  const cached = osmCacheGet(cacheKey);
  if (cached) {
    console.log(`OpenStreetMap cache: ${cached.length} résultats pour "${secteur}" à ${ville}`);
    return { results: cached, hasMore: false };
  }

  const key = secteur.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
  const allTags = SECTEURS_OSM[key] || SECTEURS_OSM[key.split("_")[0]] || [];

  if (allTags.length <= 1) {
    const r = await scrapeOverpass(secteur, ville, signal);
    if (r.results.length > 0) osmCacheSet(cacheKey, r.results);
    return r;
  }

  // Lancer jusqu'à 3 tags en parallèle
  const tagsToRun = allTags.slice(0, 3);
  const bbox = getBbox(ville);
  if (!bbox) return { results: [], hasMore: false };

  const seen = new Set<string>();
  const allResults: NouvelleEntreprise[] = [];

  await Promise.allSettled(
    tagsToRun.map(async (tag) => {
      const tagKey = tag.split("=")[0];
      const tagVal = tag.split("=")[1];
      const [s, w, n, e] = bbox;
      const bboxStr = `${s},${w},${n},${e}`;
      const q = `[out:json][timeout:12][maxsize:67108864];(node["${tagKey}"="${tagVal}"]["name"](${bboxStr});way["${tagKey}"="${tagVal}"]["name"](${bboxStr}););out center 30;`;

      for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
        const endpoint = OVERPASS_ENDPOINTS[i];
        // Backoff exponentiel : 0s, 2s, 4s...
        if (i > 0) await sleep(i * 2000);
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ScraperPro/1.0" },
            body: `data=${encodeURIComponent(q)}`,
            signal: signal ?? AbortSignal.timeout(15000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          for (const el of (data.elements || []) as OverpassNode[]) {
            const ent = osmTagsToEntreprise(el, secteur);
            if (ent && !seen.has(ent.nom)) {
              seen.add(ent.nom);
              allResults.push(ent);
            }
          }
          break;
        } catch {
          continue;
        }
      }
    })
  );

  if (allResults.length > 0) osmCacheSet(cacheKey, allResults);
  console.log(`OpenStreetMap multi: ${allResults.length} résultats pour "${secteur}" à ${ville}`);
  return { results: allResults, hasMore: false };
}

// Requete Overpass generique pour une ville avec un texte libre
export async function scrapeOverpassQuery(
  query: string,
  ville: string,
  signal?: AbortSignal
): Promise<NouvelleEntreprise[]> {
  const r = await scrapeOverpassMulti(query, ville, signal);
  return r.results;
}
