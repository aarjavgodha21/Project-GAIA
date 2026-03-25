import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  INDIAN_CITIES,
  computeSustainabilityScore,
  fetchCurrentAirQuality,
  fetchHistoricalAirQuality,
} from '../services/airQualityService';
import './Predictions.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

type YearlyMetrics = {
  year: number;
  aqi: number;
  pm25: number;
  no2: number;
  co: number;
};

type MonthlyAqi = {
  month: number;
  valuesByYear: Map<number, number>;
};

type ForecastConfidence = {
  score: number;
  label: 'High' | 'Medium' | 'Low';
  summary: string;
  years: number;
  monthlyPoints: number;
  volatility: number;
};

type CityOption = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  district: string;
  label: string;
  searchText: string;
};

const CITY_OPTIONS: CityOption[] = INDIAN_CITIES
  .map((city) => ({
    key: `${city.name}|${city.lat.toFixed(5)}|${city.lon.toFixed(5)}`,
    name: city.name,
    lat: city.lat,
    lon: city.lon,
    state: city.state ?? 'Unknown State',
    district: city.district ?? city.name,
    label: `${city.name}, ${city.state ?? 'Unknown State'} · ${city.district ?? city.name} district`,
    searchText: `${city.name} ${city.state ?? ''} ${city.district ?? city.name}`.toLowerCase(),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getScoreStatus = (score: number) => {
  if (score >= 70) return 'good';
  if (score >= 40) return 'moderate';
  return 'critical';
};

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const residualStdDev = (points: Array<{ x: number; y: number }>) => {
  if (points.length <= 2) {
    return stdDev(points.map((point) => point.y));
  }

  const residuals = points
    .map((point) => {
      const predicted = linearRegressionPredict(points, point.x);
      return Number.isFinite(predicted) ? point.y - predicted : 0;
    });

  return stdDev(residuals);
};

const getYearFromDate = (date: string) => Number(date.slice(0, 4));
const getMonthFromDate = (date: string) => Number(date.slice(5, 7));

const linearRegressionPredict = (points: Array<{ x: number; y: number }>, targetX: number): number => {
  if (!points.length) return Number.NaN;
  if (points.length === 1) return points[0].y;

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return points[points.length - 1].y;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return slope * targetX + intercept;
};

const aggregateYearlyMetrics = (
  dates: string[],
  aqi: number[],
  pm25: number[],
  no2: number[],
  co: number[],
): YearlyMetrics[] => {
  const grouped = new Map<number, { aqi: number[]; pm25: number[]; no2: number[]; co: number[] }>();

  dates.forEach((date, idx) => {
    const year = getYearFromDate(date);
    const group = grouped.get(year) ?? { aqi: [], pm25: [], no2: [], co: [] };

    const aqiValue = aqi[idx];
    const pm25Value = pm25[idx];
    const no2Value = no2[idx];
    const coValue = co[idx];

    if (Number.isFinite(aqiValue)) group.aqi.push(aqiValue);
    if (Number.isFinite(pm25Value)) group.pm25.push(pm25Value);
    if (Number.isFinite(no2Value)) group.no2.push(no2Value);
    if (Number.isFinite(coValue)) group.co.push(coValue);
    grouped.set(year, group);
  });

  const average = (values: number[]) => {
    if (!values.length) return Number.NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => ({
      year,
      aqi: average(values.aqi),
      pm25: average(values.pm25),
      no2: average(values.no2),
      co: average(values.co),
    }))
    .filter((entry) => [entry.aqi, entry.pm25, entry.no2, entry.co].every(Number.isFinite));
};

const aggregateMonthlyAqi = (dates: string[], aqi: number[]): MonthlyAqi[] => {
  const months = Array.from({ length: 12 }, (_, i) => i + 1).map((month) => ({
    month,
    valuesByYear: new Map<number, number>(),
  }));

  const monthYearBuckets = new Map<string, number[]>();

  dates.forEach((date, idx) => {
    const year = getYearFromDate(date);
    const month = getMonthFromDate(date);
    const aqiValue = aqi[idx];
    if (!Number.isFinite(aqiValue)) return;
    const key = `${year}-${month}`;
    const bucket = monthYearBuckets.get(key) ?? [];
    bucket.push(aqiValue);
    monthYearBuckets.set(key, bucket);
  });

  monthYearBuckets.forEach((values, key) => {
    const [yearStr, monthStr] = key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    months[month - 1].valuesByYear.set(year, avg);
  });

  return months;
};

const getPredictedMetrics = (yearlyMetrics: YearlyMetrics[], targetYear: number) => {
  const buildPoints = (key: keyof Omit<YearlyMetrics, 'year'>) =>
    yearlyMetrics
      .map((entry) => ({ x: entry.year, y: entry[key] }))
      .filter((entry) => Number.isFinite(entry.y));

  const predictWithFallback = (key: keyof Omit<YearlyMetrics, 'year'>) => {
    const points = buildPoints(key);
    const fallback = points.length ? points[points.length - 1].y : 0;
    const predicted = linearRegressionPredict(points, targetYear);
    if (!Number.isFinite(predicted)) return Math.max(0, fallback);
    return Math.max(0, predicted);
  };

  const predictedAqi = predictWithFallback('aqi');
  const predictedPm25 = predictWithFallback('pm25');
  const predictedNo2 = predictWithFallback('no2');
  const predictedCo = predictWithFallback('co');

  return {
    aqi: Math.round(predictedAqi),
    pm25: Math.round(predictedPm25 * 10) / 10,
    no2: Math.round(predictedNo2 * 10) / 10,
    co: Math.round(predictedCo * 10) / 10,
  };
};

const buildCoTrendData = (yearlyMetrics: YearlyMetrics[], targetYear: number) => {
  if (!yearlyMetrics.length) {
    return {
      labels: [] as string[],
      historical: [] as (number | null)[],
      forecast: [] as (number | null)[],
      forecastLower: [] as (number | null)[],
      forecastUpper: [] as (number | null)[],
    };
  }

  const historicalYears = yearlyMetrics.map((entry) => entry.year);
  const lastHistoricalYear = historicalYears[historicalYears.length - 1];
  const futureYears = targetYear > lastHistoricalYear
    ? Array.from({ length: targetYear - lastHistoricalYear }, (_, i) => lastHistoricalYear + i + 1)
    : [];

  const labels = [...historicalYears.map(String), ...futureYears.map(String)];
  const historical = [...yearlyMetrics.map((entry) => Math.round(entry.co * 100) / 100), ...futureYears.map(() => null)];

  const points = yearlyMetrics.map((entry) => ({ x: entry.year, y: entry.co }));
  const safePoints = points.filter((point) => Number.isFinite(point.y));
  const fallback = safePoints.length ? safePoints[safePoints.length - 1].y : 0;
  const residual = residualStdDev(safePoints);
  const forecastValues = futureYears.map((year) => {
    const predicted = linearRegressionPredict(safePoints, year);
    return Math.max(0, Number.isFinite(predicted) ? predicted : fallback);
  });

  const forecastLowerValues = forecastValues.map((value, index) => {
    const spread = Math.max(0.2, residual * (1 + index * 0.15));
    return Math.max(0, value - spread);
  });

  const forecastUpperValues = forecastValues.map((value, index) => {
    const spread = Math.max(0.2, residual * (1 + index * 0.15));
    return value + spread;
  });

  const forecast: (number | null)[] = [
    ...historicalYears.slice(0, -1).map(() => null),
    Math.round(yearlyMetrics[yearlyMetrics.length - 1].co * 100) / 100,
    ...forecastValues.map((value) => Math.round(value * 100) / 100),
  ];

  const forecastLower: (number | null)[] = [
    ...historicalYears.map(() => null),
    ...forecastLowerValues.map((value) => Math.round(value * 100) / 100),
  ];

  const forecastUpper: (number | null)[] = [
    ...historicalYears.map(() => null),
    ...forecastUpperValues.map((value) => Math.round(value * 100) / 100),
  ];

  return { labels, historical, forecast, forecastLower, forecastUpper };
};

const buildAqiData = (monthly: MonthlyAqi[], targetYear: number) => {
  const values = monthly.map((monthData) => {
    const points = Array.from(monthData.valuesByYear.entries()).map(([year, value]) => ({ x: year, y: value }));
    const fallback = points.length ? points[points.length - 1].y : 0;
    const predicted = linearRegressionPredict(points, targetYear);
    const safePredicted = Number.isFinite(predicted) ? predicted : fallback;
    const nonNegative = Math.max(0, safePredicted);
    return Math.round(nonNegative);
  });

  return { labels: MONTHS, values };
};

const getForecastConfidence = (yearlyMetrics: YearlyMetrics[], monthlyAqi: MonthlyAqi[]): ForecastConfidence => {
  if (!yearlyMetrics.length) {
    return {
      score: 0,
      label: 'Low',
      summary: 'Insufficient historical data to estimate confidence.',
      years: 0,
      monthlyPoints: 0,
      volatility: 0,
    };
  }

  const years = yearlyMetrics.length;
  const monthlyPoints = monthlyAqi.reduce((sum, month) => sum + month.valuesByYear.size, 0);
  const yearlyAqi = yearlyMetrics.map((entry) => entry.aqi);
  const volatility = stdDev(yearlyAqi);

  const yearCoverage = clamp(years / 8, 0, 1);
  const monthCoverage = clamp(monthlyPoints / (12 * 5), 0, 1);
  const stability = 1 - clamp(volatility / 80, 0, 1);

  const score = Math.round((yearCoverage * 0.45 + monthCoverage * 0.25 + stability * 0.3) * 100);
  const label: ForecastConfidence['label'] = score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low';

  const summary =
    label === 'High'
      ? 'Strong signal from historical trends with relatively stable year-over-year behavior.'
      : label === 'Medium'
        ? 'Reasonable signal, but variability and/or limited history can affect precision.'
        : 'Low confidence due to limited history or high volatility. Treat as directional guidance.';

  return { score, label, summary, years, monthlyPoints, volatility };
};

const getRiskAlerts = (
  cityName: string,
  targetYear: number,
  metrics: { aqi: number; pm25: number; no2: number; co: number },
  currentAqi: number | null,
) => {
  const alerts: { type: 'warning' | 'danger' | 'info'; icon: string; text: string }[] = [];

  if (metrics.pm25 > 60) {
    alerts.push({
      type: 'danger',
      icon: '🔴',
      text: `Predicted PM2.5 is ${metrics.pm25} µg/m³ in ${targetYear}, above high-risk limits.`,
    });
  } else if (metrics.pm25 > 35) {
    alerts.push({
      type: 'warning',
      icon: '⚠️',
      text: `Predicted PM2.5 is ${metrics.pm25} µg/m³ in ${targetYear}. Sensitive groups may be affected.`,
    });
  }

  if (metrics.aqi > 150) {
    alerts.push({
      type: 'danger',
      icon: '🚨',
      text: `Forecast AQI of ${metrics.aqi} indicates unhealthy air in ${cityName} by ${targetYear}.`,
    });
  } else if (metrics.aqi > 100) {
    alerts.push({
      type: 'warning',
      icon: '⚠️',
      text: `Forecast AQI of ${metrics.aqi} is above moderate levels in ${targetYear}.`,
    });
  }

  if (metrics.no2 > 100) {
    alerts.push({
      type: 'warning',
      icon: '🧪',
      text: `NO₂ is projected at ${metrics.no2} ppb in ${targetYear}, indicating traffic and combustion pressure.`,
    });
  }

  if (currentAqi !== null) {
    alerts.push({
      type: 'info',
      icon: '📡',
      text: `Live AQI right now is ${Math.round(currentAqi)}. Forecasts are trained on daily data from 2020 onward.`,
    });
  }

  if (!alerts.length) {
    alerts.push({
      type: 'info',
      icon: '✅',
      text: `No severe pollution risks are projected for ${cityName} in ${targetYear} based on current trends.`,
    });
  }

  return alerts;
};

/* ───────── Chart theme options ───────── */

const chartGridColor = 'rgba(148, 163, 184, 0.1)';
const chartTickColor = '#94a3b8';

const co2ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      labels: { color: '#cbd5e1', font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          ctx.parsed.y != null ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} µg/m³` : '',
      },
    },
  },
  scales: {
    x: { grid: { color: chartGridColor }, ticks: { color: chartTickColor } },
    y: {
      grid: { color: chartGridColor },
      ticks: {
        color: chartTickColor,
        callback: (v: string | number) => `${Number(v).toFixed(2)} µg/m³`,
      },
      title: { display: true, text: 'CO (µg/m³)', color: chartTickColor },
    },
  },
};

const aqiChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) => `AQI: ${ctx.parsed.y ?? 0}`,
      },
    },
  },
  scales: {
    x: { grid: { color: chartGridColor }, ticks: { color: chartTickColor } },
    y: {
      grid: { color: chartGridColor },
      ticks: { color: chartTickColor },
      title: { display: true, text: 'AQI', color: chartTickColor },
      beginAtZero: true,
    },
  },
};

/* ───────── Component ───────── */

const Predictions = () => {
  const navigate = useNavigate();
  const [selectedCityKey, setSelectedCityKey] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [year, setYear] = useState<number>(currentYear + 1);
  const [predicted, setPredicted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [currentAqi, setCurrentAqi] = useState<number | null>(null);
  const [yearlyMetrics, setYearlyMetrics] = useState<YearlyMetrics[]>([]);
  const [monthlyAqi, setMonthlyAqi] = useState<MonthlyAqi[]>([]);

  const selectedCity = useMemo(
    () => CITY_OPTIONS.find((option) => option.key === selectedCityKey) ?? null,
    [selectedCityKey],
  );
  const selectedCityName = selectedCity?.name ?? '';

  const filteredCityOptions = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    if (!query) {
      return CITY_OPTIONS.slice(0, 150);
    }

    const starts = CITY_OPTIONS.filter((option) => option.searchText.startsWith(query));
    const contains = CITY_OPTIONS.filter(
      (option) => !option.searchText.startsWith(query) && option.searchText.includes(query),
    );

    return [...starts, ...contains].slice(0, 150);
  }, [cityQuery]);

  useEffect(() => {
    const loadCityData = async () => {
      if (!selectedCity) {
        setYearlyMetrics([]);
        setMonthlyAqi([]);
        setError('');
        setCurrentAqi(null);
        setUpdatedAt('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const endDate = new Date().toISOString().slice(0, 10);
        const [live, historical] = await Promise.all([
          fetchCurrentAirQuality(selectedCity.lat, selectedCity.lon),
          fetchHistoricalAirQuality(selectedCity.lat, selectedCity.lon, '2020-01-01', endDate),
        ]);

        setCurrentAqi(live.aqi);
        setUpdatedAt(live.updatedAt);

        const yearly = aggregateYearlyMetrics(
          historical.time,
          historical.aqi,
          historical.pm25,
          historical.no2,
          historical.co,
        );

        const monthly = aggregateMonthlyAqi(historical.time, historical.aqi);
        setYearlyMetrics(yearly);
        setMonthlyAqi(monthly);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load prediction data.';
        setError(`${message} Please retry after checking network access.`);
      } finally {
        setLoading(false);
      }
    };

    loadCityData();
  }, [selectedCity]);

  const metrics = useMemo(() => {
    if (!yearlyMetrics.length) return null;
    return getPredictedMetrics(yearlyMetrics, year);
  }, [yearlyMetrics, year]);

  const score = useMemo(() => {
    if (!metrics) return 0;
    return computeSustainabilityScore(metrics.aqi, metrics.pm25, metrics.no2, metrics.co);
  }, [metrics]);

  const status = getScoreStatus(score);

  const co2 = useMemo(() => {
    if (!yearlyMetrics.length) return null;
    return buildCoTrendData(yearlyMetrics, year);
  }, [yearlyMetrics, year]);

  const aqi = useMemo(() => {
    if (!monthlyAqi.length) return null;
    return buildAqiData(monthlyAqi, year);
  }, [monthlyAqi, year]);

  const alerts = useMemo(() => {
    if (!selectedCityName || !metrics) return [];
    return getRiskAlerts(selectedCityName, year, metrics, currentAqi);
  }, [selectedCityName, year, metrics, currentAqi]);

  const confidence = useMemo(
    () => getForecastConfidence(yearlyMetrics, monthlyAqi),
    [yearlyMetrics, monthlyAqi],
  );

  const metricRanges = useMemo(() => {
    if (!metrics) return null;
    const uncertaintyScale = 1 - confidence.score / 100;

    const buildRange = (value: number, minSpread: number, ratio: number) => {
      const spread = Math.max(minSpread, value * ratio * uncertaintyScale);
      const lower = Math.max(0, value - spread);
      const upper = value + spread;
      return {
        lower: Math.round(lower * 10) / 10,
        upper: Math.round(upper * 10) / 10,
      };
    };

    return {
      aqi: buildRange(metrics.aqi, 6, 0.2),
      pm25: buildRange(metrics.pm25, 1.5, 0.25),
      no2: buildRange(metrics.no2, 2, 0.22),
      co: buildRange(metrics.co, 8, 0.2),
    };
  }, [metrics, confidence.score]);

  const handlePredict = () => {
    if (!selectedCityKey || !metrics || loading) return;
    setPredicted(true);
  };

  /** Colour each AQI bar by value. */
  const aqiBarColors = useMemo(() => {
    if (!aqi) return [];
    return aqi.values.map((v) => {
      if (v <= 50) return 'rgba(16, 185, 129, 0.75)';
      if (v <= 100) return 'rgba(52, 211, 153, 0.75)';
      if (v <= 150) return 'rgba(251, 191, 36, 0.75)';
      if (v <= 200) return 'rgba(249, 115, 22, 0.75)';
      if (v <= 300) return 'rgba(248, 113, 113, 0.75)';
      return 'rgba(185, 28, 28, 0.75)';
    });
  }, [aqi]);

  return (
    <div className="predictions-page">
      {/* ── Header ── */}
      <div className="predictions-header">
        <div className="header-top">
          <h1 className="predictions-title">Predictions</h1>
          <p className="header-subtitle">AI-Powered Ecological Forecasting</p>
          <button
            className="home-button"
            onClick={() => navigate('/')}
            title="Back to Home"
          >
            Home
          </button>
        </div>
        <p className="predictions-subtitle">
          Select a city and target year to generate sustainability forecasts from live and historical pollution data (Open-Meteo model outputs, 2020-present).
        </p>
        <p className="predictions-subtitle">
          Forecasts use city coordinates with state and district metadata for better location clarity. District names are locality-based labels when official district boundaries are unavailable.
        </p>
      </div>

      {/* ── Input Panel ── */}
      <div className="input-panel">
        <h2>Configure Prediction</h2>
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="city-select">City / Region</label>
            <input
              type="text"
              placeholder="Search city..."
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
            />
            <select
              id="city-select"
              value={selectedCityKey}
              onChange={(e) => {
                const key = e.target.value;
                setSelectedCityKey(key);
                const option = CITY_OPTIONS.find((entry) => entry.key === key);
                setCityQuery(option?.name ?? '');
                setPredicted(false);
              }}
            >
              <option value="">— Select a city —</option>
              {filteredCityOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <p className="city-option-count">Showing top {filteredCityOptions.length} matches of {CITY_OPTIONS.length} locations</p>
            {selectedCity && (
              <div className="selected-location-meta" role="status" aria-live="polite">
                <span className="meta-pill">State: {selectedCity.state}</span>
                <span className="meta-pill">District: {selectedCity.district}</span>
                <span className="meta-pill">Coords: {selectedCity.lat.toFixed(2)}, {selectedCity.lon.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="year-select">Target Year</label>
            <select
              id="year-select"
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPredicted(false); }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button className="predict-btn" onClick={handlePredict} disabled={!selectedCityKey || loading || !metrics}>
            {loading ? 'Loading Data...' : 'Generate Prediction'}
          </button>
        </div>
        {error && <p style={{ color: '#fca5a5', marginTop: '0.75rem' }}>{error}</p>}
        {selectedCity && updatedAt && !error && (
          <p style={{ color: '#94a3b8', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Live baseline updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Results ── */}
      {!predicted ? (
        <div className="pred-card">
          <div className="empty-predictions">
            <div className="empty-icon">🔮</div>
            <h3>No Prediction Yet</h3>
            <p>Choose a city and year above, then click <strong>Generate Prediction</strong> to see forecasted sustainability metrics.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Score Card (full width) */}
          <div className="pred-card score-card" style={{ marginBottom: '2rem' }}>
            <h3><span className="card-icon">📊</span> Sustainability Score — {selectedCityName}, {year}</h3>
            <div className="score-display">
              <div className="score-ring">
                <svg viewBox="0 0 120 120">
                  <circle className="ring-bg" cx="60" cy="60" r="50" />
                  <circle
                    className={`ring-fill ${status}`}
                    cx="60"
                    cy="60"
                    r="50"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - score / 100)}
                  />
                </svg>
                <div className="score-label">
                  <span className={`score-value ${status}`}>{score}</span>
                  <span className="score-max">/ 100</span>
                </div>
              </div>

              <div className="score-details">
                <h4>{status === 'good' ? 'Healthy Outlook' : status === 'moderate' ? 'Needs Monitoring' : 'Critical Warning'}</h4>
                <p>
                  Based on historical daily trends and live baseline data, <strong>{selectedCityName}</strong> is projected to have a
                  {status === 'good' ? ' strong' : status === 'moderate' ? ' moderate' : ' poor'} sustainability outlook by {year}.
                </p>
                <div className="score-badges">
                  <span className={`badge ${status}`}>
                    {status === 'good' ? '✓ Sustainable' : status === 'moderate' ? '⚠ Moderate Risk' : '✕ High Risk'}
                  </span>
                  <span className="badge info" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                    Year {year}
                  </span>
                  <span className={`badge confidence ${confidence.label.toLowerCase()}`}>
                    Confidence: {confidence.label} ({confidence.score}%)
                  </span>
                </div>
              </div>
            </div>
            <div className="confidence-panel">
              <p>{confidence.summary}</p>
              <div className="confidence-stats">
                <span>Years used: <strong>{confidence.years}</strong></span>
                <span>Monthly points: <strong>{confidence.monthlyPoints}</strong></span>
                <span>AQI volatility: <strong>{confidence.volatility.toFixed(1)}</strong></span>
              </div>
            </div>
          </div>

          {/* Charts + Alerts grid */}
          <div className="predictions-grid">
            {/* CO Trend Chart */}
            <div className="pred-card">
              <h3><span className="card-icon">🌫️</span> CO Concentration Trend — {selectedCityName}</h3>
              {co2 && (
                <div className="chart-container">
                  <Line
                    data={{
                      labels: co2.labels,
                      datasets: [
                        {
                          label: 'Historical',
                          data: co2.historical,
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          fill: true,
                          tension: 0.35,
                          pointRadius: 4,
                          pointBackgroundColor: '#10b981',
                          spanGaps: false,
                        },
                        {
                          label: 'Forecast',
                          data: co2.forecast,
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          borderDash: [6, 4],
                          fill: false,
                          tension: 0.35,
                          pointRadius: 4,
                          pointBackgroundColor: '#3b82f6',
                          spanGaps: false,
                        },
                        {
                          label: 'Forecast Lower Bound',
                          data: co2.forecastLower,
                          borderColor: 'rgba(59, 130, 246, 0.25)',
                          backgroundColor: 'rgba(59, 130, 246, 0.10)',
                          borderWidth: 1,
                          pointRadius: 0,
                          tension: 0.35,
                          fill: false,
                          spanGaps: false,
                        },
                        {
                          label: 'Forecast Uncertainty Band',
                          data: co2.forecastUpper,
                          borderColor: 'rgba(59, 130, 246, 0.25)',
                          backgroundColor: 'rgba(59, 130, 246, 0.14)',
                          borderWidth: 1,
                          pointRadius: 0,
                          tension: 0.35,
                          fill: '-1',
                          spanGaps: false,
                        },
                      ],
                    }}
                    options={co2ChartOptions}
                  />
                </div>
              )}
            </div>

            {/* AQI Trend Chart */}
            <div className="pred-card">
              <h3><span className="card-icon">💨</span> Monthly AQI Forecast — {selectedCityName}, {year}</h3>
              {aqi && (
                <div className="chart-container">
                  <Bar
                    data={{
                      labels: aqi.labels,
                      datasets: [
                        {
                          label: 'AQI',
                          data: aqi.values,
                          backgroundColor: aqiBarColors,
                          borderColor: aqiBarColors.map((c) => c.replace('0.75', '1')),
                          borderWidth: 1,
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={aqiChartOptions}
                  />
                </div>
              )}
            </div>

            {/* Risk Alerts */}
            <div className="pred-card">
              <h3><span className="card-icon">🚨</span> Risk Alerts — {selectedCityName}</h3>
              <div className="alert-list">
                {alerts.length === 0 ? (
                  <div className="alert-item info">
                    <span className="alert-icon">✅</span>
                    <span>No significant risks detected for {selectedCityName} in {year}.</span>
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <div key={i} className={`alert-item ${alert.type === 'danger' ? 'danger' : alert.type === 'warning' ? 'warning' : 'info'}`}>
                      <span className="alert-icon">{alert.icon}</span>
                      <span>{alert.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="pred-card">
              <h3><span className="card-icon">📋</span> Predicted Metrics — {selectedCityName}, {year}</h3>
              {metrics && (
                <div className="metrics-row">
                  <div className="metric-box">
                    <span className="metric-number">{metrics.aqi}</span>
                    <span className="metric-unit">AQI</span>
                    <span className="metric-name">Air Quality</span>
                    {metricRanges && <span className="metric-range">{metricRanges.aqi.lower} - {metricRanges.aqi.upper}</span>}
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.pm25}</span>
                    <span className="metric-unit">µg/m³</span>
                    <span className="metric-name">PM 2.5</span>
                    {metricRanges && <span className="metric-range">{metricRanges.pm25.lower} - {metricRanges.pm25.upper}</span>}
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.no2}</span>
                    <span className="metric-unit">ppb</span>
                    <span className="metric-name">NO₂</span>
                    {metricRanges && <span className="metric-range">{metricRanges.no2.lower} - {metricRanges.no2.upper}</span>}
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.co}</span>
                    <span className="metric-unit">µg/m³</span>
                    <span className="metric-name">CO</span>
                    {metricRanges && <span className="metric-range">{metricRanges.co.lower} - {metricRanges.co.upper}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Predictions;
