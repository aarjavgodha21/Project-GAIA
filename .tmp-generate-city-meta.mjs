import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indiaCitiesPath = path.join(root, 'src', 'data', 'indiaCities.ts');
const citiesPath = path.join(root, 'node_modules', 'cities.json', 'cities.json');
const admin1Path = path.join(root, 'node_modules', 'cities.json', 'admin1.json');
const admin2Path = path.join(root, 'node_modules', 'cities.json', 'admin2.json');

const normalize = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’'`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const toRad = (deg) => (deg * Math.PI) / 180;
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const src = fs.readFileSync(indiaCitiesPath, 'utf8');
const start = src.indexOf('[');
const end = src.lastIndexOf(']');
const parsedCities = JSON.parse(src.slice(start, end + 1));

const worldCities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
const admin1 = JSON.parse(fs.readFileSync(admin1Path, 'utf8'));
const admin2 = JSON.parse(fs.readFileSync(admin2Path, 'utf8'));

const admin1Map = new Map(admin1.map((entry) => [entry.code, entry.name]));
const admin2Map = new Map(admin2.map((entry) => [entry.code, entry.name]));

const indiaWorld = worldCities
  .filter((entry) => entry.country === 'IN')
  .map((entry) => ({
    ...entry,
    normName: normalize(String(entry.name ?? '')),
    latNum: Number(entry.lat),
    lonNum: Number(entry.lng),
    stateCode: entry.admin1 ? `IN.${entry.admin1}` : '',
    districtCode: entry.admin2 && entry.admin1 ? `IN.${entry.admin1}.${entry.admin2}` : '',
  }))
  .filter((entry) => Number.isFinite(entry.latNum) && Number.isFinite(entry.lonNum));

const byName = new Map();
for (const entry of indiaWorld) {
  const key = entry.normName;
  const list = byName.get(key) ?? [];
  list.push(entry);
  byName.set(key, list);
}

const metadata = parsedCities.map((city) => {
  const name = String(city.name);
  const lat = Number(city.lat);
  const lon = Number(city.lon);
  const norm = normalize(name);

  const sameName = byName.get(norm) ?? [];
  const candidates = sameName.length ? sameName : indiaWorld;

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distanceKm(lat, lon, candidate.latNum, candidate.lonNum);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }

  let state = 'Unknown';
  let district = 'Unknown';

  if (best) {
    state = admin1Map.get(best.stateCode) ?? 'Unknown';
    district = admin2Map.get(best.districtCode) ?? best.name ?? 'Unknown';
  }

  if (district === 'Unknown') {
    district = name;
  }

  return {
    name,
    lat,
    lon,
    state,
    district,
  };
});

const outPath = path.join(root, 'src', 'data', 'indiaCitiesMetadata.ts');
const banner = "export type IndiaCityMetadata = { name: string; lat: number; lon: number; state: string; district: string };\n\n";
const body = `export const INDIA_CITIES_METADATA: IndiaCityMetadata[] = ${JSON.stringify(metadata, null, 2)};\n`;
fs.writeFileSync(outPath, banner + body, 'utf8');

console.log(`Generated ${metadata.length} metadata records at ${outPath}`);
