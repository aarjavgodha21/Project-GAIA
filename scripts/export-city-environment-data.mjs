import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { INDIAN_CITY_DATA } = require('../src/data/indianCities.ts');

const AQ_API_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
const GBIF_API_BASE = 'https://api.gbif.org/v1';
const EONET_API_BASE = 'https://eonet.gsfc.nasa.gov/api/v3';

const MAJOR_CITY_OPTIONS = [
  { label: 'Ahmedabad', aliases: ['ahmedabad', 'ahmadabad'] },
  { label: 'Bengaluru', aliases: ['bengaluru', 'bangalore'] },
  { label: 'Bhopal', aliases: ['bhopal'] },
  { label: 'Chandigarh', aliases: ['chandigarh'] },
  { label: 'Chennai', aliases: ['chennai', 'madras'] },
  { label: 'Coimbatore', aliases: ['coimbatore'] },
  { label: 'Delhi', aliases: ['delhi', 'new delhi'] },
  { label: 'Faridabad', aliases: ['faridabad'] },
  { label: 'Ghaziabad', aliases: ['ghaziabad'] },
  { label: 'Gurugram', aliases: ['gurugram', 'gurgaon'] },
  { label: 'Guwahati', aliases: ['guwahati'] },
  { label: 'Hyderabad', aliases: ['hyderabad'] },
  { label: 'Indore', aliases: ['indore'] },
  { label: 'Jaipur', aliases: ['jaipur'] },
  { label: 'Kanpur', aliases: ['kanpur'] },
  { label: 'Kochi', aliases: ['kochi', 'cochin'] },
  { label: 'Kolkata', aliases: ['kolkata', 'calcutta'] },
  { label: 'Lucknow', aliases: ['lucknow'] },
  { label: 'Ludhiana', aliases: ['ludhiana'] },
  { label: 'Mumbai', aliases: ['mumbai', 'bombay'] },
  { label: 'Nagpur', aliases: ['nagpur'] },
  { label: 'Nashik', aliases: ['nashik', 'nasik'] },
  { label: 'Noida', aliases: ['noida'] },
  { label: 'Patna', aliases: ['patna'] },
  { label: 'Pune', aliases: ['pune'] },
  { label: 'Raipur', aliases: ['raipur'] },
  { label: 'Ranchi', aliases: ['ranchi'] },
  { label: 'Surat', aliases: ['surat'] },
  { label: 'Thiruvananthapuram', aliases: ['thiruvananthapuram', 'trivandrum'] },
  { label: 'Vadodara', aliases: ['vadodara', 'baroda'] },
  { label: 'Varanasi', aliases: ['varanasi', 'benaras'] },
  { label: 'Visakhapatnam', aliases: ['visakhapatnam', 'vizag'] },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeCityName = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const matchesCityAlias = (aliases, cityName) => {
  const normalized = normalizeCityName(cityName);
  return aliases.some((alias) => normalizeCityName(alias) === normalized);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonWithRetry = async (url, retries = 2) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(350 * (attempt + 1) + Math.round(Math.random() * 120));
      }
    }
  }

  throw lastError ?? new Error('Request failed');
};

const computeSustainabilityScore = (aqi, pm25, no2, co) => {
  const aqiNorm = clamp(aqi / 250, 0, 1);
  const pm25Norm = clamp(pm25 / 120, 0, 1);
  const no2Norm = clamp(no2 / 200, 0, 1);
  const coNorm = clamp(co / 3000, 0, 1);

  const pollutionIndex = (aqiNorm * 0.45) + (pm25Norm * 0.3) + (no2Norm * 0.15) + (coNorm * 0.1);
  return Math.round((1 - clamp(pollutionIndex, 0, 1)) * 1000) / 10;
};

const buildCurrentUrl = (lat, lon) => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
    timezone: 'auto',
  });
  return `${AQ_API_BASE}?${params.toString()}`;
};

const buildEnvironmentUrl = (lat, lon) => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,uv_index,wind_speed_10m',
    daily: 'temperature_2m_max',
    forecast_days: '7',
    timezone: 'auto',
  });
  return `${WEATHER_API_BASE}?${params.toString()}`;
};

const buildGbifOccurrenceUrl = (lat, lon) => {
  const delta = 0.35;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  const minLon = lon - delta;
  const maxLon = lon + delta;
  const geometry = `POLYGON((${minLon} ${minLat},${maxLon} ${minLat},${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))`;
  const yearStart = new Date().getFullYear() - 1;
  const yearEnd = new Date().getFullYear();

  const params = new URLSearchParams({
    geometry,
    has_coordinate: 'true',
    year: `${yearStart},${yearEnd}`,
    limit: '0',
  });

  return `${GBIF_API_BASE}/occurrence/search?${params.toString()}`;
};

const buildEonetWildfireUrl = (lat, lon) => {
  const delta = 0.5;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  const minLon = lon - delta;
  const maxLon = lon + delta;
  const params = new URLSearchParams({
    category: 'wildfires',
    status: 'all',
    days: '30',
    bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
  });

  return `${EONET_API_BASE}/events?${params.toString()}`;
};

const toCityRecords = INDIAN_CITY_DATA.map((city) => ({
  name: city.name,
  lat: city.lat,
  lon: city.lon,
  state: city.state,
  district: city.name,
}));

const getMapCoverageCities = (maxCities) => {
  if (maxCities <= 0 || toCityRecords.length <= maxCities) {
    return toCityRecords;
  }

  const byGrid = new Map();
  const remainder = [];

  toCityRecords.forEach((city) => {
    const gridKey = `${Math.round(city.lat * 2) / 2}_${Math.round(city.lon * 2) / 2}`;
    if (!byGrid.has(gridKey)) {
      byGrid.set(gridKey, city);
    } else {
      remainder.push(city);
    }
  });

  const firstPass = Array.from(byGrid.values());
  if (firstPass.length >= maxCities) {
    return firstPass.slice(0, maxCities);
  }

  return [...firstPass, ...remainder.slice(0, maxCities - firstPass.length)];
};

const getStandardCoverageCitiesWithMajors = (cityCount = 300) => {
  const baseCities = getMapCoverageCities(cityCount);
  const allCities = toCityRecords;

  const majorMatches = MAJOR_CITY_OPTIONS
    .map((city) => allCities.find((candidate) => matchesCityAlias(city.aliases, candidate.name)))
    .filter(Boolean);

  const seen = new Set();
  const merged = [...majorMatches, ...baseCities].filter((city) => {
    const key = `${city.name}-${city.lat.toFixed(4)}-${city.lon.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.slice(0, cityCount);
};

const fetchCurrentForCity = async (city) => {
  const payload = await fetchJsonWithRetry(buildCurrentUrl(city.lat, city.lon), 2);
  const current = payload?.current;
  if (!current) {
    throw new Error('Missing current AQ payload');
  }

  const aqiRaw = Number(current.us_aqi);
  const pm25Raw = Number(current.pm2_5);
  const pm10Raw = Number(current.pm10);
  const no2Raw = Number(current.nitrogen_dioxide);
  const o3Raw = Number(current.ozone);
  const so2Raw = Number(current.sulphur_dioxide);
  const coRaw = Number(current.carbon_monoxide);

  const availableCount = [aqiRaw, pm25Raw, pm10Raw, no2Raw, o3Raw, so2Raw, coRaw].filter(Number.isFinite).length;
  if (availableCount === 0) {
    throw new Error('No usable AQ values');
  }

  const aqi = Number.isFinite(aqiRaw) ? aqiRaw : (Number.isFinite(pm25Raw) ? clamp(pm25Raw * 2, 0, 500) : 50);
  const pm25 = Number.isFinite(pm25Raw) ? pm25Raw : (Number.isFinite(aqiRaw) ? clamp(aqiRaw / 2, 0, 500) : 10);
  const pm10 = Number.isFinite(pm10Raw) ? pm10Raw : clamp(pm25 * 1.5, 0, 600);
  const no2 = Number.isFinite(no2Raw) ? no2Raw : 0;
  const o3 = Number.isFinite(o3Raw) ? o3Raw : 0;
  const so2 = Number.isFinite(so2Raw) ? so2Raw : 0;
  const co = Number.isFinite(coRaw) ? coRaw : 0;

  return {
    aqi,
    pm25,
    pm10,
    no2,
    o3,
    so2,
    co,
    sustainabilityScore: computeSustainabilityScore(aqi, pm25, no2, co),
    updatedAt: String(current.time ?? new Date().toISOString()),
    dataSource: 'live',
  };
};

const fetchEnvironmentForCity = async (city) => {
  const [weatherPayload, gbifPayload, eonetPayload] = await Promise.all([
    fetchJsonWithRetry(buildEnvironmentUrl(city.lat, city.lon), 2),
    fetchJsonWithRetry(buildGbifOccurrenceUrl(city.lat, city.lon), 1).catch(() => null),
    fetchJsonWithRetry(buildEonetWildfireUrl(city.lat, city.lon), 1).catch(() => null),
  ]);

  const current = weatherPayload?.current;
  if (!current) {
    throw new Error('Missing weather payload');
  }

  const temperature = Number(current.temperature_2m);
  const humidity = Number(current.relative_humidity_2m);
  const precipitation = Number(current.precipitation);
  const uvIndex = Number(current.uv_index);
  const windSpeed = Number(current.wind_speed_10m);

  if (![temperature, humidity, precipitation].every(Number.isFinite)) {
    throw new Error('Invalid weather values');
  }

  const dailyMax = Array.isArray(weatherPayload?.daily?.temperature_2m_max)
    ? weatherPayload.daily.temperature_2m_max.map((value) => Number(value)).filter(Number.isFinite)
    : [];

  const heatwaveDaysNextWeek = dailyMax.filter((temp) => temp >= 40).length;
  const gbifCount = Number(gbifPayload?.count ?? 0);
  const biodiversitySignal = Math.round(clamp(Math.log10(Math.max(1, gbifCount)) / 4, 0, 1) * 100);

  const wildfireEvents30d = Array.isArray(eonetPayload?.events) ? eonetPayload.events.length : 0;
  const deforestationPressureProxy = Math.round(clamp(wildfireEvents30d / 12, 0, 1) * 100);

  const humidityStress = clamp(Math.abs(humidity - 55) / 45, 0, 1);
  const heatStress = clamp((temperature - 30) / 15, 0, 1);
  const rainfallRelief = 1 - clamp(precipitation / 5, 0, 1);
  const uvStress = clamp((Number.isFinite(uvIndex) ? uvIndex : 0) / 11, 0, 1);
  const windStress = clamp((Number.isFinite(windSpeed) ? windSpeed : 0) / 40, 0, 1);
  const heatwaveStress = clamp(heatwaveDaysNextWeek / 7, 0, 1);
  const wildfireStress = clamp(wildfireEvents30d / 10, 0, 1);
  const biodiversityRelief = 1 - clamp(biodiversitySignal / 100, 0, 1);

  const waterQualityProxy = Math.round(
    (1 - clamp(heatStress * 0.35 + rainfallRelief * 0.3 + humidityStress * 0.15 + uvStress * 0.1 + windStress * 0.1, 0, 1)) * 100,
  );

  const ecoStressIndex = Math.round(
    clamp(
      humidityStress * 0.13
      + heatStress * 0.2
      + rainfallRelief * 0.11
      + uvStress * 0.1
      + windStress * 0.1
      + heatwaveStress * 0.16
      + wildfireStress * 0.12
      + biodiversityRelief * 0.08,
      0,
      1,
    ) * 100,
  );

  const externalSignalsSource = gbifPayload && eonetPayload
    ? 'live'
    : gbifPayload || eonetPayload
      ? 'partial'
      : 'unavailable';

  return {
    humidity,
    temperature,
    precipitation,
    uvIndex: Number.isFinite(uvIndex) ? uvIndex : 0,
    windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
    heatwaveDaysNextWeek,
    biodiversitySignal,
    wildfireEvents30d,
    deforestationPressureProxy,
    waterQualityProxy,
    ecoStressIndex,
    updatedAt: String(current.time ?? new Date().toISOString()),
    dataSource: 'live',
    externalSignalsSource,
  };
};

const mapWithConcurrency = async (items, concurrency, task) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        break;
      }
      results[currentIndex] = await task(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const writeWorkbook = (filePath, sheetName, rows) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filePath);
};

const outputDir = path.resolve(process.cwd(), 'exports');
fs.mkdirSync(outputDir, { recursive: true });

const run = async () => {
  const startedAt = new Date();
  const cities = getStandardCoverageCitiesWithMajors(300);
  const fetchedAt = new Date().toISOString();

  console.log(`Preparing exports for ${cities.length} cities (standard coverage with guaranteed major-city inclusion)...`);

  const rows = await mapWithConcurrency(cities, 4, async (city, index) => {
    if ((index + 1) % 25 === 0 || index === 0) {
      console.log(`Fetching city ${index + 1}/${cities.length}...`);
    }

    let air = null;
    let airError = '';
    let env = null;
    let envError = '';

    try {
      air = await fetchCurrentForCity(city);
    } catch (error) {
      airError = error instanceof Error ? error.message : 'AQ fetch failed';
    }

    try {
      env = await fetchEnvironmentForCity(city);
    } catch (error) {
      envError = error instanceof Error ? error.message : 'Environment fetch failed';
    }

    return {
      city,
      air,
      env,
      airError,
      envError,
      fetchedAt,
    };
  });

  const aqiRows = rows.map(({ city, air, airError, fetchedAt: rowFetchedAt }) => ({
    city: city.name,
    state: city.state,
    district: city.district,
    latitude: city.lat,
    longitude: city.lon,
    aqi: air?.aqi ?? null,
    pm25: air?.pm25 ?? null,
    pm10: air?.pm10 ?? null,
    no2: air?.no2 ?? null,
    o3: air?.o3 ?? null,
    so2: air?.so2 ?? null,
    co: air?.co ?? null,
    sustainabilityScore: air?.sustainabilityScore ?? null,
    airDataSource: air?.dataSource ?? 'unavailable',
    airUpdatedAt: air?.updatedAt ?? null,
    airError: airError || null,
    fetchedAt: rowFetchedAt,
  }));

  const waterRows = rows.map(({ city, env, envError, fetchedAt: rowFetchedAt }) => ({
    city: city.name,
    state: city.state,
    district: city.district,
    latitude: city.lat,
    longitude: city.lon,
    humidity: env?.humidity ?? null,
    temperature: env?.temperature ?? null,
    precipitation: env?.precipitation ?? null,
    uvIndex: env?.uvIndex ?? null,
    windSpeed: env?.windSpeed ?? null,
    heatwaveDaysNextWeek: env?.heatwaveDaysNextWeek ?? null,
    waterQualityProxy: env?.waterQualityProxy ?? null,
    ecoStressIndex: env?.ecoStressIndex ?? null,
    waterDataSource: env?.dataSource ?? 'unavailable',
    externalSignalsSource: env?.externalSignalsSource ?? 'unavailable',
    envUpdatedAt: env?.updatedAt ?? null,
    envError: envError || null,
    fetchedAt: rowFetchedAt,
  }));

  const combinedRows = rows.map(({ city, air, env, airError, envError, fetchedAt: rowFetchedAt }) => ({
    city: city.name,
    state: city.state,
    district: city.district,
    latitude: city.lat,
    longitude: city.lon,
    aqi: air?.aqi ?? null,
    pm25: air?.pm25 ?? null,
    pm10: air?.pm10 ?? null,
    no2: air?.no2 ?? null,
    o3: air?.o3 ?? null,
    so2: air?.so2 ?? null,
    co: air?.co ?? null,
    sustainabilityScore: air?.sustainabilityScore ?? null,
    humidity: env?.humidity ?? null,
    temperature: env?.temperature ?? null,
    precipitation: env?.precipitation ?? null,
    uvIndex: env?.uvIndex ?? null,
    windSpeed: env?.windSpeed ?? null,
    heatwaveDaysNextWeek: env?.heatwaveDaysNextWeek ?? null,
    biodiversitySignal: env?.biodiversitySignal ?? null,
    wildfireEvents30d: env?.wildfireEvents30d ?? null,
    deforestationPressureProxy: env?.deforestationPressureProxy ?? null,
    waterQualityProxy: env?.waterQualityProxy ?? null,
    ecoStressIndex: env?.ecoStressIndex ?? null,
    airDataSource: air?.dataSource ?? 'unavailable',
    environmentDataSource: env?.dataSource ?? 'unavailable',
    externalSignalsSource: env?.externalSignalsSource ?? 'unavailable',
    airUpdatedAt: air?.updatedAt ?? null,
    environmentUpdatedAt: env?.updatedAt ?? null,
    airError: airError || null,
    environmentError: envError || null,
    fetchedAt: rowFetchedAt,
  }));

  const aqiPath = path.join(outputDir, 'aqi_values_with_coordinates.xlsx');
  const waterPath = path.join(outputDir, 'water_signals_with_coordinates.xlsx');
  const combinedPath = path.join(outputDir, 'combined_all_attributes.xlsx');

  writeWorkbook(aqiPath, 'AQI', aqiRows);
  writeWorkbook(waterPath, 'Water', waterRows);
  writeWorkbook(combinedPath, 'Combined', combinedRows);

  const airOk = rows.filter((row) => row.air).length;
  const envOk = rows.filter((row) => row.env).length;
  const endedAt = new Date();

  console.log('Export complete.');
  console.log(`AQI workbook: ${aqiPath}`);
  console.log(`Water workbook: ${waterPath}`);
  console.log(`Combined workbook: ${combinedPath}`);
  console.log(`Air rows with live values: ${airOk}/${rows.length}`);
  console.log(`Environment rows with live values: ${envOk}/${rows.length}`);
  console.log(`Runtime: ${Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)}s`);
};

run().catch((error) => {
  console.error('Export failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
