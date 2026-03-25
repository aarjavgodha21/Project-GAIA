import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { fetchCurrentAirQuality, fetchEnvironmentalContext, getApiThrottleStatus, getMapCoverageCities } from '../services/airQualityService';
import type { EnvironmentalContext } from '../services/airQualityService';
import 'leaflet/dist/leaflet.css';
import './Sustainability.css';

type LocationScore = {
  name: string;
  lat: number;
  lon: number;
  state?: string;
  district?: string;
  score: number;
  pm25?: number;
  pm10?: number;
  aqi?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  co?: number;
  updatedAt?: string;
  dataSource?: 'live' | 'cache-fresh' | 'cache-stale';
  cacheAgeMinutes?: number;
};
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [37.5, 97.5],
];

const COVERAGE_CONFIG = {
  standard: { label: 'Standard', cityCount: 300, batchSize: 6, batchDelayMs: 160 },
  extended: { label: 'Extended', cityCount: 700, batchSize: 8, batchDelayMs: 240 },
  nearAll: { label: 'Near-All Cities', cityCount: 1200, batchSize: 10, batchDelayMs: 320 },
} as const;

type CoverageMode = keyof typeof COVERAGE_CONFIG;

const getMarkerRenderLimit = (zoom: number) => {
  if (zoom <= 5) return 500;
  if (zoom <= 6) return 900;
  if (zoom <= 7) return 1400;
  if (zoom <= 8) return 1900;
  return 2600;
};

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

// Component to handle map interactions and panning
const MapContent = ({ 
  selectedLocation, 
  filteredLocations,
  onLocationClick,
  onVisibleStats,
}: { 
  selectedLocation: LocationScore | null; 
  filteredLocations: LocationScore[];
  onLocationClick: (location: LocationScore) => void;
  onVisibleStats: (stats: { visibleCount: number; renderedCount: number; zoom: number }) => void;
}) => {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(map.getZoom());
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
  });
  
  useEffect(() => {
    if (selectedLocation) {
      // Pan and zoom to selected location
      map.flyTo([selectedLocation.lat, selectedLocation.lon], 8, {
        duration: 1.5,
      });
    }
  }, [selectedLocation, map]);

  const visibleLocations = useMemo(() => {
    return filteredLocations.filter((location) => bounds.contains([location.lat, location.lon]));
  }, [filteredLocations, bounds]);

  const renderedLocations = useMemo(() => {
    const renderLimit = getMarkerRenderLimit(zoom);
    if (visibleLocations.length <= renderLimit) {
      return visibleLocations;
    }

    const sampled: LocationScore[] = [];
    const step = visibleLocations.length / renderLimit;
    for (let index = 0; index < renderLimit; index += 1) {
      sampled.push(visibleLocations[Math.floor(index * step)]);
    }

    if (selectedLocation) {
      const selectedKey = `${selectedLocation.name}-${selectedLocation.lat}-${selectedLocation.lon}`;
      const hasSelected = sampled.some(
        (location) => `${location.name}-${location.lat}-${location.lon}` === selectedKey,
      );
      const isVisible = visibleLocations.some(
        (location) => `${location.name}-${location.lat}-${location.lon}` === selectedKey,
      );
      if (!hasSelected && isVisible) {
        sampled[sampled.length - 1] = selectedLocation;
      }
    }

    return sampled;
  }, [visibleLocations, zoom, selectedLocation]);

  useEffect(() => {
    onVisibleStats({
      visibleCount: visibleLocations.length,
      renderedCount: renderedLocations.length,
      zoom,
    });
  }, [visibleLocations.length, renderedLocations.length, zoom, onVisibleStats]);
  
  return (
    <>
      {renderedLocations.map((location) => {
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
              {(location.state || location.district) && (
                <div>{location.district ?? location.name}, {location.state ?? 'India'}</div>
              )}
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
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('standard');
  const coverageConfig = COVERAGE_CONFIG[coverageMode];
  const mapCities = useMemo(() => getMapCoverageCities(coverageConfig.cityCount), [coverageConfig.cityCount]);
  const prioritizedMapCities = useMemo(() => {
    const centerLat = 20.5937;
    const centerLon = 78.9629;
    return [...mapCities].sort((a, b) => {
      const distA = (a.lat - centerLat) ** 2 + (a.lon - centerLon) ** 2;
      const distB = (b.lat - centerLat) ** 2 + (b.lon - centerLon) ** 2;
      return distA - distB;
    });
  }, [mapCities]);
  const [locations, setLocations] = useState<LocationScore[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationScore | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [failedCount, setFailedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [visibleStats, setVisibleStats] = useState<{ visibleCount: number; renderedCount: number; zoom: number }>({
    visibleCount: 0,
    renderedCount: 0,
    zoom: 5,
  });
  const [selectedEnvContext, setSelectedEnvContext] = useState<EnvironmentalContext | null>(null);
  const [envLoading, setEnvLoading] = useState<boolean>(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

  useEffect(() => {
    const update = () => {
      const status = getApiThrottleStatus();
      setCooldownRemainingMs(status.remainingMs);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadLiveData = useCallback(async () => {
      setLoading(true);
      setLoadingProgress(0);
      setFailedCount(0);
      setSelectedLocation(null);
      try {
        const parsed: LocationScore[] = [];
        let failed = 0;

        for (let index = 0; index < prioritizedMapCities.length; index += coverageConfig.batchSize) {
          const batch = prioritizedMapCities.slice(index, index + coverageConfig.batchSize);
          const settled = await Promise.allSettled(
            batch.map(async (city) => {
              const live = await fetchCurrentAirQuality(city.lat, city.lon, { allowStaleCache: true });
              const loc: LocationScore = {
                name: city.name,
                lat: city.lat,
                lon: city.lon,
                state: city.state,
                district: city.district,
                score: live.sustainabilityScore,
                pm25: live.pm25,
                pm10: live.pm10,
                aqi: live.aqi,
                no2: live.no2,
                o3: live.o3,
                so2: live.so2,
                co: live.co,
                updatedAt: live.updatedAt,
                dataSource: live.dataSource,
                cacheAgeMinutes: live.cacheAgeMinutes,
              };
              return loc;
            }),
          );

          settled.forEach((item) => {
            if (item.status === 'fulfilled') {
              parsed.push(item.value);
            } else {
              failed += 1;
            }
          });

          if (parsed.length) {
            setLocations([...parsed]);
          }

          const loaded = Math.min(index + coverageConfig.batchSize, prioritizedMapCities.length);
          setLoadingProgress(Math.round((loaded / prioritizedMapCities.length) * 100));

          if (loaded < prioritizedMapCities.length) {
            await new Promise((resolve) => setTimeout(resolve, coverageConfig.batchDelayMs));
          }
        }

        if (!parsed.length) {
          throw new Error('No live location records were returned from the air-quality service.');
        }

        setLocations(parsed);
        setFailedCount(failed);
        setLastUpdatedAt(new Date().toISOString());
        setError('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load live sustainability data.';
        setError(`${message} Please check internet connectivity and try again.`);
      } finally {
        setLoadingProgress(100);
        setLoading(false);
      }
    }, [coverageConfig.batchDelayMs, coverageConfig.batchSize, prioritizedMapCities]);

  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  useEffect(() => {
    const loadSelectedEnvironmentalContext = async () => {
      if (!selectedLocation) {
        setSelectedEnvContext(null);
        return;
      }

      setEnvLoading(true);
      try {
        const context = await fetchEnvironmentalContext(selectedLocation.lat, selectedLocation.lon, { allowStaleCache: true });
        setSelectedEnvContext(context);
      } catch {
        setSelectedEnvContext(null);
      } finally {
        setEnvLoading(false);
      }
    };

    loadSelectedEnvironmentalContext();
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

  const summary = useMemo(() => {
    if (!locations.length) {
      return {
        averageScore: 0,
        good: 0,
        moderate: 0,
        critical: 0,
      };
    }

    const averageScore = locations.reduce((sum, location) => sum + location.score, 0) / locations.length;
    const good = locations.filter((location) => location.score >= 70).length;
    const moderate = locations.filter((location) => location.score >= 40 && location.score < 70).length;
    const critical = locations.length - good - moderate;

    return {
      averageScore,
      good,
      moderate,
      critical,
    };
  }, [locations]);

  const sourceSummary = useMemo(() => {
    const live = locations.filter((location) => location.dataSource === 'live').length;
    const fresh = locations.filter((location) => location.dataSource === 'cache-fresh').length;
    const stale = locations.filter((location) => location.dataSource === 'cache-stale').length;
    return { live, fresh, stale };
  }, [locations]);

  const rankingSummary = useMemo(() => {
    const aggregate = (items: Array<{ key: string; score: number }>) => {
      const map = new Map<string, { total: number; count: number }>();
      items.forEach((item) => {
        const existing = map.get(item.key) ?? { total: 0, count: 0 };
        map.set(item.key, { total: existing.total + item.score, count: existing.count + 1 });
      });

      return Array.from(map.entries())
        .map(([name, value]) => ({
          name,
          avgScore: value.total / value.count,
          count: value.count,
        }))
        .sort((a, b) => b.avgScore - a.avgScore);
    };

    const byState = aggregate(
      locations
        .filter((location) => location.state)
        .map((location) => ({ key: location.state as string, score: location.score })),
    );

    const byDistrict = aggregate(
      locations
        .filter((location) => location.district)
        .map((location) => ({ key: location.district as string, score: location.score })),
    );

    return {
      topStates: byState.slice(0, 5),
      bottomStates: [...byState].reverse().slice(0, 5),
      topDistricts: byDistrict.slice(0, 5),
    };
  }, [locations]);

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
        <p className="sustainability-subtitle">
          Live data is throttled and cache-aware to avoid API rate limits. When live calls are limited, recently cached values are shown automatically.
        </p>
        {!loading && (
          <p className="sustainability-subtitle">
            Showing {locations.length.toLocaleString()} cities across India
            {failedCount > 0 ? ` (${failedCount.toLocaleString()} temporarily unavailable)` : ''}.
          </p>
        )}
        {!loading && (
          <p className="sustainability-subtitle">
            In current view: {visibleStats.visibleCount.toLocaleString()} cities, rendering {visibleStats.renderedCount.toLocaleString()} markers at zoom {visibleStats.zoom}.
          </p>
        )}
        {!loading && locations.length > 0 && (
          <p className="sustainability-subtitle">
            India-wide average score: {summary.averageScore.toFixed(1)} · Good: {summary.good.toLocaleString()} · Moderate: {summary.moderate.toLocaleString()} · Critical: {summary.critical.toLocaleString()}
            {lastUpdatedAt ? ` · Updated: ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ''}
          </p>
        )}
        {!loading && locations.length > 0 && (
          <p className="sustainability-subtitle">
            Data quality · Live: {sourceSummary.live.toLocaleString()} · Cached (fresh): {sourceSummary.fresh.toLocaleString()} · Cached (stale): {sourceSummary.stale.toLocaleString()}
          </p>
        )}
        {cooldownRemainingMs > 0 && (
          <div className="rate-limit-banner" role="status" aria-live="polite">
            API rate limit protection is active. Refreshing requests in ~{Math.ceil(cooldownRemainingMs / 1000)}s using cached results where possible.
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
            <p className="loading-text">Loading live sustainability data... {loadingProgress}%</p>
        </div>
      )}

      <div className="sustainability-grid">
        <div className="panel">
          <div className="coverage-controls">
            <label htmlFor="coverage-mode">Coverage Mode</label>
            <select
              id="coverage-mode"
              className="coverage-select"
              value={coverageMode}
              onChange={(e) => setCoverageMode(e.target.value as CoverageMode)}
              disabled={loading}
            >
              {(Object.keys(COVERAGE_CONFIG) as CoverageMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {COVERAGE_CONFIG[mode].label} ({COVERAGE_CONFIG[mode].cityCount.toLocaleString()} target cities)
                </option>
              ))}
            </select>
            <button
              className="coverage-refresh"
              onClick={loadLiveData}
              disabled={loading}
              title="Refresh live data"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
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
                onVisibleStats={setVisibleStats}
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
              {error}
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
              {(selectedLocation.dataSource || Number.isFinite(selectedLocation.cacheAgeMinutes)) && (
                <div className="metric">
                  <span className="metric-label">Data Quality</span>
                  <span className="metric-value" style={{ fontSize: '0.9rem' }}>
                    {selectedLocation.dataSource === 'live' && 'Live'}
                    {selectedLocation.dataSource === 'cache-fresh' && 'Cached (fresh)'}
                    {selectedLocation.dataSource === 'cache-stale' && 'Cached (stale)'}
                    {selectedLocation.cacheAgeMinutes !== undefined ? ` · ${selectedLocation.cacheAgeMinutes} min old` : ''}
                  </span>
                </div>
              )}
              {(selectedLocation.state || selectedLocation.district) && (
                <>
                  <div className="metric">
                    <span className="metric-label">State</span>
                    <span className="metric-value" style={{ fontSize: '0.9rem' }}>
                      {selectedLocation.state ?? 'Unknown'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">District</span>
                    <span className="metric-value" style={{ fontSize: '0.9rem' }}>
                      {selectedLocation.district ?? selectedLocation.name}
                    </span>
                  </div>
                </>
              )}
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
                {selectedLocation.co !== undefined && (
                  <div className="metric-detail">
                    <span className="metric-label">CO</span>
                    <span className="metric-value">{selectedLocation.co.toFixed(1)} µg/m³</span>
                  </div>
                )}
                {selectedLocation.updatedAt && (
                  <div className="metric-detail">
                    <span className="metric-label">Updated</span>
                    <span className="metric-value">{new Date(selectedLocation.updatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="air-quality-section">
                <h4>Environmental Signals</h4>
                {envLoading && (
                  <div className="metric-detail">
                    <span className="metric-label">Status</span>
                    <span className="metric-value">Loading...</span>
                  </div>
                )}
                {!envLoading && selectedEnvContext && (
                  <>
                    <div className="metric-detail">
                      <span className="metric-label">Humidity</span>
                      <span className="metric-value">{selectedEnvContext.humidity.toFixed(0)}%</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Temperature</span>
                      <span className="metric-value">{selectedEnvContext.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">UV Index</span>
                      <span className="metric-value">{selectedEnvContext.uvIndex.toFixed(1)}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Wind Speed</span>
                      <span className="metric-value">{selectedEnvContext.windSpeed.toFixed(1)} km/h</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Heatwave Days (7d)</span>
                      <span className="metric-value">{selectedEnvContext.heatwaveDaysNextWeek}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Biodiversity Signal</span>
                      <span className="metric-value">{selectedEnvContext.biodiversitySignal}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Wildfire Events (30d)</span>
                      <span className="metric-value">{selectedEnvContext.wildfireEvents30d}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Deforestation Proxy</span>
                      <span className="metric-value">{selectedEnvContext.deforestationPressureProxy}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Water Quality Proxy</span>
                      <span className="metric-value">{selectedEnvContext.waterQualityProxy}</span>
                    </div>
                    <div className="metric-detail">
                      <span className="metric-label">Eco Stress Index</span>
                      <span className="metric-value">{selectedEnvContext.ecoStressIndex}</span>
                    </div>
                  </>
                )}
                {!envLoading && !selectedEnvContext && (
                  <div className="metric-detail">
                    <span className="metric-label">Status</span>
                    <span className="metric-value">Unavailable</span>
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
            <h3>State & District Rankings</h3>
            <p>Average sustainability score rankings based on currently loaded locations.</p>
            <div className="guideline">
              <strong>Top States</strong>
              <ul>
                {rankingSummary.topStates.map((item) => (
                  <li key={`state-top-${item.name}`}>{item.name}: {item.avgScore.toFixed(1)} ({item.count} cities)</li>
                ))}
              </ul>
            </div>
            <div className="guideline">
              <strong>Bottom States</strong>
              <ul>
                {rankingSummary.bottomStates.map((item) => (
                  <li key={`state-bottom-${item.name}`}>{item.name}: {item.avgScore.toFixed(1)} ({item.count} cities)</li>
                ))}
              </ul>
            </div>
            <div className="guideline">
              <strong>Top District Labels</strong>
              <ul>
                {rankingSummary.topDistricts.map((item) => (
                  <li key={`district-top-${item.name}`}>{item.name}: {item.avgScore.toFixed(1)} ({item.count} cities)</li>
                ))}
              </ul>
            </div>
          </div>

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
                <li>US AQI (Open-Meteo) - 45% weight</li>
                <li>PM2.5 concentration - 30% weight</li>
                <li>NO₂ concentration - 15% weight</li>
                <li>CO concentration - 10% weight</li>
              </ul>
              <p className="note">Primary score uses live air-quality factors above. Predictions additionally include real-time humidity, temperature, precipitation, UV, wind, heatwave, biodiversity signal, and wildfire activity.</p>
            </div>
          </div>

          <div className="info-card">
            <h3>Integrated Environmental Functions</h3>
            <p>Both Sustainability and Predictions now run with the same multi-factor ecosystem context.</p>
            <div className="calculation">
              <p><strong>Live no-key sources currently connected:</strong></p>
              <ul>
                <li>Open-Meteo: air quality + weather (humidity, temperature, precipitation, UV, wind)</li>
                <li>NASA EONET: wildfire events (30-day local activity)</li>
                <li>GBIF: biodiversity occurrence signal</li>
              </ul>
              <p className="note">Deforestation and water-quality are currently modeled as real-time proxies derived from wildfire and climate stress. Source quality is surfaced in the diagnostics panel.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sustainability;
