// Prépare la carte de France de l'app (départements, préfectures, encarts) à partir
// de données publiques, une fois pour toutes : l'app embarque le résultat et
// l'affiche hors ligne, sans bibliothèque de cartographie.
//
//   npm run geo
//
// Sources (Licence Ouverte Etalab 2.0, à citer dans « À propos ») :
// - tracés des départements : IGN Admin Express, via github.com/gregoiredavid/france-geojson ;
// - départements, régions, communes (préfectures) : geo.api.gouv.fr.
// Les fichiers sources sont téléchargés dans scripts/geo/source/ (non versionné).
//
// Projection : Lambert-93 (projection officielle des cartes de France) pour la
// métropole ; chaque département d'outre-mer a son encart, à sa propre échelle.
// Un encart agrandit Paris et la petite couronne, trop petits pour le doigt.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const sourceDir = join(here, "source");
// Deux fichiers : la liste des départements (petite, chargée avec l'app) et les
// tracés de la carte (chargés à la première carte affichée, puis mis en cache).
const dataDir = join(root, "src/categories/geography/data");
const listFile = join(dataDir, "departements.json");
const mapFile = join(dataDir, "carte-france.json");

const SOURCES = {
  "departements.geojson":
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-avec-outre-mer.geojson",
  "departements-meta.json": "https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion",
  "regions.json": "https://geo.api.gouv.fr/regions?fields=nom,code",
  "communes.json": "https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,centre,population&format=json",
};

/* ---------- Téléchargement des sources (une fois) ---------- */

mkdirSync(sourceDir, { recursive: true });
for (const [file, url] of Object.entries(SOURCES)) {
  const path = join(sourceDir, file);
  if (existsSync(path)) continue;
  console.log(`Téléchargement de ${file}…`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} : ${response.status}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}
const readJson = (file) => JSON.parse(readFileSync(join(sourceDir, file), "utf8"));

/* ---------- Simplification (mapshaper) ---------- */

// Les frontières communes restent jointives (mapshaper travaille sur la topologie).
// Précision d'environ 1 km : bien plus fin que ce qu'un écran de téléphone montre.
const simplified = join(sourceDir, "departements-simplifies.geojson");
const points = join(sourceDir, "departements-points.geojson");
const mapshaper = join(root, "node_modules/.bin/mapshaper");
execFileSync(mapshaper, [
  join(sourceDir, "departements.geojson"),
  "-filter-islands", "min-area=3km2", "remove-empty",
  "-simplify", "interval=900", "keep-shapes",
  "-o", "format=geojson", "precision=0.00001", simplified,
], { stdio: "inherit" });
// Point intérieur de chaque département (là où placer un repère ou une étiquette).
execFileSync(mapshaper, [simplified, "-points", "inner", "-o", "format=geojson", points], { stdio: "inherit" });

const shapes = readJson("departements-simplifies.geojson").features;
const innerPoints = new Map(readJson("departements-points.geojson").features.map((f) => [f.properties.code, f.geometry.coordinates]));
const meta = new Map(readJson("departements-meta.json").map((d) => [d.code, d]));
const regions = readJson("regions.json");
const communes = readJson("communes.json");
const prefectureNames = JSON.parse(readFileSync(join(here, "prefectures.json"), "utf8"));

/* ---------- Projections ---------- */

const rad = (degrees) => (degrees * Math.PI) / 180;

/** Lambert-93 (conique conforme, parallèles 44° et 49°), version sphérique : suffisante à cette échelle. */
function lambert93([lon, lat]) {
  const [phi1, phi2, phi0, lambda0] = [rad(44), rad(49), rad(46.5), rad(3)];
  const t = (phi) => Math.tan(Math.PI / 4 + phi / 2);
  const n = Math.log(Math.cos(phi1) / Math.cos(phi2)) / Math.log(t(phi2) / t(phi1));
  const F = (Math.cos(phi1) * t(phi1) ** n) / n;
  const rho = F / t(rad(lat)) ** n;
  const rho0 = F / t(phi0) ** n;
  const theta = n * (rad(lon) - lambda0);
  // y vers le bas, comme en SVG.
  return [rho * Math.sin(theta), -(rho0 - rho * Math.cos(theta))];
}

/** Projection locale d'un petit territoire (outre-mer) : équirectangulaire autour de sa latitude. */
const localProjection = (lat0) => ([lon, lat]) => [rad(lon) * Math.cos(rad(lat0)), -rad(lat)];

const rings = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flat();

function bounds(pointsList) {
  const xs = pointsList.map((p) => p[0]);
  const ys = pointsList.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Transformation qui fait tenir `box` (coordonnées projetées) dans le rectangle cible. */
function fit(box, [x, y, width, height], margin = 0) {
  const scale = Math.min((width - 2 * margin) / (box.maxX - box.minX), (height - 2 * margin) / (box.maxY - box.minY));
  const offsetX = x + (width - (box.maxX - box.minX) * scale) / 2;
  const offsetY = y + (height - (box.maxY - box.minY) * scale) / 2;
  return ([px, py]) => [offsetX + (px - box.minX) * scale, offsetY + (py - box.minY) * scale];
}

/** Chemin SVG compact : premier point absolu, puis déplacements relatifs arrondis au dixième. */
function toPath(ringsList, transform) {
  const round = (value) => Math.round(value * 10) / 10;
  const format = (value) => String(value).replace(/^(-?)0\./, "$1.");
  return ringsList
    .map((ring) => {
      const pts = ring.map((p) => transform(p)).map(([px, py]) => [round(px), round(py)]);
      let d = `M${format(pts[0][0])} ${format(pts[0][1])}l`;
      let previous = pts[0];
      const moves = [];
      for (const point of pts.slice(1, -1)) {
        const dx = round(point[0] - previous[0]);
        const dy = round(point[1] - previous[1]);
        if (dx === 0 && dy === 0) continue;
        moves.push(`${format(dx)} ${format(dy)}`);
        previous = point;
      }
      return `${d}${moves.join(" ").replace(/ -/g, "-")}z`;
    })
    .join("");
}

/* ---------- Mise en page ---------- */

// Métropole (Corse à sa place réelle) sur toute la hauteur ; à droite, une colonne réservée
// aux boutons de zoom ; l'outre-mer en colonne à gauche, dans l'Atlantique, sous la Bretagne ;
// l'encart de Paris en haut à gauche, dans la Manche.
const WIDTH = 1000;
const ZOOM_COLUMN = 110;
const MAP_MARGIN = 10;
const INSET_GAP = 12;
const isOverseas = (code) => code.startsWith("97");
const PETITE_COURONNE = ["75", "92", "93", "94"];

const mainland = shapes.filter((f) => !isOverseas(f.properties.code));
const mainlandBox = bounds(mainland.flatMap((f) => rings(f.geometry).flat().map(lambert93)));
const mapWidth = WIDTH - ZOOM_COLUMN;
const HEIGHT = Math.round(
  ((mapWidth - 2 * MAP_MARGIN) * (mainlandBox.maxY - mainlandBox.minY)) / (mainlandBox.maxX - mainlandBox.minX) + 2 * MAP_MARGIN,
);
const mainlandTransform = fit(mainlandBox, [0, 0, mapWidth, HEIGHT], MAP_MARGIN);

/** Emprise de quelques départements, une fois placés sur la carte. */
const placedBox = (codes) =>
  bounds(
    shapes
      .filter((f) => codes.includes(f.properties.code))
      .flatMap((f) => rings(f.geometry).flat().map((p) => mainlandTransform(lambert93(p)))),
  );
const atlanticCoast = placedBox(["44", "85", "17", "33", "40", "64"]);
const brittany = placedBox(["29", "56", "22"]);
const cotentin = placedBox(["50"]);

// Colonne de l'outre-mer : sous la Bretagne, sans toucher la côte atlantique.
const OVERSEAS = ["971", "972", "973", "974", "976"];
const columnTop = brittany.maxY + INSET_GAP;
const columnBottom = HEIGHT - MAP_MARGIN;
const overseasHeight = (columnBottom - columnTop - INSET_GAP * (OVERSEAS.length - 1)) / OVERSEAS.length;
const overseasWidth = Math.min(atlanticCoast.minX - INSET_GAP - MAP_MARGIN, overseasHeight * 1.25);
const overseasBox = (index) => [MAP_MARGIN, columnTop + index * (overseasHeight + INSET_GAP), overseasWidth, overseasHeight];

// Encart de Paris : en haut à gauche, avant le Cotentin et au-dessus de la Bretagne.
const parisBox = [
  MAP_MARGIN,
  MAP_MARGIN,
  Math.min(cotentin.minX - INSET_GAP - MAP_MARGIN, 200),
  Math.min(brittany.minY - INSET_GAP - MAP_MARGIN, 170),
];
const insetBoxes = { ...Object.fromEntries(OVERSEAS.map((code, index) => [code, overseasBox(index)])), idf: parisBox };
for (const [id, box] of Object.entries(insetBoxes)) {
  if (box[2] < 60 || box[3] < 60) throw new Error(`Encart ${id} trop petit : ${box.map(Math.round)}`);
}
const INSET_TITLES = {
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
  idf: "Petite couronne",
};

const transforms = new Map();
for (const feature of shapes) {
  const code = feature.properties.code;
  if (!isOverseas(code)) {
    transforms.set(code, (p) => mainlandTransform(lambert93(p)));
    continue;
  }
  const all = rings(feature.geometry).flat();
  const project = localProjection(bounds(all).minY + (bounds(all).maxY - bounds(all).minY) / 2);
  const box = bounds(all.map(project));
  const local = fit(box, insetBoxes[code], 8);
  transforms.set(code, (p) => local(project(p)));
}

// Encart de Paris : la petite couronne agrandie, et ses voisins en contexte (rognés).
const idfBox = bounds(
  shapes.filter((f) => PETITE_COURONNE.includes(f.properties.code)).flatMap((f) => rings(f.geometry).flat().map(lambert93)),
);
const idfTransform = fit(idfBox, parisBox, 6);
const IDF_CONTEXT = ["77", "78", "91", "95"];

const regionName = new Map(regions.map((r) => [r.code, r.nom]));
const typographic = (text) => text.replace(/'/g, "’");

const departments = shapes
  .map((feature) => {
    const code = feature.properties.code;
    const info = meta.get(code);
    const prefecture = communes.find((c) => c.codeDepartement === code && c.nom === prefectureNames[code]);
    if (!info || !prefecture) throw new Error(`Données manquantes pour ${code}`);
    const transform = transforms.get(code);
    const round = ([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    const department = {
      code,
      name: typographic(info.nom),
      region: info.codeRegion,
      prefecture: typographic(prefecture.nom),
      prefecturePoint: round(transform(prefecture.centre.coordinates)),
      center: round(transform(innerPoints.get(code))),
      path: toPath(rings(feature.geometry), transform),
    };
    if (PETITE_COURONNE.includes(code) || IDF_CONTEXT.includes(code)) {
      department.insetPath = toPath(rings(feature.geometry), (p) => idfTransform(lambert93(p)));
    }
    return department;
  })
  .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));

mkdirSync(dataDir, { recursive: true });
// Généré par scripts/geo/build-france.mjs : ne pas modifier à la main.
const list = {
  regions: regions.map((r) => ({ code: r.code, name: typographic(r.nom) })),
  departments: departments.map(({ path, insetPath, ...rest }) => rest),
};
const roundBox = (box) => box.map((value) => Math.round(value * 10) / 10);
const map = {
  viewBox: [0, 0, WIDTH, HEIGHT],
  /** Largeur réservée à droite aux boutons de zoom (repère de la carte). */
  zoomColumn: ZOOM_COLUMN,
  insets: Object.entries(insetBoxes).map(([id, box]) => ({ id, title: INSET_TITLES[id], box: roundBox(box) })),
  paths: Object.fromEntries(departments.map((d) => [d.code, d.insetPath ? [d.path, d.insetPath] : [d.path]])),
};
writeFileSync(listFile, JSON.stringify(list, null, 1));
writeFileSync(mapFile, JSON.stringify(map));
const kilobytes = (file) => Math.round(readFileSync(file).length / 1024);
console.log(`${departments.length} départements, ${regions.length} régions`);
console.log(`→ ${listFile} (${kilobytes(listFile)} Ko)`);
console.log(`→ ${mapFile} (${kilobytes(mapFile)} Ko)`);
console.log(`Régions représentées : ${[...new Set(departments.map((d) => regionName.get(d.region)))].length}`);
