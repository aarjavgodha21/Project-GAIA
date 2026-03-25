import { INDIAN_CITY_DATA } from '../data/indianCities';

export type CityLocation = {
  name: string;
  lat: number;
  lon: number;
  state?: string;
  district?: string;
};

export type LiveAirQuality = {
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  sustainabilityScore: number;
  updatedAt: string;
  dataSource: 'live' | 'cache-fresh' | 'cache-stale';
  cacheAgeMinutes: number;
};

export type ApiThrottleStatus = {
  isCoolingDown: boolean;
  retryAt: number | null;
  remainingMs: number;
};

export type AirQualityHistory = {
  time: string[];
  pm25: number[];
  no2: number[];
  co: number[];
  aqi: number[];
};

export const INDIAN_CITIES: CityLocation[] = INDIAN_CITY_DATA.map((city) => ({
  name: city.name,
  lat: city.lat,
  lon: city.lon,
  state: city.state,
  district: city.name,
}));

export const getMapCoverageCities = (maxCities: number): CityLocation[] => {
  if (maxCities <= 0 || INDIAN_CITIES.length <= maxCities) {
    return INDIAN_CITIES;
  }

  const byGrid = new Map<string, CityLocation>();
  const remainder: CityLocation[] = [];

  INDIAN_CITIES.forEach((city) => {
    const gridKey = `${Math.round(city.lat * 2) / 2}_${Math.round(city.lon * 2) / 2}`;
    if (!byGrid.has(gridKey)) {
      byGrid.set(gridKey, city);
      return;
    }
    remainder.push(city);
  });

  const firstPass = Array.from(byGrid.values());
  if (firstPass.length >= maxCities) {
    return firstPass.slice(0, maxCities);
  }

  return [...firstPass, ...remainder.slice(0, maxCities - firstPass.length)];
};

const AQ_API_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const CURRENT_CACHE_TTL_MS = 30 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CONCURRENT_API_REQUESTS = 2;
const MIN_REQUEST_GAP_MS = 260;

let activeApiRequests = 0;
let lastRequestStartedAt = 0;
let apiCooldownUntil = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalize = (value: number, max: number) => clamp(value / max, 0, 1);

export const computeSustainabilityScore = (
  aqi: number,
  pm25: number,
  no2: number,
  co: number,
): number => {
  const aqiNorm = normalize(aqi, 250);
  const pm25Norm = normalize(pm25, 120);
  const no2Norm = normalize(no2, 200);
  const coNorm = normalize(co, 3000);

  const pollutionIndex =
    aqiNorm * 0.45 +
    pm25Norm * 0.3 +
    no2Norm * 0.15 +
    coNorm * 0.1;

  const score = (1 - clamp(pollutionIndex, 0, 1)) * 100;
  return Math.round(score * 10) / 10;
};

const buildCurrentUrl = (lat: number, lon: number) => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
    timezone: 'auto',
  });

  return `${AQ_API_BASE}?${params.toString()}`;
};

const buildHistoryUrl = (lat: number, lon: number, startDate: string, endDate: string) => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: startDate,
    end_date: endDate,
    hourly: 'pm2_5,nitrogen_dioxide,carbon_monoxide,us_aqi',
    timezone: 'auto',
  });

  return `${AQ_API_BASE}?${params.toString()}`;
};

const safeStorageGet = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const safeStorageSet = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / availability errors.
  }
};

const isCacheFresh = (timestamp: number, ttlMs: number) => Date.now() - timestamp <= ttlMs;

const normalizeUpdatedAt = (raw: unknown): string => {
  const value = String(raw ?? '').replace(/\s*\(cached\)$/i, '').trim();
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
};

const normalizeCachedLiveValue = (cached: { timestamp: number; value: LiveAirQuality }) => {
  const normalizedUpdatedAt = normalizeUpdatedAt(cached.value.updatedAt);
  const safeDataSource = cached.value.dataSource ?? 'cache-fresh';
  const safeCacheAge = Number.isFinite(cached.value.cacheAgeMinutes) ? cached.value.cacheAgeMinutes : getCacheAgeMinutes(cached.timestamp);

  if (
    normalizedUpdatedAt === cached.value.updatedAt
    && safeDataSource === cached.value.dataSource
    && safeCacheAge === cached.value.cacheAgeMinutes
  ) {
    return cached;
  }

  return {
    ...cached,
    value: {
      ...cached.value,
      updatedAt: normalizedUpdatedAt,
      dataSource: safeDataSource,
      cacheAgeMinutes: safeCacheAge,
    },
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getCacheAgeMinutes = (cachedAt: number) => Math.max(0, Math.round((Date.now() - cachedAt) / 60000));

export const getApiThrottleStatus = (): ApiThrottleStatus => {
  const remainingMs = Math.max(0, apiCooldownUntil - Date.now());
  return {
    isCoolingDown: remainingMs > 0,
    retryAt: remainingMs > 0 ? apiCooldownUntil : null,
    remainingMs,
  };
};

const acquireRequestSlot = async () => {
  const cooldown = getApiThrottleStatus();
  if (cooldown.isCoolingDown) {
    await sleep(cooldown.remainingMs);
  }

  while (activeApiRequests >= MAX_CONCURRENT_API_REQUESTS) {
    await sleep(35);
  }

  const now = Date.now();
  const elapsed = now - lastRequestStartedAt;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - elapsed);
  }

  activeApiRequests += 1;
  lastRequestStartedAt = Date.now();
};

const releaseRequestSlot = () => {
  activeApiRequests = Math.max(0, activeApiRequests - 1);
};

type HttpRequestError = Error & { status?: number; retryAfterMs?: number };

const parseRetryAfterHeader = (retryAfter: string | null): number | undefined => {
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const dateTimestamp = Date.parse(retryAfter);
  if (!Number.isNaN(dateTimestamp)) {
    const diff = dateTimestamp - Date.now();
    return diff > 0 ? diff : undefined;
  }

  return undefined;
};

const fetchJsonWithRetry = async (url: string, retries = 2): Promise<unknown> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let slotAcquired = false;
    try {
      await acquireRequestSlot();
      slotAcquired = true;
      const response = await fetch(url);
      releaseRequestSlot();
      slotAcquired = false;

      if (!response.ok) {
        const retryAfterMs = parseRetryAfterHeader(response.headers.get('retry-after'));
        const error = new Error(`Request failed with status ${response.status}`) as HttpRequestError;
        error.status = response.status;
        if (retryAfterMs !== undefined) {
          error.retryAfterMs = retryAfterMs;
        }

        if (response.status === 429) {
          const fallbackMs = 2500;
          apiCooldownUntil = Math.max(apiCooldownUntil, Date.now() + (retryAfterMs ?? fallbackMs));
        }
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (slotAcquired) {
        releaseRequestSlot();
      }
      const typedError: HttpRequestError = error instanceof Error
        ? (error as HttpRequestError)
        : (new Error('Unknown request error') as HttpRequestError);
      lastError = typedError;

      if (attempt < retries) {
        const jitter = Math.round(Math.random() * 120);
        if (typedError.status === 429) {
          const retryAfterMs = typedError.retryAfterMs ?? (attempt + 1) * 1500;
          await sleep(retryAfterMs + jitter);
        } else {
          await sleep((attempt + 1) * 350 + jitter);
        }
      }
    }
  }

  throw lastError ?? new Error('Request failed');
};

export const fetchCurrentAirQuality = async (
  lat: number,
  lon: number,
  options?: { allowStaleCache?: boolean },
): Promise<LiveAirQuality> => {
  const cacheKey = `gaia:aq:current:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const cachedRaw = safeStorageGet<{ timestamp: number; value: LiveAirQuality }>(cacheKey);
  const cached = cachedRaw ? normalizeCachedLiveValue(cachedRaw) : null;
  if (cachedRaw && cached && cachedRaw.value.updatedAt !== cached.value.updatedAt) {
    safeStorageSet(cacheKey, cached);
  }

  if (cached && isCacheFresh(cached.timestamp, CURRENT_CACHE_TTL_MS)) {
    return {
      ...cached.value,
      dataSource: 'cache-fresh',
      cacheAgeMinutes: getCacheAgeMinutes(cached.timestamp),
    };
  }

  if (cached && options?.allowStaleCache) {
    return {
      ...cached.value,
      dataSource: 'cache-stale',
      cacheAgeMinutes: getCacheAgeMinutes(cached.timestamp),
    };
  }

  try {
    const payload = await fetchJsonWithRetry(buildCurrentUrl(lat, lon)) as {
      current?: {
        us_aqi?: unknown;
        pm2_5?: unknown;
        pm10?: unknown;
        nitrogen_dioxide?: unknown;
        ozone?: unknown;
        sulphur_dioxide?: unknown;
        carbon_monoxide?: unknown;
        time?: unknown;
      };
    };
    const current = payload?.current;
    if (!current) {
      throw new Error('Live air-quality response is missing current values.');
    }

    const aqi = Number(current.us_aqi);
    const pm25 = Number(current.pm2_5);
    const pm10 = Number(current.pm10);
    const no2 = Number(current.nitrogen_dioxide);
    const o3 = Number(current.ozone);
    const so2 = Number(current.sulphur_dioxide);
    const co = Number(current.carbon_monoxide);

    if (![aqi, pm25, pm10, no2, o3, so2, co].every(Number.isFinite)) {
      throw new Error('Live air-quality response returned invalid numeric values.');
    }

    const live: LiveAirQuality = {
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
      cacheAgeMinutes: 0,
    };

    safeStorageSet(cacheKey, { timestamp: Date.now(), value: live });
    return live;
  } catch (error) {
    if (cached) {
      return {
        ...cached.value,
        dataSource: isCacheFresh(cached.timestamp, CURRENT_CACHE_TTL_MS) ? 'cache-fresh' : 'cache-stale',
        cacheAgeMinutes: getCacheAgeMinutes(cached.timestamp),
      };
    }

    const message = error instanceof Error ? error.message : 'Failed to fetch live air-quality data.';
    throw new Error(message);
  }
};

export const fetchHistoricalAirQuality = async (
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<AirQualityHistory> => {
  const cacheKey = `gaia:aq:history:${lat.toFixed(4)}:${lon.toFixed(4)}:${startDate}:${endDate}`;
  const cached = safeStorageGet<{ timestamp: number; value: AirQualityHistory }>(cacheKey);
  if (cached && isCacheFresh(cached.timestamp, HISTORY_CACHE_TTL_MS)) {
    return cached.value;
  }

  try {
    const payload = await fetchJsonWithRetry(buildHistoryUrl(lat, lon, startDate, endDate)) as {
      hourly?: {
        time?: unknown;
        pm2_5?: unknown;
        nitrogen_dioxide?: unknown;
        carbon_monoxide?: unknown;
        us_aqi?: unknown;
      };
    };
    const hourly = payload?.hourly;
    if (!hourly || !Array.isArray(hourly.time)) {
      throw new Error('Historical air-quality response is missing hourly values.');
    }

    const times = hourly.time as string[];
    const parseNumber = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const pm25Hourly = Array.isArray(hourly.pm2_5) ? hourly.pm2_5.map((n: unknown) => parseNumber(n)) : [];
    const no2Hourly = Array.isArray(hourly.nitrogen_dioxide) ? hourly.nitrogen_dioxide.map((n: unknown) => parseNumber(n)) : [];
    const coHourly = Array.isArray(hourly.carbon_monoxide) ? hourly.carbon_monoxide.map((n: unknown) => parseNumber(n)) : [];
    const aqiHourly = Array.isArray(hourly.us_aqi) ? hourly.us_aqi.map((n: unknown) => parseNumber(n)) : [];

    const dailyBuckets = new Map<string, { pm25: number[]; no2: number[]; co: number[]; aqi: number[] }>();

    times.forEach((timestamp, idx) => {
      const date = String(timestamp).slice(0, 10);
      const bucket = dailyBuckets.get(date) ?? { pm25: [], no2: [], co: [], aqi: [] };

      const pm25Value = pm25Hourly[idx];
      const no2Value = no2Hourly[idx];
      const coValue = coHourly[idx];
      const aqiValue = aqiHourly[idx];

      if (Number.isFinite(pm25Value)) bucket.pm25.push(pm25Value);
      if (Number.isFinite(no2Value)) bucket.no2.push(no2Value);
      if (Number.isFinite(coValue)) bucket.co.push(coValue);
      if (Number.isFinite(aqiValue)) bucket.aqi.push(aqiValue);
      dailyBuckets.set(date, bucket);
    });

    const dates = Array.from(dailyBuckets.keys()).sort((a, b) => a.localeCompare(b));
    const average = (values: number[]) => {
      if (!values.length) return Number.NaN;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    const pm25 = dates.map((date) => average(dailyBuckets.get(date)?.pm25 ?? []));
    const no2 = dates.map((date) => average(dailyBuckets.get(date)?.no2 ?? []));
    const co = dates.map((date) => average(dailyBuckets.get(date)?.co ?? []));
    const aqi = dates.map((date) => average(dailyBuckets.get(date)?.aqi ?? []));

    const history: AirQualityHistory = {
      time: dates,
      pm25,
      no2,
      co,
      aqi,
    };

    safeStorageSet(cacheKey, { timestamp: Date.now(), value: history });
    return history;
  } catch (error) {
    if (cached) {
      return cached.value;
    }

    const message = error instanceof Error ? error.message : 'Failed to fetch historical air-quality data.';
    throw new Error(message);
  }
};
