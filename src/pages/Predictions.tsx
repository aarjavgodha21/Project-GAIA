import { useMemo, useState } from 'react';
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

/* ───────────────────────── City Data ───────────────────────── */

type CityData = {
  /** Sustainability score (0-100) */
  baseScore: number;
  /** Annual score trend per year (added/subtracted per year offset) */
  scoreTrend: number;
  /** Historical CO₂ emissions in Mt for years 2018-2023 */
  co2History: number[];
  /** CO₂ growth rate per year */
  co2Growth: number;
  /** Historical monthly AQI (Jan-Dec) for the base year */
  aqiMonthly: number[];
  /** AQI trend multiplier per year offset */
  aqiTrend: number;
  /** Base metrics: AQI, PM2.5, NO₂, CO₂ */
  metrics: { aqi: number; pm25: number; no2: number; co2: number };
  /** Risk profile */
  risks: { pm25Winter: boolean; aqiUnhealthy: boolean; greenCover: boolean; waterStress: boolean; heatIsland: boolean };
};

const CITY_DATA: Record<string, CityData> = {
  Delhi: {
    baseScore: 32,
    scoreTrend: -1.2,
    co2History: [38.1, 39.4, 37.2, 38.8, 40.5, 41.2],
    co2Growth: 1.1,
    aqiMonthly: [285, 240, 195, 160, 145, 120, 95, 105, 135, 210, 350, 380],
    aqiTrend: 1.03,
    metrics: { aqi: 268, pm25: 118.5, no2: 52.3, co2: 41.2 },
    risks: { pm25Winter: true, aqiUnhealthy: true, greenCover: true, waterStress: true, heatIsland: true },
  },
  Mumbai: {
    baseScore: 48,
    scoreTrend: -0.6,
    co2History: [28.3, 29.1, 27.8, 28.9, 30.2, 30.8],
    co2Growth: 0.8,
    aqiMonthly: [145, 130, 120, 105, 95, 80, 72, 78, 100, 140, 175, 165],
    aqiTrend: 1.01,
    metrics: { aqi: 148, pm25: 62.4, no2: 34.1, co2: 30.8 },
    risks: { pm25Winter: true, aqiUnhealthy: false, greenCover: true, waterStress: false, heatIsland: true },
  },
  Bangalore: {
    baseScore: 65,
    scoreTrend: -0.8,
    co2History: [15.2, 15.8, 15.1, 16.0, 16.8, 17.3],
    co2Growth: 0.6,
    aqiMonthly: [95, 88, 82, 75, 70, 60, 55, 58, 72, 90, 110, 105],
    aqiTrend: 1.02,
    metrics: { aqi: 89, pm25: 38.2, no2: 24.7, co2: 17.3 },
    risks: { pm25Winter: false, aqiUnhealthy: false, greenCover: true, waterStress: true, heatIsland: true },
  },
  Chennai: {
    baseScore: 55,
    scoreTrend: -0.4,
    co2History: [18.5, 19.0, 18.2, 19.3, 20.1, 20.5],
    co2Growth: 0.5,
    aqiMonthly: [110, 100, 92, 85, 80, 68, 62, 65, 82, 105, 130, 125],
    aqiTrend: 1.01,
    metrics: { aqi: 102, pm25: 44.8, no2: 28.3, co2: 20.5 },
    risks: { pm25Winter: false, aqiUnhealthy: false, greenCover: false, waterStress: true, heatIsland: true },
  },
  Kolkata: {
    baseScore: 40,
    scoreTrend: -0.9,
    co2History: [24.6, 25.3, 24.0, 25.5, 26.8, 27.4],
    co2Growth: 0.9,
    aqiMonthly: [195, 170, 148, 125, 110, 88, 75, 82, 115, 165, 240, 225],
    aqiTrend: 1.02,
    metrics: { aqi: 185, pm25: 82.5, no2: 41.6, co2: 27.4 },
    risks: { pm25Winter: true, aqiUnhealthy: true, greenCover: true, waterStress: false, heatIsland: true },
  },
  Hyderabad: {
    baseScore: 58,
    scoreTrend: -0.5,
    co2History: [16.8, 17.2, 16.5, 17.5, 18.3, 18.8],
    co2Growth: 0.55,
    aqiMonthly: [105, 95, 88, 78, 72, 62, 55, 60, 75, 98, 125, 118],
    aqiTrend: 1.015,
    metrics: { aqi: 95, pm25: 40.5, no2: 26.8, co2: 18.8 },
    risks: { pm25Winter: false, aqiUnhealthy: false, greenCover: true, waterStress: true, heatIsland: false },
  },
  Pune: {
    baseScore: 62,
    scoreTrend: -0.3,
    co2History: [12.4, 12.8, 12.2, 13.0, 13.5, 13.9],
    co2Growth: 0.45,
    aqiMonthly: [88, 80, 75, 68, 62, 52, 48, 50, 65, 82, 100, 95],
    aqiTrend: 1.01,
    metrics: { aqi: 78, pm25: 33.8, no2: 22.5, co2: 13.9 },
    risks: { pm25Winter: false, aqiUnhealthy: false, greenCover: false, waterStress: false, heatIsland: true },
  },
  Ahmedabad: {
    baseScore: 44,
    scoreTrend: -0.7,
    co2History: [22.1, 22.8, 21.9, 23.0, 24.2, 24.8],
    co2Growth: 0.85,
    aqiMonthly: [165, 148, 132, 115, 100, 82, 70, 78, 108, 150, 195, 185],
    aqiTrend: 1.02,
    metrics: { aqi: 158, pm25: 70.2, no2: 38.4, co2: 24.8 },
    risks: { pm25Winter: true, aqiUnhealthy: true, greenCover: true, waterStress: true, heatIsland: true },
  },
  Jaipur: {
    baseScore: 46,
    scoreTrend: -0.6,
    co2History: [14.5, 15.0, 14.3, 15.2, 16.0, 16.4],
    co2Growth: 0.6,
    aqiMonthly: [155, 138, 122, 108, 95, 78, 68, 75, 102, 142, 185, 172],
    aqiTrend: 1.02,
    metrics: { aqi: 145, pm25: 65.8, no2: 35.2, co2: 16.4 },
    risks: { pm25Winter: true, aqiUnhealthy: false, greenCover: true, waterStress: true, heatIsland: true },
  },
  Lucknow: {
    baseScore: 38,
    scoreTrend: -1.0,
    co2History: [17.8, 18.4, 17.5, 18.6, 19.5, 20.0],
    co2Growth: 0.75,
    aqiMonthly: [225, 195, 165, 138, 120, 95, 82, 90, 125, 180, 275, 258],
    aqiTrend: 1.025,
    metrics: { aqi: 210, pm25: 95.4, no2: 45.8, co2: 20.0 },
    risks: { pm25Winter: true, aqiUnhealthy: true, greenCover: true, waterStress: false, heatIsland: true },
  },
  Patna: {
    baseScore: 35,
    scoreTrend: -1.1,
    co2History: [13.2, 13.8, 13.0, 14.0, 14.8, 15.3],
    co2Growth: 0.7,
    aqiMonthly: [245, 210, 178, 148, 128, 100, 85, 95, 138, 195, 295, 275],
    aqiTrend: 1.03,
    metrics: { aqi: 232, pm25: 105.2, no2: 48.5, co2: 15.3 },
    risks: { pm25Winter: true, aqiUnhealthy: true, greenCover: true, waterStress: false, heatIsland: false },
  },
  Chandigarh: {
    baseScore: 68,
    scoreTrend: -0.2,
    co2History: [5.8, 5.9, 5.6, 6.0, 6.2, 6.3],
    co2Growth: 0.2,
    aqiMonthly: [120, 105, 90, 78, 68, 55, 48, 52, 72, 100, 145, 135],
    aqiTrend: 1.01,
    metrics: { aqi: 82, pm25: 35.5, no2: 20.8, co2: 6.3 },
    risks: { pm25Winter: true, aqiUnhealthy: false, greenCover: false, waterStress: false, heatIsland: false },
  },
  Bhopal: {
    baseScore: 52,
    scoreTrend: -0.5,
    co2History: [10.5, 10.8, 10.3, 11.0, 11.5, 11.8],
    co2Growth: 0.4,
    aqiMonthly: [135, 120, 108, 92, 82, 68, 58, 64, 88, 125, 160, 150],
    aqiTrend: 1.015,
    metrics: { aqi: 115, pm25: 50.2, no2: 30.5, co2: 11.8 },
    risks: { pm25Winter: true, aqiUnhealthy: false, greenCover: false, waterStress: false, heatIsland: false },
  },
  Visakhapatnam: {
    baseScore: 60,
    scoreTrend: -0.3,
    co2History: [11.2, 11.5, 11.0, 11.8, 12.2, 12.5],
    co2Growth: 0.35,
    aqiMonthly: [92, 85, 78, 70, 65, 55, 48, 52, 68, 88, 108, 100],
    aqiTrend: 1.01,
    metrics: { aqi: 82, pm25: 35.0, no2: 22.8, co2: 12.5 },
    risks: { pm25Winter: false, aqiUnhealthy: false, greenCover: false, waterStress: false, heatIsland: false },
  },
  Nagpur: {
    baseScore: 50,
    scoreTrend: -0.5,
    co2History: [12.8, 13.2, 12.6, 13.4, 14.0, 14.4],
    co2Growth: 0.5,
    aqiMonthly: [128, 115, 102, 88, 78, 65, 55, 60, 82, 118, 150, 142],
    aqiTrend: 1.015,
    metrics: { aqi: 108, pm25: 48.5, no2: 32.0, co2: 14.4 },
    risks: { pm25Winter: true, aqiUnhealthy: false, greenCover: true, waterStress: false, heatIsland: false },
  },
};

const CITIES = Object.keys(CITY_DATA);
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CO2_HISTORY_YEARS = [2018, 2019, 2020, 2021, 2022, 2023];

const getScoreStatus = (score: number) => {
  if (score >= 70) return 'good';
  if (score >= 40) return 'moderate';
  return 'critical';
};

/* ───────── Prediction helpers ───────── */

/** Compute a city's predicted score for a given target year. */
const getPredictedScore = (cityName: string, targetYear: number): number => {
  const d = CITY_DATA[cityName];
  if (!d) return 50;
  const offset = targetYear - 2023; // base year is 2023
  const raw = d.baseScore + d.scoreTrend * offset;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
};

/** Build CO₂ line-chart data: historical 2018-2023 + forecast up to targetYear. */
const buildCo2Data = (cityName: string, targetYear: number) => {
  const d = CITY_DATA[cityName];
  if (!d) return { labels: [] as string[], historical: [] as number[], forecast: [] as (number | null)[] };

  const forecastYears: number[] = [];
  for (let y = 2024; y <= targetYear; y++) forecastYears.push(y);

  const labels = [...CO2_HISTORY_YEARS.map(String), ...forecastYears.map(String)];
  const lastCo2 = d.co2History[d.co2History.length - 1];

  const forecastValues = forecastYears.map((_, i) => {
    const val = lastCo2 + d.co2Growth * (i + 1);
    return Math.round(val * 10) / 10;
  });

  // Historical line has values for history years, null for forecast years
  const historical = [...d.co2History, ...forecastYears.map(() => null as number | null)];
  // Forecast line starts from last historical point
  const forecast = [
    ...CO2_HISTORY_YEARS.slice(0, -1).map(() => null as number | null),
    lastCo2,
    ...forecastValues,
  ];

  return { labels, historical, forecast };
};

/** Build monthly AQI bar-chart data for a given target year. */
const buildAqiData = (cityName: string, targetYear: number) => {
  const d = CITY_DATA[cityName];
  if (!d) return { labels: MONTHS, values: new Array(12).fill(0) };

  const offset = targetYear - 2023;
  const multiplier = Math.pow(d.aqiTrend, offset);
  const values = d.aqiMonthly.map((v) => Math.round(v * multiplier));

  return { labels: MONTHS, values };
};

/** Get predicted metrics adjusted for year offset. */
const getPredictedMetrics = (cityName: string, targetYear: number) => {
  const d = CITY_DATA[cityName];
  if (!d) return { aqi: 0, pm25: 0, no2: 0, co2: 0 };

  const offset = targetYear - 2023;
  const aqiMult = Math.pow(d.aqiTrend, offset);
  return {
    aqi: Math.round(d.metrics.aqi * aqiMult),
    pm25: Math.round(d.metrics.pm25 * aqiMult * 10) / 10,
    no2: Math.round(d.metrics.no2 * aqiMult * 10) / 10,
    co2: Math.round((d.metrics.co2 + d.co2Growth * offset) * 10) / 10,
  };
};

/** Generate dynamic risk alerts. */
const getRiskAlerts = (cityName: string, targetYear: number) => {
  const d = CITY_DATA[cityName];
  if (!d) return [];

  const alerts: { type: 'warning' | 'danger' | 'info'; icon: string; text: string }[] = [];
  const metrics = getPredictedMetrics(cityName, targetYear);

  if (d.risks.pm25Winter) {
    alerts.push({ type: 'warning', icon: '⚠️', text: `PM2.5 levels projected to reach ${Math.round(metrics.pm25 * 1.6)} µg/m³ during winter months, exceeding safe limits.` });
  }
  if (d.risks.aqiUnhealthy || metrics.aqi > 150) {
    alerts.push({ type: 'danger', icon: '🔴', text: `AQI may reach "Unhealthy" category (${metrics.aqi > 150 ? metrics.aqi : '>150'}) by Q4 ${targetYear}.` });
  }
  if (d.risks.waterStress) {
    alerts.push({ type: 'warning', icon: '💧', text: `${cityName} faces water stress — groundwater depletion trends indicate risk by ${targetYear}.` });
  }
  if (d.risks.heatIsland) {
    alerts.push({ type: 'warning', icon: '🌡️', text: `Urban heat island effect is intensifying. Summer temperatures may rise 1.5-2°C above rural areas.` });
  }
  if (d.risks.greenCover) {
    alerts.push({ type: 'info', icon: 'ℹ️', text: `Green cover initiatives could improve ${cityName}'s score by an estimated 8-12 points.` });
  }
  if (!d.risks.aqiUnhealthy && metrics.aqi <= 100) {
    alerts.push({ type: 'info', icon: '✅', text: `${cityName} is maintaining relatively good air quality. Continued monitoring recommended.` });
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
          ctx.parsed.y != null ? `${ctx.dataset.label}: ${ctx.parsed.y} Mt` : '',
      },
    },
  },
  scales: {
    x: { grid: { color: chartGridColor }, ticks: { color: chartTickColor } },
    y: {
      grid: { color: chartGridColor },
      ticks: { color: chartTickColor, callback: (v: string | number) => `${v} Mt` },
      title: { display: true, text: 'CO₂ (Mt)', color: chartTickColor },
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
  const [city, setCity] = useState('');
  const [year, setYear] = useState<number>(2026);
  const [predicted, setPredicted] = useState(false);

  const score = useMemo(() => (city ? getPredictedScore(city, year) : 0), [city, year]);
  const status = getScoreStatus(score);

  const co2 = useMemo(() => (city ? buildCo2Data(city, year) : null), [city, year]);
  const aqi = useMemo(() => (city ? buildAqiData(city, year) : null), [city, year]);
  const metrics = useMemo(() => (city ? getPredictedMetrics(city, year) : null), [city, year]);
  const alerts = useMemo(() => (city ? getRiskAlerts(city, year) : []), [city, year]);

  const handlePredict = () => {
    if (!city) return;
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
          Select a city and target year to generate sustainability predictions powered by machine learning models trained on historical air-quality data.
        </p>
      </div>

      {/* ── Input Panel ── */}
      <div className="input-panel">
        <h2>Configure Prediction</h2>
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="city-select">City / Region</label>
            <select
              id="city-select"
              value={city}
              onChange={(e) => { setCity(e.target.value); setPredicted(false); }}
            >
              <option value="">— Select a city —</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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

          <button className="predict-btn" onClick={handlePredict} disabled={!city}>
            Generate Prediction
          </button>
        </div>
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
            <h3><span className="card-icon">📊</span> Sustainability Score — {city}, {year}</h3>
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
                  Based on historical trends, <strong>{city}</strong> is projected to have a
                  {status === 'good' ? ' strong' : status === 'moderate' ? ' moderate' : ' poor'} sustainability outlook by {year}.
                </p>
                <div className="score-badges">
                  <span className={`badge ${status}`}>
                    {status === 'good' ? '✓ Sustainable' : status === 'moderate' ? '⚠ Moderate Risk' : '✕ High Risk'}
                  </span>
                  <span className="badge info" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                    Year {year}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts + Alerts grid */}
          <div className="predictions-grid">
            {/* CO₂ Trend Chart */}
            <div className="pred-card">
              <h3><span className="card-icon">🌫️</span> CO₂ Emission Trend — {city}</h3>
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
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          borderDash: [6, 4],
                          fill: true,
                          tension: 0.35,
                          pointRadius: 4,
                          pointBackgroundColor: '#3b82f6',
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
              <h3><span className="card-icon">💨</span> Monthly AQI Forecast — {city}, {year}</h3>
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
              <h3><span className="card-icon">🚨</span> Risk Alerts — {city}</h3>
              <div className="alert-list">
                {alerts.length === 0 ? (
                  <div className="alert-item info">
                    <span className="alert-icon">✅</span>
                    <span>No significant risks detected for {city} in {year}.</span>
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
              <h3><span className="card-icon">📋</span> Predicted Metrics — {city}, {year}</h3>
              {metrics && (
                <div className="metrics-row">
                  <div className="metric-box">
                    <span className="metric-number">{metrics.aqi}</span>
                    <span className="metric-unit">AQI</span>
                    <span className="metric-name">Air Quality</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.pm25}</span>
                    <span className="metric-unit">µg/m³</span>
                    <span className="metric-name">PM 2.5</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.no2}</span>
                    <span className="metric-unit">ppb</span>
                    <span className="metric-name">NO₂</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-number">{metrics.co2}</span>
                    <span className="metric-unit">Mt</span>
                    <span className="metric-name">CO₂</span>
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
