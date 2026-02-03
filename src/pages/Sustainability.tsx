import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import * as XLSX from 'xlsx';
import './Sustainability.css';

type LocationScore = {
  name: string;
  lat: number;
  lon: number;
  score: number;
  pm25?: number;
  pm10?: number;
  aqi?: number;
  no2?: number;
  o3?: number;
  so2?: number;
};

const DATASET_URL = '/Dataset/Dataset_AQI22-4.xlsx';
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [37.5, 97.5],
];

const getStatus = (score: number) => {
  if (score >= 70) return { label: 'Good', className: 'good', color: '#10b981' };
  if (score >= 40) return { label: 'Moderate', className: 'moderate', color: '#fbbf24' };
  return { label: 'Critical', className: 'critical', color: '#f87171' };
};

const getMarkerColor = (score: number): string => {
  // Normalize score to 0-1 range
  const normalized = Math.max(0, Math.min(100, score)) / 100;
  
  // Green gradient for high scores (70-100)
  if (normalized >= 0.7) {
    const intensity = (normalized - 0.7) / 0.3; // 0 to 1
    // Bright green #10b981 to deep green #065f46
    const colors = ['#10b981', '#059669', '#047857', '#065f46'];
    const colorIndex = Math.floor(intensity * (colors.length - 1));
    return colors[colorIndex];
  }
  // Yellow gradient for moderate scores (40-69)
  if (normalized >= 0.4) {
    const intensity = (normalized - 0.4) / 0.3; // 0 to 1
    // Bright yellow #fbbf24 to deep amber #b45309
    const colors = ['#fbbf24', '#f59e0b', '#d97706', '#b45309'];
    const colorIndex = Math.floor(intensity * (colors.length - 1));
    return colors[colorIndex];
  }
  // Red gradient for low scores (0-39)
  const intensity = normalized / 0.4; // 0 to 1
  // Bright red #ef4444 to deep red #7f1d1d
  const colors = ['#ef4444', '#dc2626', '#991b1b', '#7f1d1d'];
  const colorIndex = Math.floor(intensity * (colors.length - 1));
  return colors[colorIndex];
};

const findColumn = (columns: string[], patterns: RegExp[]) =>
  columns.find((col) => patterns.some((pattern) => pattern.test(col)));

// Component to handle map interactions and panning
const MapContent = ({ 
  selectedLocation, 
  filteredLocations,
  onLocationClick 
}: { 
  selectedLocation: LocationScore | null; 
  filteredLocations: LocationScore[];
  onLocationClick: (location: LocationScore) => void;
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (selectedLocation) {
      // Pan and zoom to selected location
      map.flyTo([selectedLocation.lat, selectedLocation.lon], 8, {
        duration: 1.5,
      });
    }
  }, [selectedLocation, map]);
  
  return (
    <>
      {filteredLocations.map((location) => {
        const status = getStatus(location.score);
        const markerColor = getMarkerColor(location.score);
        const isSelected = selectedLocation?.name === location.name && 
                          selectedLocation?.lat === location.lat && 
                          selectedLocation?.lon === location.lon;
        return (
          <CircleMarker
            key={`${location.name}-${location.lat}-${location.lon}`}
            center={[location.lat, location.lon]}
            radius={isSelected ? 12 : 8}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: isSelected ? 0.9 : 0.6,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onLocationClick(location),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <strong>{location.name}</strong>
              <div>Score: {location.score.toFixed(1)} / 100</div>
              <div>Status: {status.label}</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Click for details</div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};

const Sustainability = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationScore[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationScore | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDataset = async () => {
      try {
        const response = await fetch(DATASET_URL);
        if (!response.ok) {
          throw new Error('Dataset not found in the public folder.');
        }
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

        if (!rows.length) {
          throw new Error('Dataset is empty or could not be read.');
        }

        const columns = Object.keys(rows[0]);
        const latCol = findColumn(columns, [/lat/i, /latitude/i]);
        const lonCol = findColumn(columns, [/lon/i, /lng/i, /long/i, /longitude/i]);
        const scoreCol = findColumn(columns, [/score/i, /sustain/i, /index/i, /aqi/i]);
        // Prioritize Station name, then City, then others
        const nameCol = findColumn(columns, [/station/i]) || findColumn(columns, [/city/i, /location/i, /region/i, /district/i]);
        
        const pm25Col = findColumn(columns, [/pm2\.5|pm25|pm2_5/i]);
        const pm10Col = findColumn(columns, [/pm10|pm_10/i]);
        const aqiCol = findColumn(columns, [/^aqi$|air.*quality.*index/i]);
        const no2Col = findColumn(columns, [/no2|nitrogen/i]);
        const o3Col = findColumn(columns, [/o3|ozone/i]);
        const so2Col = findColumn(columns, [/so2|sulfur/i]);

        if (!latCol || !lonCol || !scoreCol) {
          throw new Error('Required columns (lat, lon, score) not found in dataset.');
        }

        const parsed = rows
          .map((row, index) => {
            const lat = Number(row[latCol]);
            const lon = Number(row[lonCol]);
            const score = Number(row[scoreCol]);
            const nameValue = nameCol ? String(row[nameCol]) : `Location ${index + 1}`;

            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(score)) {
              return null;
            }

            return {
              name: nameValue,
              lat,
              lon,
              score,
              pm25: pm25Col ? Number(row[pm25Col]) || undefined : undefined,
              pm10: pm10Col ? Number(row[pm10Col]) || undefined : undefined,
              aqi: aqiCol ? Number(row[aqiCol]) || undefined : undefined,
              no2: no2Col ? Number(row[no2Col]) || undefined : undefined,
              o3: o3Col ? Number(row[o3Col]) || undefined : undefined,
              so2: so2Col ? Number(row[so2Col]) || undefined : undefined,
            } satisfies LocationScore;
          })
          .filter((item): item is LocationScore => item !== null);

        if (!parsed.length) {
          throw new Error('No valid location records found in dataset.');
        }

        setLocations(parsed);
        setError('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load dataset.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadDataset();
  }, []);

  const stats = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }
    const status = getStatus(selectedLocation.score);
    return { location: selectedLocation, status };
  }, [selectedLocation]);

  const center = useMemo<[number, number]>(() => {
    if (!locations.length) {
      return [20.5937, 78.9629];
    }
    const lat = locations.reduce((sum, item) => sum + item.lat, 0) / locations.length;
    const lon = locations.reduce((sum, item) => sum + item.lon, 0) / locations.length;
    return [lat, lon];
  }, [locations]);

  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return locations;
    return locations.filter((loc) =>
      loc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  return (
    <div className="sustainability-page">
      <div className="sustainability-header">
        <div className="header-top">
          <h1 className="sustainability-title">Ecological Map</h1>
          <p className="header-subtitle">India's Sustainability Landscape</p>
          <button 
            className="home-button" 
            onClick={() => navigate('/')}
            title="Back to Home"
          >
            Home
          </button>
        </div>
        <p className="sustainability-subtitle">Explore real-time sustainability scores across India. Each marker represents a location's ecological health status.</p>
      </div>

      <div className="sustainability-grid">
        <div className="panel">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="🔍 Search location by city name..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
            {searchTerm && filteredLocations.length > 0 && (
              <div className="search-dropdown">
                {filteredLocations.slice(0, 8).map((location) => (
                  <div
                    key={`${location.name}-${location.lat}-${location.lon}`}
                    className="search-dropdown-item"
                    onClick={() => {
                      setSelectedLocation(location);
                      setSearchTerm('');
                    }}
                  >
                    <span className="item-name">{location.name}</span>
                    <span className="item-score">Score: {location.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
            {searchTerm && filteredLocations.length === 0 && (
              <div className="search-dropdown">
                <div className="search-no-results">No locations found</div>
              </div>
            )}
          </div>
          <div className="map-wrapper">
            <MapContainer
              center={center}
              zoom={5}
              minZoom={4}
              maxZoom={9}
              maxBounds={INDIA_BOUNDS}
              maxBoundsViscosity={1.0}
              className="map-container"
              zoomControl={false}
            >
              <ZoomControl position="bottomright" />
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapContent 
                selectedLocation={selectedLocation}
                filteredLocations={filteredLocations}
                onLocationClick={setSelectedLocation}
              />
            </MapContainer>
          </div>
          <div className="legend">
            <span>
              <span className="legend-dot" style={{ background: '#10b981' }} /> Good (70+)
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#fbbf24' }} /> Moderate (40-69)
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#f87171' }} /> Critical (&lt; 40)
            </span>
          </div>
          {error && (
            <div className="error">
              {error} Place the file in public/Dataset to load it in the browser.
            </div>
          )}
        </div>

        <div className="panel info-card">
          {!selectedLocation ? (
            <div className="empty-state">
              <div className="empty-icon">🗺️</div>
              <h3>Select a Location</h3>
              <p>Click on any marker on the map to view its sustainability analytics and details.</p>
            </div>
          ) : (
            <>
              <div className="selected-location-header">
                <h3 className="location-name">{selectedLocation.name}</h3>
                <button 
                  className="close-button" 
                  onClick={() => setSelectedLocation(null)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <div className="metric">
                <span className="metric-label">Sustainability Score</span>
                <span className="metric-value" style={{ fontSize: '1.5rem' }}>
                  {selectedLocation.score.toFixed(1)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Status</span>
                <span className={`status ${getStatus(selectedLocation.score).className}`}>
                  {getStatus(selectedLocation.score).label}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Coordinates</span>
                <span className="metric-value" style={{ fontSize: '0.9rem' }}>
                  {selectedLocation.lat.toFixed(2)}°, {selectedLocation.lon.toFixed(2)}°
                </span>
              </div>
              <div className="air-quality-section">
                <h4>Air Quality Metrics</h4>
                {selectedLocation.pm25 !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">PM2.5</span>
                    <span className="metric-value">{selectedLocation.pm25.toFixed(1)} µg/m³</span>
                  </div>
                )}
                {selectedLocation.pm10 !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">PM10</span>
                    <span className="metric-value">{selectedLocation.pm10.toFixed(1)} µg/m³</span>
                  </div>
                )}
                {selectedLocation.aqi !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">AQI</span>
                    <span className="metric-value">{selectedLocation.aqi.toFixed(1)}</span>
                  </div>
                )}
                {selectedLocation.no2 !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">NO₂</span>
                    <span className="metric-value">{selectedLocation.no2.toFixed(1)} ppb</span>
                  </div>
                )}
                {selectedLocation.o3 !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">O₃</span>
                    <span className="metric-value">{selectedLocation.o3.toFixed(1)} ppb</span>
                  </div>
                )}
                {selectedLocation.so2 !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">SO₂</span>
                    <span className="metric-value">{selectedLocation.so2.toFixed(1)} ppb</span>
                  </div>
                )}
              </div>
              <div className="status-breakdown">
                <h4>Status Breakdown</h4>
                {selectedLocation.score >= 70 && (
                  <p className="status-text good">✓ This location has excellent ecological health</p>
                )}
                {selectedLocation.score >= 40 && selectedLocation.score < 70 && (
                  <p className="status-text moderate">⚠ This location needs environmental monitoring</p>
                )}
                {selectedLocation.score < 40 && (
                  <p className="status-text critical">✕ This location requires immediate attention</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="info-section">
        <div className="info-grid">
          <div className="info-card">
            <h3>Air Quality Index (AQI)</h3>
            <p>The Air Quality Index is a composite measure that combines information on multiple air pollutants to provide a single number representing overall air quality. It ranges from 0-500, with higher values indicating worse air quality.</p>
            <div className="guideline">
              <strong>AQI Ranges:</strong>
              <ul>
                <li><span className="good-text">0-50</span> - Good</li>
                <li><span className="moderate-text">51-100</span> - Moderate</li>
                <li><span className="critical-text">101+</span> - Poor</li>
              </ul>
            </div>
          </div>

          <div className="info-card">
            <h3>Understanding PM2.5</h3>
            <p>PM2.5 refers to particulate matter with a diameter of 2.5 micrometers or smaller. These fine particles can penetrate deep into the lungs and bloodstream, causing serious health impacts including respiratory diseases and cardiovascular complications.</p>
            <div className="guideline">
              <strong>Safe Levels:</strong>
              <ul>
                <li><span className="good-text">0-30 µg/m³</span> - Good</li>
                <li><span className="moderate-text">31-60 µg/m³</span> - Moderate</li>
                <li><span className="critical-text">60+</span> - Poor</li>
              </ul>
            </div>
          </div>

          <div className="info-card">
            <h3>Sustainability Score Calculation</h3>
            <p>The sustainability score (0-100) is calculated based on multiple environmental factors:</p>
            <div className="calculation">
              <p><strong>Formula Components:</strong></p>
              <ul>
                <li>Air Quality Index (AQI) - 40% weight</li>
                <li>PM2.5 and PM10 levels - 30% weight</li>
                <li>Pollutant concentrations (NO₂, SO₂, O₃) - 20% weight</li>
                <li>Trend and improvements - 10% weight</li>
              </ul>
              <p className="note">Higher scores indicate better environmental health. Locations with scores above 70 are considered sustainable.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sustainability;
