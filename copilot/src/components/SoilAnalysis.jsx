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
  borderRadius: '12px',
  padding: '14px',
};

const sectionTitle = {
  fontSize: '10px', fontWeight: 700, color: '#666',
  textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 8px',
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

function AccordionSection({ id, title, openSection, setOpenSection, children, borderColor }) {
  const isOpen = openSection === id;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${borderColor || 'rgba(255,255,255,0.08)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpenSection(isOpen ? null : id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: '10px',
        }}
      >
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>{title}</span>
        <span style={{
          color: '#666', fontSize: '14px', fontWeight: 700,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease', flexShrink: 0,
        }}>▼</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* One labelled paragraph inside a card — this is what turns a one-line answer
   into something a farmer can actually act on. */
function Field({ label, children, color = '#999' }) {
  if (!children) return null;
  return (
    <div style={{ marginTop: '6px' }}>
      <p style={{
        fontSize: '9px', fontWeight: 700, color: '#666',
        textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px',
      }}>{label}</p>
      <p style={{ fontSize: '12px', color, margin: 0, lineHeight: 1.55 }}>{children}</p>
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
  const [openSection, setOpenSection] = useState(null);
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

  const clearFluctLog = async () => {
    if (!user?.id || !farm?.id) return;
    if (!window.confirm('Delete all raw fluctuation log entries for this farm?')) return;
    try {
      await axios.delete(`${SOIL_API}/history`, { params: { farmerId: user.id, farmId: farm.id } });
      setFluctLog([]);
    } catch {
      /* fallback */
    }
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

            {analysis?.confidence && (
              <Badge rgb={analysis.confidence === 'high' ? '52,211,153' : analysis.confidence === 'medium' ? '251,146,60' : '148,163,184'}>
                {analysis.confidence} confidence
              </Badge>
            )}

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
          <AccordionSection id="summary" title="🌱 Your Soil Right Now" openSection={openSection} setOpenSection={setOpenSection}>
            <p style={{ color: '#ddd', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
              {analysis.soilSummary}
            </p>
          </AccordionSection>

          {/* ── Predictive Analytics & 7-Day Calculated Forecast Charts ──────── */}
          {referenceData?.predictiveAnalytics?.parameterForecasts && (
            <AccordionSection
              id="forecast"
              title="📊 Daily Soil Data & 7-Day Trend Analysis"
              openSection={openSection}
              setOpenSection={setOpenSection}
              borderColor="rgba(139,92,246,0.25)"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                  Analyzed from daily soil tests for this field. Dashed line = projected trajectory.
                </p>
                <Badge rgb="139,92,246">Predictive Engine</Badge>
              </div>

              {(referenceData.predictiveAnalytics.daysToDeficiency?.length > 0 || referenceData.predictiveAnalytics.acidificationWarning) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {referenceData.predictiveAnalytics.acidificationWarning && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
                      <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>⚡ Rapid Soil Acidification Warning</span>
                      <p style={{ color: '#f87171', fontSize: '12px', margin: '4px 0 0', lineHeight: 1.55 }}>
                        Current pH: <strong>{referenceData.predictiveAnalytics.acidificationWarning.currentPh}</strong> (dropping by ~{referenceData.predictiveAnalytics.acidificationWarning.dailyDrop}/day). Critical in <strong>{referenceData.predictiveAnalytics.acidificationWarning.daysUntilCritical} days</strong>.
                        <br /><span style={{ color: '#34d399' }}>💡 {referenceData.predictiveAnalytics.acidificationWarning.recommendation}</span>
                      </p>
                    </div>
                  )}
                  {referenceData.predictiveAnalytics.daysToDeficiency?.map((def, idx) => (
                    <div key={idx} style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
                      <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 700 }}>⏳ {def.parameter} Days-to-Deficiency</span>
                      <p style={{ color: '#fdba74', fontSize: '12px', margin: '4px 0 0', lineHeight: 1.55 }}>
                        {def.currentVal} mg/kg, dropping ~{def.dailyDrop}/day. Below threshold in <strong>{def.estimatedDaysRemaining} days</strong>.
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                <ForecastChartCard title="Nitrogen (N)" unit="mg/kg" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.n} colorRgb="52,211,153" />
                <ForecastChartCard title="Phosphorus (P)" unit="mg/kg" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.p} colorRgb="96,165,250" />
                <ForecastChartCard title="Potassium (K)" unit="mg/kg" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.k} colorRgb="167,139,250" />
                <ForecastChartCard title="Soil pH" unit="scale" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.ph} colorRgb="251,146,60" />
                <ForecastChartCard title="Soil Moisture" unit="%" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.moisture} colorRgb="56,189,248" />
                <ForecastChartCard title="Soil Temperature" unit="°C" forecastObj={referenceData.predictiveAnalytics.parameterForecasts.temperature} colorRgb="250,204,21" />
              </div>
            </AccordionSection>
          )}

          {/* ── Soil-Borne Disease Risk Warnings ────── */}
          {referenceData?.diseaseRisks?.length > 0 && (
            <AccordionSection
              id="disease"
              title="🦠 Soil-Borne Disease Risk Alerts"
              openSection={openSection}
              setOpenSection={setOpenSection}
              borderColor="rgba(239,68,68,0.25)"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <Badge rgb="239,68,68">Sourced from UC Davis / Cornell / FAO</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {referenceData.diseaseRisks.map((riskItem, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '10px', padding: '10px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ color: '#f87171', fontSize: '13px', fontWeight: 700 }}>
                        {riskItem.icon} {riskItem.disease} <span style={{ color: '#888', fontWeight: 500, fontSize: '11px' }}>({riskItem.pathogen})</span>
                      </span>
                      <Badge rgb={riskItem.risk === 'High' ? '239,68,68' : '251,146,60'}>
                        {riskItem.risk} Risk
                      </Badge>
                    </div>
                    <p style={{ color: '#ccc', fontSize: '12px', margin: '0 0 4px', lineHeight: 1.5 }}>
                      {riskItem.reason}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
                      <span style={{ color: '#fbbf24' }}>⚡ {riskItem.triggeringConditions}</span>
                      <span style={{ color: '#34d399' }}>🛡️ {riskItem.prevention}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionSection>
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
            <AccordionSection id="readings" title="📖 Every Reading Explained" openSection={openSection} setOpenSection={setOpenSection}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.parameters.map((param, i) => {
                  const color = STATUS_COLOR[param.status] || STATUS_COLOR.optimal;
                  const value = latest.readings?.[param.key];
                  return (
                    <div key={i} style={{
                      background: `rgba(${color.rgb},0.04)`,
                      border: `1px solid rgba(${color.rgb},0.18)`,
                      borderRadius: '10px', padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                          {PARAM_LABEL[param.key] || param.key}
                          {value !== undefined && (
                            <span style={{ color: `rgb(${color.rgb})`, marginLeft: '6px' }}>
                              {value} <span style={{ color: '#777', fontSize: '11px', fontWeight: 500 }}>{PARAM_UNIT[param.key]}</span>
                            </span>
                          )}
                        </h4>
                        <Badge rgb={color.rgb}>{color.text}</Badge>
                      </div>
                      {param.headline && (
                        <p style={{ color: `rgb(${color.rgb})`, fontSize: '12px', fontWeight: 600, margin: '4px 0 0' }}>
                          {param.headline}
                        </p>
                      )}
                      {param.normalRange && (
                        <p style={{ color: '#777', fontSize: '11px', margin: '2px 0 0' }}>
                          Range: {param.normalRange}
                        </p>
                      )}
                      <Field label="What it means" color="#ccc">{param.meaning || param.note}</Field>
                      <Field label="What to do" color="#34d399">{param.whatToDo}</Field>
                      <Field label="If ignored" color="#fbbf24">{param.ifIgnored}</Field>
                    </div>
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* ── 3. Actions, with method, dose and timing ───────────────── */}
          {analysis.corrections?.length > 0 && (
            <AccordionSection id="corrections" title="✅ What To Do" openSection={openSection} setOpenSection={setOpenSection}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.corrections.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px', padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                        {i + 1}. {c.action}
                      </h4>
                      {c.urgency && <Badge rgb={URGENCY_COLOR[c.urgency] || '148,163,184'}>{c.urgency}</Badge>}
                    </div>
                    <Field label="Why" color="#ccc">{c.why}</Field>
                    <Field label="How">{c.how}</Field>
                    <Field label="How much">{c.howMuch}</Field>
                    <Field label="When">{c.when}</Field>
                    <Field label="Expected result" color="#34d399">{c.expectedResult}</Field>

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
            </AccordionSection>
          )}

          {/* ── 4. Crops ───────────────────────────────────────────────── */}
          {(analysis.currentCropCheck || analysis.cropRecommendations?.length > 0) && (
            <AccordionSection
              id="crops"
              title={`🌾 ${analysis.cropMode === 'check' ? 'Your Crop & Better Options' : 'Best Crops For This Soil'}`}
              openSection={openSection}
              setOpenSection={setOpenSection}
              borderColor="rgba(52,211,153,0.2)"
            >
              {analysis.currentCropCheck && (
                <div style={{
                  background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                      Currently: {farm?.currentCrop}
                    </h4>
                    <Badge rgb={analysis.currentCropCheck.verdict === 'good fit' ? '52,211,153'
                      : analysis.currentCropCheck.verdict === 'poor fit' ? '248,113,113' : '251,146,60'}>
                      {analysis.currentCropCheck.verdict}
                    </Badge>
                  </div>
                  <Field label="Soil suitability" color="#ccc">{analysis.currentCropCheck.why}</Field>
                  <Field label="Risks" color="#fbbf24">{analysis.currentCropCheck.risks}</Field>
                  <Field label="Advice" color="#34d399">{analysis.currentCropCheck.advice}</Field>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.cropRecommendations?.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.16)',
                    borderRadius: '10px', padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                        {i + 1}. {c.crop}
                      </h4>
                      {c.fit && <Badge rgb={c.fit === 'good' ? '52,211,153' : '251,146,60'}>{c.fit} fit</Badge>}
                    </div>
                    <Field label="Why" color="#ccc">{c.why}</Field>
                    <Field label="Season">{c.season}</Field>
                    <Field label="Water">{c.waterNeed}</Field>
                    <Field label="Benefit" color="#34d399">{c.expectedBenefit}</Field>
                    <Field label="Caution" color="#fbbf24">{c.caution}</Field>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ── 5. Risk — an estimate, never a diagnosis ───────────────── */}
          {analysis.risk && (
            <AccordionSection id="risk" title="⚠️ Risk Check" openSection={openSection} setOpenSection={setOpenSection} borderColor="rgba(248,113,113,0.2)">
              <div style={{
                background: `rgba(${RISK_COLOR[analysis.risk.level] || '148,163,184'},0.05)`,
                border: `1px solid rgba(${RISK_COLOR[analysis.risk.level] || '148,163,184'},0.22)`,
                borderRadius: '10px', padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <Badge rgb={RISK_COLOR[analysis.risk.level] || '148,163,184'}>{analysis.risk.level} risk</Badge>
                </div>
                <p style={{ color: '#ccc', fontSize: '12px', margin: 0, lineHeight: 1.55 }}>{analysis.risk.summary}</p>
                {analysis.risk.issues?.map((issue, i) => (
                  <div key={i} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: 700, margin: 0 }}>{issue.name}</h4>
                      {issue.timeframe && <Badge rgb="148,163,184">{issue.timeframe}</Badge>}
                    </div>
                    <Field label="Why" color="#ccc">{issue.why}</Field>
                    <Field label="Watch for" color="#fbbf24">{issue.signsToWatch}</Field>
                    <Field label="Prevention" color="#34d399">{issue.prevention}</Field>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ── 6. Next season ─────────────────────────────────────────── */}
          {analysis.future && (
            <AccordionSection id="future" title="📅 Planning Ahead" openSection={openSection} setOpenSection={setOpenSection}>
              {analysis.future.nextSeason?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {analysis.future.nextSeason.map((n, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '10px', padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>Next: {n.crop}</h4>
                        {n.whenToSow && <Badge rgb="167,139,250">{n.whenToSow}</Badge>}
                      </div>
                      <Field label="Why" color="#ccc">{n.why}</Field>
                      <Field label="Prepare first" color="#fbbf24">{n.prepareFirst}</Field>
                    </div>
                  ))}
                </div>
              )}
              {analysis.future.prepare?.length > 0 && (
                <div style={{
                  background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.16)',
                  borderRadius: '10px', padding: '10px 12px',
                }}>
                  <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, margin: '0 0 6px' }}>Prepare Before Sowing</p>
                  {analysis.future.prepare.map((item, i) => (
                    typeof item === 'string' ? (
                      <p key={i} style={{ color: '#bbb', fontSize: '12px', margin: '0 0 4px', lineHeight: 1.5 }}>• {item}</p>
                    ) : (
                      <div key={i} style={{ marginBottom: '6px' }}>
                        <p style={{ color: '#eee', fontSize: '12px', fontWeight: 600, margin: '0 0 2px' }}>{i + 1}. {item.step}</p>
                        <p style={{ color: '#999', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{item.detail}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </AccordionSection>
          )}

          {/* ── 7. The farm's soil profile ─────────────────────────────── */}
          {analysis.soilProfile && (
            <AccordionSection id="profile" title={`🧪 ${farm?.name} — Soil Profile`} openSection={openSection} setOpenSection={setOpenSection} borderColor="rgba(139,92,246,0.2)">
              <div style={{
                background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.18)',
                borderRadius: '10px', padding: '10px 12px',
              }}>
                <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: 1.55 }}>
                  {analysis.soilProfile.characterisation}
                </p>
                <Field label="Nutrients" color="#ccc">{analysis.soilProfile.nutrientPattern}</Field>
                <Field label="pH" color="#ccc">{analysis.soilProfile.phBehaviour}</Field>
                <Field label="Moisture" color="#ccc">{analysis.soilProfile.moistureBehaviour}</Field>
                <Field label="Salts" color="#ccc">{analysis.soilProfile.saltBehaviour}</Field>
                <Field label="Trend" color="#ccc">{analysis.soilProfile.trend}</Field>
                <Field label="Long term" color="#fbbf24">{analysis.soilProfile.whatThisMeansLongTerm}</Field>
              </div>
            </AccordionSection>
          )}

          {/* ── 8. Trends ──────────────────────────────────────────────── */}
          {historyOldestFirst.length >= 2 && (
            <AccordionSection id="trends" title={`📈 Trends Across ${historyOldestFirst.length} Tests`} openSection={openSection} setOpenSection={setOpenSection}>
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
            </AccordionSection>
          )}
        </>
      )}
    </div>
  );
}
