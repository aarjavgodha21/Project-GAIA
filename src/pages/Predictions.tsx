import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Predictions.css';

const CITIES = [
  'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata',
  'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Patna', 'Chandigarh', 'Bhopal', 'Visakhapatnam', 'Nagpur',
];

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const getScoreStatus = (score: number) => {
  if (score >= 70) return 'good';
  if (score >= 40) return 'moderate';
  return 'critical';
};

const Predictions = () => {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [year, setYear] = useState<number>(2026);
  const [predicted, setPredicted] = useState(false);

  // Placeholder predicted values (will be replaced with ML model later)
  const score = 62;
  const status = getScoreStatus(score);

  const handlePredict = () => {
    if (!city) return;
    setPredicted(true);
  };

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
              <h3><span className="card-icon">🌫️</span> CO₂ Emission Trend</h3>
              <div className="chart-placeholder">
                <span className="placeholder-icon">📈</span>
                <span>Chart will render here</span>
                <span style={{ fontSize: '0.78rem' }}>Integration with Chart.js coming soon</span>
              </div>
            </div>

            {/* AQI Trend Chart */}
            <div className="pred-card">
              <h3><span className="card-icon">💨</span> AQI Forecast</h3>
              <div className="chart-placeholder">
                <span className="placeholder-icon">📉</span>
                <span>Chart will render here</span>
                <span style={{ fontSize: '0.78rem' }}>Integration with Chart.js coming soon</span>
              </div>
            </div>

            {/* Risk Alerts */}
            <div className="pred-card">
              <h3><span className="card-icon">🚨</span> Risk Alerts</h3>
              <div className="alert-list">
                <div className="alert-item warning">
                  <span className="alert-icon">⚠️</span>
                  <span>PM2.5 levels projected to exceed safe limits during winter months.</span>
                </div>
                <div className="alert-item danger">
                  <span className="alert-icon">🔴</span>
                  <span>AQI may reach "Unhealthy" category (&gt;150) by Q4 {year}.</span>
                </div>
                <div className="alert-item info">
                  <span className="alert-icon">ℹ️</span>
                  <span>Green cover initiatives could improve score by an estimated 8-12 points.</span>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="pred-card">
              <h3><span className="card-icon">📋</span> Predicted Metrics</h3>
              <div className="metrics-row">
                <div className="metric-box">
                  <span className="metric-number">148</span>
                  <span className="metric-unit">AQI</span>
                  <span className="metric-name">Air Quality</span>
                </div>
                <div className="metric-box">
                  <span className="metric-number">62.4</span>
                  <span className="metric-unit">µg/m³</span>
                  <span className="metric-name">PM 2.5</span>
                </div>
                <div className="metric-box">
                  <span className="metric-number">34.1</span>
                  <span className="metric-unit">ppb</span>
                  <span className="metric-name">NO₂</span>
                </div>
                <div className="metric-box">
                  <span className="metric-number">5.2</span>
                  <span className="metric-unit">Mt</span>
                  <span className="metric-name">CO₂</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Predictions;
