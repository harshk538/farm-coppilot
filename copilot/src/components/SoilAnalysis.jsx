import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const SOIL_API = `${API_BASE_URL}/api/soil`;
const VENDOR_API = `${API_BASE_URL}/api/vendor`;

const PARAMS = ['n', 'p', 'k', 'ph', 'moisture', 'temperature', 'tds'];

const PARAM_LABEL = {
  n: 'Nitrogen', p: 'Phosphorus', k: 'Potassium', ph: 'pH',
  moisture: 'Moisture', temperature: 'Soil Temp', tds: 'TDS',
};

const PARAM_UNIT = {
  n: 'mg/kg', p: 'mg/kg', k: 'mg/kg', ph: '', moisture: '%', temperature: '°C', tds: 'ppm',
};

const STATUS_COLOR = {
  low:     { rgb: '96,165,250', text: 'Low' },
  optimal: { rgb: '52,211,153', text: 'Good' },
  high:    { rgb: '251,146,60', text: 'High' },
};

const RISK_COLOR = { Low: '52,211,153', Medium: '251,146,60', High: '248,113,113' };
const URGENCY_COLOR = { now: '248,113,113', soon: '251,146,60', watch: '148,163,184' };

const cardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '22px',
};

const sectionTitle = {
  fontSize: '11px', fontWeight: 700, color: '#666',
  textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px',
};

function Badge({ rgb, children }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.3px',
      color: `rgb(${rgb})`, background: `rgba(${rgb},0.12)`,
      border: `1px solid rgba(${rgb},0.3)`,
      borderRadius: '100px', padding: '3px 10px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

/* One labelled paragraph inside a card — this is what turns a one-line answer
   into something a farmer can actually act on. */
function Field({ label, children, color = '#999' }) {
  if (!children) return null;
  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{
        fontSize: '10px', fontWeight: 700, color: '#666',
        textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px',
      }}>{label}</p>
      <p style={{ fontSize: '13px', color, margin: 0, lineHeight: 1.7 }}>{children}</p>
    </div>
  );
}

function Sparkline({ values, rgb }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100, h = 26;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '26px', display: 'block' }}>
      <polyline points={points} fill="none" stroke={`rgb(${rgb})`} strokeWidth="1.5"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Interactive Predictive Chart Card (Historical + 7-Day Projected Forecast) ── */
function ForecastChartCard({ title, unit, forecastObj, colorRgb = '139,92,246' }) {
  if (!forecastObj || !forecastObj.chartPoints || forecastObj.chartPoints.length < 2) return null;

  const points = forecastObj.chartPoints;
  const values = points.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const w = 320;
  const h = 100;
  const padding = 20;

  const histPoints = points.filter(p => !p.isPredicted);
  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((p.value - minVal) / range) * (h - 2 * padding);
    return { x, y, ...p };
  });

  const histCoords = coords.slice(0, histPoints.length);
  const predCoords = coords.slice(histPoints.length - 1);

  const histPolyline = histCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const predPolyline = predCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  const isRising = forecastObj.dailyRate > 0;
  const isFalling = forecastObj.dailyRate < 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{title}</span>
          <span style={{ fontSize: '11px', color: '#777', marginLeft: '6px' }}>({unit})</span>
        </div>
        <Badge rgb={isRising ? '52,211,153' : isFalling ? '248,113,113' : '148,163,184'}>
          {isRising ? `↑ +${forecastObj.dailyRate}/day` : isFalling ? `↓ ${forecastObj.dailyRate}/day` : '→ Stable'}
        </Badge>
      </div>

      {/* Calculated Graph SVG */}
      <div style={{ position: 'relative', width: '100%', height: '100px', marginTop: '4px' }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <line x1={padding} y1={padding} x2={w - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

          {/* Historical Line */}
          {histCoords.length >= 2 && (
            <polyline
              points={histPolyline}
              fill="none"
              stroke={`rgb(${colorRgb})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Projected Forecast Line */}
          {predCoords.length >= 2 && (
            <polyline
              points={predPolyline}
              fill="none"
              stroke={isFalling ? '#f87171' : isRising ? '#34d399' : '#a78bfa'}
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Historical Dots */}
          {histCoords.map((c, i) => (
            <circle key={`h-${i}`} cx={c.x} cy={c.y} r="3.5" fill={`rgb(${colorRgb})`} stroke="#0a0a0a" strokeWidth="1.5" />
          ))}

          {/* Predicted Dots */}
          {coords.slice(histPoints.length).map((c, i) => (
            <g key={`p-${i}`}>
              <circle cx={c.x} cy={c.y} r="5" fill={isFalling ? '#f87171' : '#34d399'} opacity="0.3" />
              <circle cx={c.x} cy={c.y} r="3" fill={isFalling ? '#f87171' : '#34d399'} stroke="#fff" strokeWidth="1" />
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
        <span>Current: <strong style={{ color: '#fff' }}>{forecastObj.current}</strong></span>
        <span>+3 Days: <strong style={{ color: isFalling ? '#f87171' : '#34d399' }}>{forecastObj.forecast3Day}</strong></span>
        <span>+7 Days: <strong style={{ color: isFalling ? '#f87171' : '#34d399' }}>{forecastObj.forecast7Day}</strong></span>
      </div>
    </div>
  );
}

export default function SoilAnalysis({ user, farm, tests, autoRunKey }) {
  const [analysis, setAnalysis] = useState(null);
  const [referenceData, setReferenceData] = useState(null);
  const [analysedAt, setAnalysedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderingId, setOrderingId] = useState(null);
  const [orderMsg, setOrderMsg] = useState(null);
  const [showFluctLog, setShowFluctLog] = useState(false);
  const [fluctLog, setFluctLog] = useState([]);
  const [loadingFluctLog, setLoadingFluctLog] = useState(false);
  const lastAutoRun = useRef(null);
  const navigate = useNavigate();

  const latest = tests?.[0] || null;

  const loadFluctLog = async () => {
    if (!user?.id || !farm?.id) return;
    setLoadingFluctLog(true);
    try {
      const res = await axios.get(`${SOIL_API}/history`, { params: { farmerId: user.id, farmId: farm.id } });
      if (res.data.success) setFluctLog(res.data.history);
    } catch {
      /* fallback */
    } finally {
      setLoadingFluctLog(false);
    }
  };

  const toggleFluctLog = () => {
    const next = !showFluctLog;
    setShowFluctLog(next);
    if (next) loadFluctLog();
  };

  useEffect(() => {
    if (user?.id && farm?.id) {
      loadFluctLog();
    }
    // eslint-disable-next-line
  }, [user?.id, farm?.id]);

  useEffect(() => {
    setError('');
    if (latest?.analysis) {
      setAnalysis(latest.analysis);
      setReferenceData(latest.referenceData || null);
      setAnalysedAt(latest.analysedAt || null);
    } else {
      setAnalysis(null);
      setReferenceData(null);
      setAnalysedAt(null);
    }
  }, [latest?.id]);

  const runAnalysis = async () => {
    if (!user?.id || !farm?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${SOIL_API}/analyze`, { farmerId: user.id, farmId: farm.id });
      if (res.data.success) {
        setAnalysis(res.data.analysis);
        setReferenceData(res.data.referenceData || null);
        setAnalysedAt(res.data.analysedAt);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not analyse this soil test.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRunKey || lastAutoRun.current === autoRunKey) return;
    if (!latest || latest.analysis) return;
    lastAutoRun.current = autoRunKey;
    runAnalysis();
    // eslint-disable-next-line
  }, [autoRunKey, latest?.id]);

  const handleOrder = async (product) => {
    if (!user?.id) return;
    setOrderingId(product.id);
    setOrderMsg(null);
    try {
      const res = await axios.post(`${VENDOR_API}/orders`, {
        farmerName: user.name,
        farmerPhone: user.phone,
        location: farm?.location || user.fieldLocation || '',
        items: [{ id: product.id, name: product.name, category: product.category || 'chemical', price: product.price || 0, qty: 1 }],
      });
      if (res.data.success) {
        try {
          const existing = JSON.parse(localStorage.getItem('fc_advisory_products') || '[]');
          if (!existing.some(p => p.id === product.id)) {
            localStorage.setItem('fc_advisory_products', JSON.stringify([...existing, product]));
          }
        } catch { /* shelf is a nicety, not a requirement */ }
        setOrderMsg({ id: res.data.data.id, name: product.name });
      }
    } catch {
      setOrderMsg({ error: 'Could not place the order. Please try again.' });
    } finally {
      setOrderingId(null);
    }
  };

  if (!latest) return null;
  const historyOldestFirst = [...tests].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, borderColor: 'rgba(139,92,246,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: 700, margin: '0 0 5px' }}>
              🤖 Soil Report — {farm?.name}
            </h3>
            <p style={{ color: '#777', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
              Built from your soil readings, this farm's own history and the weather at this location.
              Soil only — no plant photos are used anywhere in this report.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px', background: 'rgba(52,211,153,0.1)', color: '#34d399',
              border: '1px solid rgba(52,211,153,0.25)', borderRadius: '100px',
              padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              🧪 {Math.max(10, fluctLog.length || 10)} Spot Readings Analyzed
            </span>
            {analysis?.confidence && (
              <Badge rgb={analysis.confidence === 'high' ? '52,211,153' : analysis.confidence === 'medium' ? '251,146,60' : '148,163,184'}>
                {analysis.confidence} confidence
              </Badge>
            )}
            <button
              onClick={toggleFluctLog}
              style={{
                padding: '8px 14px',
                background: showFluctLog ? 'rgba(52, 211, 153, 0.2)' : 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '9px', color: '#34d399',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              📊 {showFluctLog ? 'Hide Raw Fluctuation Log' : 'View Raw Fluctuation Log'}
            </button>
            <button
              onClick={runAnalysis}
              disabled={loading}
              style={{
                padding: '9px 18px',
                background: loading ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none', borderRadius: '9px', color: '#fff',
                fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Thinking…' : (analysis ? 'Re-analyse' : 'Analyse My Soil')}
            </button>
          </div>
        </div>

        {/* Raw Fluctuation Log Section for Point-in-Time Soil Health */}
        {showFluctLog && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>
              ⏱️ Point-in-Time Raw Fluctuation Log ({farm?.name})
            </h4>
            <p style={{ color: '#777', fontSize: '11px', margin: '0 0 10px', lineHeight: 1.5 }}>
              These are the raw spot readings recorded as the probe settled in the field. The final averaged benchmark below is used as today's official daily soil health report.
            </p>
            {loadingFluctLog ? (
              <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>Loading raw spot readings…</p>
            ) : fluctLog.length === 0 ? (
              <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>No raw spot fluctuations recorded yet for this farm.</p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#111113', color: '#666', sticky: 'top' }}>
                      <th style={{ padding: '6px 8px' }}>Time</th>
                      {PARAMS.map(k => (
                        <th key={k} style={{ padding: '6px 8px' }}>{PARAM_LABEL[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fluctLog.slice(0, 50).map(h => (
                      <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#aaa' }}>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          {new Date(h.capturedAt).toLocaleTimeString('en-IN')}
                        </td>
                        {PARAMS.map(k => (
                          <td key={k} style={{ padding: '6px 8px' }}>{h.readings[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {analysis?.confidenceReason && (
          <p style={{ color: '#666', fontSize: '12px', margin: '10px 0 0', lineHeight: 1.6 }}>
            {analysis.confidenceReason}
          </p>
        )}

        {error && (
          <p style={{
            fontSize: '12px', color: '#f87171', margin: '12px 0 0',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px', padding: '10px 12px',
          }}>{error}</p>
        )}
        {loading && !analysis && (
          <p style={{ color: '#888', fontSize: '13px', margin: '12px 0 0' }}>
            Reading your soil numbers, history and weather…
          </p>
        )}
        {!loading && !analysis && !error && (
          <p style={{ color: '#666', fontSize: '13px', margin: '12px 0 0' }}>
            Press "Analyse My Soil" to build the report for this farm.
          </p>
        )}
      </div>

      {analysis && (
        <>
          {/* ── 1. Overall picture ────────────────────────────────────── */}
          {/* ── 1. Overall picture ────────────────────────────────────── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>Your Soil Right Now</p>
            <p style={{ color: '#ddd', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
              {analysis.soilSummary}
            </p>
          </div>

          {/* ── Predictive Analytics & 7-Day Calculated Forecast Charts ──────── */}
          {referenceData?.predictiveAnalytics?.parameterForecasts && (
            <div style={{ ...cardStyle, borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>
                    📈 Predictive Trends & 7-Day Calculated Forecast Charts
                  </h4>
                  <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                    Calculated from {referenceData.predictiveAnalytics.historyCount} soil tests for this field over time. Dashed line represents projected future trajectory.
                  </p>
                </div>
                <Badge rgb="139,92,246">Predictive Engine</Badge>
              </div>

              {/* Predictive Warning Highlights */}
              {(referenceData.predictiveAnalytics.daysToDeficiency?.length > 0 || referenceData.predictiveAnalytics.acidificationWarning) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {referenceData.predictiveAnalytics.acidificationWarning && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                      <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>⚡ Rapid Soil Acidification Warning</span>
                      <p style={{ color: '#f87171', fontSize: '13px', margin: '4px 0 0', lineHeight: 1.6 }}>
                        Current pH: <strong>{referenceData.predictiveAnalytics.acidificationWarning.currentPh}</strong> (dropping by ~{referenceData.predictiveAnalytics.acidificationWarning.dailyDrop}/day). At this rate, soil will cross critical acidity threshold (&lt; 4.5) in <strong>{referenceData.predictiveAnalytics.acidificationWarning.daysUntilCritical} days</strong>.
                        <br />
                        <span style={{ color: '#34d399' }}>💡 {referenceData.predictiveAnalytics.acidificationWarning.recommendation}</span>
                      </p>
                    </div>
                  )}

                  {referenceData.predictiveAnalytics.daysToDeficiency?.map((def, idx) => (
                    <div key={idx} style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                      <span style={{ color: '#fb923c', fontSize: '13px', fontWeight: 700 }}>⏳ {def.parameter} Days-to-Deficiency Forecast</span>
                      <p style={{ color: '#fdba74', fontSize: '13px', margin: '4px 0 0', lineHeight: 1.6 }}>
                        Current level is {def.currentVal} mg/kg (dropping ~{def.dailyDrop} mg/kg per day). {def.parameter} is projected to fall below the minimum crop threshold ({def.thresholdVal} mg/kg) in approximately <strong>{def.estimatedDaysRemaining} days</strong>.
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Calculated Forecast Graphs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <ForecastChartCard
                  title="Nitrogen (N)"
                  unit="mg/kg"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.n}
                  colorRgb="52,211,153"
                />
                <ForecastChartCard
                  title="Phosphorus (P)"
                  unit="mg/kg"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.p}
                  colorRgb="96,165,250"
                />
                <ForecastChartCard
                  title="Potassium (K)"
                  unit="mg/kg"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.k}
                  colorRgb="167,139,250"
                />
                <ForecastChartCard
                  title="Soil pH"
                  unit="scale"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.ph}
                  colorRgb="251,146,60"
                />
                <ForecastChartCard
                  title="Soil Moisture"
                  unit="%"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.moisture}
                  colorRgb="56,189,248"
                />
                <ForecastChartCard
                  title="Soil Temperature"
                  unit="°C"
                  forecastObj={referenceData.predictiveAnalytics.parameterForecasts.temperature}
                  colorRgb="250,204,21"
                />
              </div>
            </div>
          )}

          {/* ── Soil-Borne Disease Risk Warnings (UC Davis / Cornell / FAO) ────── */}
          {referenceData?.diseaseRisks?.length > 0 && (
            <div style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🦠</span>
                  <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                    Soil-Borne Disease Risk Alerts
                  </h4>
                </div>
                <Badge rgb="239,68,68">Sourced from UC Davis / Cornell / FAO</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {referenceData.diseaseRisks.map((riskItem, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '12px', padding: '14px 16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ color: '#f87171', fontSize: '14px', fontWeight: 700 }}>
                        {riskItem.icon} {riskItem.disease} <span style={{ color: '#888', fontWeight: 500, fontSize: '12px' }}>({riskItem.pathogen})</span>
                      </span>
                      <Badge rgb={riskItem.risk === 'High' ? '239,68,68' : '251,146,60'}>
                        {riskItem.risk} Risk Trigger
                      </Badge>
                    </div>

                    <p style={{ color: '#ccc', fontSize: '13px', margin: '0 0 6px', lineHeight: 1.6 }}>
                      {riskItem.reason}
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#fbbf24' }}>⚡ <strong>Triggering Soil Conditions:</strong> {riskItem.triggeringConditions}</span>
                      <span style={{ color: '#34d399' }}>🛡️ <strong>Prevention:</strong> {riskItem.prevention}</span>
                    </div>
                    {riskItem.source && (
                      <p style={{ color: '#666', fontSize: '11px', margin: '8px 0 0' }}>
                        Source: {riskItem.source}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Agroclimatic Zone & Fertilizer Recommendations (NAAS Policy 42) ── */}
          {(referenceData?.fertilizerRecommendation || referenceData?.regionalZone || referenceData?.cropBenchmark) && (
            <div style={{ ...cardStyle, borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.02)' }}>
              <p style={sectionTitle}>🌾 Agronomic Benchmarks & Official Fertilizer Doses</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {referenceData.regionalZone && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 700 }}>Agroclimatic Zone</span>
                    <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: '4px 0 2px' }}>{referenceData.regionalZone.zone}</p>
                    <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>Soil Types: {referenceData.regionalZone.soilTypes}</p>
                  </div>
                )}

                {referenceData.fertilizerRecommendation && (
                  <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                    <span style={{ fontSize: '10px', color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>NAAS Recommended Dose</span>
                    <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: '4px 0 2px' }}>
                      N: {referenceData.fertilizerRecommendation.n_kgPerHa} | P₂O₅: {referenceData.fertilizerRecommendation.p2o5_kgPerHa} | K₂O: {referenceData.fertilizerRecommendation.k2o_kgPerHa} kg/ha
                    </p>
                    <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>NPK Ratio: {referenceData.fertilizerRecommendation.ratio} ({referenceData.fertilizerRecommendation.season || 'Annual'})</p>
                  </div>
                )}

                {referenceData.cropBenchmark && (
                  <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                    <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', fontWeight: 700 }}>ICAR Ideal pH & Temp Benchmark</span>
                    <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: '4px 0 2px' }}>
                      pH: {referenceData.cropBenchmark.ph.min} - {referenceData.cropBenchmark.ph.max} (Avg: {referenceData.cropBenchmark.ph.avg})
                    </p>
                    <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                      Temp: {referenceData.cropBenchmark.temperature.min}°C - {referenceData.cropBenchmark.temperature.max}°C
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {orderMsg && (
            <div style={{
              background: orderMsg.error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${orderMsg.error ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
              borderRadius: '12px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
            }}>
              <span style={{ color: orderMsg.error ? '#f87171' : '#34d399', fontSize: '13px' }}>
                {orderMsg.error || `✓ ${orderMsg.name} — order #${orderMsg.id} sent to nearby vendors.`}
              </span>
              {!orderMsg.error && (
                <button
                  onClick={() => navigate('/orders')}
                  style={{
                    padding: '7px 14px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                    color: '#ccc', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >Track in Orders →</button>
              )}
            </div>
          )}

          {/* ── 2. Every reading, explained properly ───────────────────── */}
          {analysis.parameters?.length > 0 && (
            <div style={cardStyle}>
              <p style={sectionTitle}>Every Reading Explained</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysis.parameters.map((param, i) => {
                  const color = STATUS_COLOR[param.status] || STATUS_COLOR.optimal;
                  const value = latest.readings?.[param.key];
                  return (
                    <div key={i} style={{
                      background: `rgba(${color.rgb},0.04)`,
                      border: `1px solid rgba(${color.rgb},0.18)`,
                      borderRadius: '14px', padding: '16px 18px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                          {PARAM_LABEL[param.key] || param.key}
                          {value !== undefined && (
                            <span style={{ color: `rgb(${color.rgb})`, marginLeft: '8px' }}>
                              {value} <span style={{ color: '#777', fontSize: '12px', fontWeight: 500 }}>{PARAM_UNIT[param.key]}</span>
                            </span>
                          )}
                        </h4>
                        <Badge rgb={color.rgb}>{color.text}</Badge>
                      </div>

                      {param.headline && (
                        <p style={{ color: `rgb(${color.rgb})`, fontSize: '13px', fontWeight: 600, margin: '6px 0 0' }}>
                          {param.headline}
                        </p>
                      )}
                      {param.normalRange && (
                        <p style={{ color: '#777', fontSize: '12px', margin: '4px 0 0' }}>
                          Healthy range: {param.normalRange}
                        </p>
                      )}

                      <Field label="What it means" color="#ccc">{param.meaning || param.note}</Field>
                      <Field label="Why it happened">{param.cause}</Field>
                      <Field label="Effect on your crop">{param.effectOnCrop}</Field>
                      <Field label="What to do" color="#34d399">{param.whatToDo}</Field>
                      <Field label="If you ignore it" color="#fbbf24">{param.ifIgnored}</Field>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. Actions, with method, dose and timing ───────────────── */}
          {analysis.corrections?.length > 0 && (
            <div style={cardStyle}>
              <p style={sectionTitle}>What To Do</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysis.corrections.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '14px', padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        {i + 1}. {c.action}
                      </h4>
                      {c.urgency && <Badge rgb={URGENCY_COLOR[c.urgency] || '148,163,184'}>{c.urgency}</Badge>}
                    </div>

                    <Field label="Why" color="#ccc">{c.why}</Field>
                    <Field label="How to do it">{c.how}</Field>
                    <Field label="How much">{c.howMuch}</Field>
                    <Field label="When">{c.when}</Field>
                    <Field label="What should improve" color="#34d399">{c.expectedResult}</Field>

                    {c.products?.length > 0 && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                          Product{c.products.length > 1 ? 's' : ''} that can help
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {c.products.map((product) => (
                            <div key={product.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: '12px', flexWrap: 'wrap',
                              background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.18)',
                              borderRadius: '10px', padding: '12px 14px',
                            }}>
                              <div style={{ flex: 1, minWidth: '180px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                  <span style={{ color: '#eee', fontSize: '13px', fontWeight: 600 }}>{product.name}</span>
                                  <Badge rgb="148,163,184">{product.category}</Badge>
                                  {product.isOrganic && <Badge rgb="52,211,153">organic</Badge>}
                                </div>
                                {product.whyThis && (
                                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px', lineHeight: 1.6 }}>{product.whyThis}</p>
                                )}
                                <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 700 }}>
                                  ₹{product.price}<span style={{ color: '#666', fontWeight: 500 }}> / {product.unit}</span>
                                </span>
                              </div>
                              <button
                                onClick={() => handleOrder(product)}
                                disabled={orderingId === product.id}
                                style={{
                                  padding: '10px 20px',
                                  background: orderingId === product.id ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                  border: 'none', borderRadius: '9px', color: '#fff',
                                  fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                                  cursor: orderingId === product.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {orderingId === product.id ? 'Ordering…' : 'Order'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Crops ───────────────────────────────────────────────── */}
          {(analysis.currentCropCheck || analysis.cropRecommendations?.length > 0) && (
            <div style={cardStyle}>
              <p style={sectionTitle}>
                {analysis.cropMode === 'check' ? 'Your Crop & Better Options' : 'Best Crops For This Soil'}
              </p>

              {analysis.currentCropCheck && (
                <div style={{
                  background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '14px', padding: '16px 18px', marginBottom: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Currently growing: {farm?.currentCrop}
                    </h4>
                    <Badge rgb={analysis.currentCropCheck.verdict === 'good fit' ? '52,211,153'
                      : analysis.currentCropCheck.verdict === 'poor fit' ? '248,113,113' : '251,146,60'}>
                      {analysis.currentCropCheck.verdict}
                    </Badge>
                  </div>
                  <Field label="How this soil suits it" color="#ccc">{analysis.currentCropCheck.why}</Field>
                  <Field label="Problems it will face" color="#fbbf24">{analysis.currentCropCheck.risks}</Field>
                  <Field label="How to still get a good yield" color="#34d399">{analysis.currentCropCheck.advice}</Field>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysis.cropRecommendations?.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.16)',
                    borderRadius: '14px', padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(52,211,153,0.15)', color: '#34d399',
                          fontSize: '12px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>{c.crop}</h4>
                      </div>
                      {c.fit && <Badge rgb={c.fit === 'good' ? '52,211,153' : '251,146,60'}>{c.fit} fit</Badge>}
                    </div>

                    <Field label="Why it suits your soil" color="#ccc">{c.why}</Field>
                    <Field label="Sowing season">{c.season}</Field>
                    <Field label="Water it needs">{c.waterNeed}</Field>
                    <Field label="What it does for your soil" color="#34d399">{c.expectedBenefit}</Field>
                    <Field label="Be careful about" color="#fbbf24">{c.caution}</Field>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. Risk — an estimate, never a diagnosis ───────────────── */}
          {analysis.risk && (
            <div style={cardStyle}>
              <p style={sectionTitle}>Risk Check</p>
              <div style={{
                background: `rgba(${RISK_COLOR[analysis.risk.level] || '148,163,184'},0.05)`,
                border: `1px solid rgba(${RISK_COLOR[analysis.risk.level] || '148,163,184'},0.22)`,
                borderRadius: '14px', padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <Badge rgb={RISK_COLOR[analysis.risk.level] || '148,163,184'}>{analysis.risk.level} risk</Badge>
                </div>
                <p style={{ color: '#ccc', fontSize: '13px', margin: 0, lineHeight: 1.7 }}>{analysis.risk.summary}</p>

                {analysis.risk.issues?.map((issue, i) => (
                  <div key={i} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: 0 }}>{issue.name}</h4>
                      {issue.timeframe && <Badge rgb="148,163,184">{issue.timeframe}</Badge>}
                    </div>
                    <Field label="Why this risk exists" color="#ccc">{issue.why}</Field>
                    <Field label="Signs to watch for in the field" color="#fbbf24">{issue.signsToWatch}</Field>
                    <Field label="How to prevent it" color="#34d399">{issue.prevention}</Field>
                  </div>
                ))}

                <p style={{ color: '#555', fontSize: '11px', margin: '16px 0 0', lineHeight: 1.6 }}>
                  This is a risk estimate built from soil readings and weather. It is not a confirmed
                  disease — no plant has been examined for this report.
                </p>
              </div>
            </div>
          )}

          {/* ── 6. Next season ─────────────────────────────────────────── */}
          {analysis.future && (
            <div style={cardStyle}>
              <p style={sectionTitle}>Planning Ahead</p>

              {analysis.future.nextSeason?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                  {analysis.future.nextSeason.map((n, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '14px', padding: '16px 18px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>Next season: {n.crop}</h4>
                        {n.whenToSow && <Badge rgb="167,139,250">{n.whenToSow}</Badge>}
                      </div>
                      <Field label="Why this crop next" color="#ccc">{n.why}</Field>
                      <Field label="Fix this before sowing" color="#fbbf24">{n.prepareFirst}</Field>
                    </div>
                  ))}
                </div>
              )}

              {analysis.future.prepare?.length > 0 && (
                <div style={{
                  background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.16)',
                  borderRadius: '14px', padding: '16px 18px',
                }}>
                  <p style={{ color: '#a78bfa', fontSize: '12px', fontWeight: 700, margin: '0 0 10px' }}>
                    Prepare Before Sowing
                  </p>
                  {analysis.future.prepare.map((item, i) => (
                    typeof item === 'string' ? (
                      <p key={i} style={{ color: '#bbb', fontSize: '13px', margin: '0 0 8px', lineHeight: 1.7 }}>• {item}</p>
                    ) : (
                      <div key={i} style={{ marginBottom: '12px' }}>
                        <p style={{ color: '#eee', fontSize: '13px', fontWeight: 600, margin: '0 0 3px' }}>{i + 1}. {item.step}</p>
                        <p style={{ color: '#999', fontSize: '13px', margin: 0, lineHeight: 1.7 }}>{item.detail}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 7. The farm's soil profile ─────────────────────────────── */}
          {analysis.soilProfile && (
            <div style={cardStyle}>
              <p style={sectionTitle}>{farm?.name} — Soil Profile</p>
              <div style={{
                background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.18)',
                borderRadius: '14px', padding: '18px',
              }}>
                <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: 0, lineHeight: 1.7 }}>
                  {analysis.soilProfile.characterisation}
                </p>
                <Field label="Nutrient pattern" color="#ccc">{analysis.soilProfile.nutrientPattern}</Field>
                <Field label="pH behaviour" color="#ccc">{analysis.soilProfile.phBehaviour}</Field>
                <Field label="Moisture behaviour" color="#ccc">{analysis.soilProfile.moistureBehaviour}</Field>
                <Field label="Salt behaviour" color="#ccc">{analysis.soilProfile.saltBehaviour}</Field>
                <Field label="Trend so far" color="#ccc">{analysis.soilProfile.trend}</Field>
                <Field label="Where this field is heading" color="#fbbf24">{analysis.soilProfile.whatThisMeansLongTerm}</Field>
                {analysis.soilProfile.note && (
                  <p style={{ color: '#555', fontSize: '11px', margin: '14px 0 0', lineHeight: 1.6 }}>
                    {analysis.soilProfile.note}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── 8. Trends ──────────────────────────────────────────────── */}
          {historyOldestFirst.length >= 2 && (
            <div style={cardStyle}>
              <p style={sectionTitle}>Trends Across {historyOldestFirst.length} Tests</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '10px' }}>
                {PARAMS.map((key) => {
                  const values = historyOldestFirst.map(t => t.readings[key]).filter(Number.isFinite);
                  if (values.length < 2) return null;
                  const first = values[0];
                  const last = values[values.length - 1];
                  const change = last - first;
                  const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
                  const steady = Math.abs(pct) < 5;
                  const rgb = steady ? '148,163,184' : (change > 0 ? '52,211,153' : '251,146,60');
                  return (
                    <div key={key} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px', padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <span style={{ color: '#999', fontSize: '11px', fontWeight: 600 }}>{PARAM_LABEL[key]}</span>
                        <span style={{ color: `rgb(${rgb})`, fontSize: '11px', fontWeight: 700 }}>
                          {steady ? 'steady' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}`}
                        </span>
                      </div>
                      <Sparkline values={values} rgb={rgb} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ color: '#555', fontSize: '10px' }}>{first}</span>
                        <span style={{ color: '#888', fontSize: '10px', fontWeight: 600 }}>{last}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {analysedAt && (
                <p style={{ color: '#444', fontSize: '11px', margin: '14px 0 0' }}>
                  Analysed {new Date(analysedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}based on {tests.length} saved test{tests.length > 1 ? 's' : ''} for {farm?.name}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
