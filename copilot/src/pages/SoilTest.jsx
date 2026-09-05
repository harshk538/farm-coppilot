import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const FARMS_API = `${API_BASE_URL}/api/farms`;
const SOIL_API = `${API_BASE_URL}/api/soil`;

/* ── Stability rule ────────────────────────────────────────────────────────
   A reading is only worth storing once the probe has settled in the soil.
   The website watches the live stream and requires every value to stay within
   ±3% of where it was when the window opened, for 10 seconds without a break.
   Any bigger jump restarts the clock. Change these two numbers to retune. */
const STABLE_SECONDS = 10;

/* How much each value is allowed to wander during those 10 seconds.
   `abs` is a fixed amount in the value's own units; `pct` is a percentage
   with `min` as its floor (percentages are useless near zero).
   N, P and K use fixed amounts because NPK probes jitter by whole units. */
const TOLERANCE = {
  n:           { abs: 3 },
  p:           { abs: 10 },
  k:           { abs: 10 },
  ph:          { abs: 0.1 },
  moisture:    { pct: 0.03, min: 0.5 },
  temperature: { pct: 0.03, min: 0.3 },
  tds:         { pct: 0.03, min: 5 },
};

const PARAMS = ['n', 'p', 'k', 'ph', 'moisture', 'temperature', 'tds'];

const PARAM_META = {
  n:           { label: 'Nitrogen (N)',   unit: 'mg/kg', rgb: '96,165,250' },
  p:           { label: 'Phosphorus (P)', unit: 'mg/kg', rgb: '167,139,250' },
  k:           { label: 'Potassium (K)',  unit: 'mg/kg', rgb: '244,114,182' },
  ph:          { label: 'pH',             unit: '',      rgb: '52,211,153' },
  moisture:    { label: 'Moisture',       unit: '%',     rgb: '56,189,248' },
  temperature: { label: 'Soil Temp',      unit: '°C',    rgb: '251,146,60' },
  tds:         { label: 'TDS',            unit: 'ppm',   rgb: '250,204,21' },
};

/* The meter's own wording varies between firmwares, so every common spelling
   is accepted and folded onto one internal key. */
const KEY_ALIASES = {
  n: 'n', nitrogen: 'n', nit: 'n',
  p: 'p', phosphorus: 'p', phos: 'p',
  k: 'k', potassium: 'k', pot: 'k',
  ph: 'ph', soilph: 'ph',
  moist: 'moisture', moisture: 'moisture', hum: 'moisture', humidity: 'moisture', soilmoisture: 'moisture',
  temp: 'temperature', temperature: 'temperature', soiltemp: 'temperature',
  tds: 'tds',
  // Kept alongside the seven, not instead of them — the AI gets them as context.
  ec: 'ec', conductivity: 'ec',
  salinity: 'salinity', sal: 'salinity',
};

const EXTRA_KEYS = ['ec', 'salinity'];

const DEMO_READING = { n: 142, p: 38, k: 96, ph: 6.4, moisture: 28.5, temperature: 26.8, tds: 410 };

/* Meters print either one line with everything on it, or a block of one value
   per line. Both are handled: this reads a SINGLE line and returns whatever it
   found; the caller stitches consecutive lines together into one reading.

   Understood shapes:
     N:120,P:45,K:80,PH:6.5,MOIST:32,TEMP:27,TDS:410
     Moisture   : 100.0 %
     N / P / K  : 352 / 959 / 858 mg/kg
     {"n":120,"p":45,...}
   A line starting with "[" (e.g. "[467 ok / 0 fail]") marks a new block. */
function parseSerialLine(line) {
  const out = {};
  const trimmed = line.trim();
  if (!trimmed) return out;

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      for (const [rawKey, rawVal] of Object.entries(obj)) {
        const key = KEY_ALIASES[String(rawKey).toLowerCase().replace(/[^a-z]/g, '')];
        const value = Number(rawVal);
        if (key && Number.isFinite(value)) out[key] = value;
      }
      return out;
    } catch {
      /* fall through to the text parsers */
    }
  }

  // "N / P / K : 352 / 959 / 858 mg/kg" — three values behind one label.
  const npk = trimmed.match(
    /N\s*\/\s*P\s*\/\s*K\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/i
  );
  if (npk) {
    out.n = parseFloat(npk[1]);
    out.p = parseFloat(npk[2]);
    out.k = parseFloat(npk[3]);
    return out;
  }

  const pattern = /([A-Za-z_]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)/g;
  let match;
  while ((match = pattern.exec(trimmed)) !== null) {
    const key = KEY_ALIASES[match[1].toLowerCase().replace(/[^a-z]/g, '')];
    const value = parseFloat(match[2]);
    if (key && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function isComplete(reading) {
  return !!reading && PARAMS.every(k => Number.isFinite(reading[k]));
}

/* Has the probe stayed put, value by value, since the window opened?
   Returns null when everything held, or details of the first value that moved
   too far — so the page can say exactly what keeps restarting the clock. */
function findBreach(reference, current) {
  for (const key of PARAMS) {
    const rule = TOLERANCE[key];
    const allowed = rule.abs !== undefined
      ? rule.abs
      : Math.max(Math.abs(reference[key]) * rule.pct, rule.min);
    const drift = Math.abs(current[key] - reference[key]);
    if (drift > allowed) {
      return { key, from: reference[key], to: current[key], allowed, drift };
    }
  }
  return null;
}

/* The captured result is the average of every reading taken during the stable
   window, not one lucky frame — the last of the sensor's jitter cancels out. */
function averageSamples(samples) {
  const readings = {};
  for (const key of PARAMS) {
    const values = samples.map(s => s.reading[key]).filter(Number.isFinite);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    readings[key] = Math.round(mean * 10) / 10;
  }

  const extras = {};
  for (const key of EXTRA_KEYS) {
    const values = samples.map(s => s.extras?.[key]).filter(Number.isFinite);
    if (values.length) {
      extras[key] = Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
    }
  }

  return { readings, extras, sampleCount: samples.length };
}

const cardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '20px',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '11px 14px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: '#666',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  marginBottom: '6px', display: 'block',
};

export default function SoilTest({ user, onLogin }) {
  const navigate = useNavigate();
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);
  const [serialError, setSerialError] = useState('');

  const [live, setLive] = useState(null);
  const [stableElapsed, setStableElapsed] = useState(0);
  const [streaming, setStreaming] = useState(false);   // data arrived in the last 3s
  const [rawLines, setRawLines] = useState([]);
  const [showRaw, setShowRaw] = useState(false);
  const [fluctHistory, setFluctHistory] = useState([]);
  const [showFluctHistory, setShowFluctHistory] = useState(false);
  const [loadingFluctHistory, setLoadingFluctHistory] = useState(false);
  const [breach, setBreach] = useState(null);       // what last restarted the clock
  const [resetCount, setResetCount] = useState(0);
  const [captured, setCaptured] = useState(null);   // the reading the page settled on
  const [savedKey, setSavedKey] = useState(null);   // bumped on each save, triggers auto-analysis

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ n: '', p: '', k: '', ph: '', moisture: '', temperature: '', tds: '' });

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const closedRef = useRef(null);
  const keepReadingRef = useRef(false);
  const stableSinceRef = useRef(null);
  const stableRefRef = useRef(null);
  const liveRef = useRef(null);
  const lastLineAtRef = useRef(0);
  const pendingRef = useRef({});   // values gathered so far from the current block
  const extrasRef = useRef({});    // EC / salinity, carried alongside the seven
  const samplesRef = useRef([]);   // recent complete readings, for averaging
  const capturedRef = useRef(false); // once true the page stops looking, full stop

  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const selectedFarm = farms.find(f => f.id === selectedFarmId) || null;
  const isStable = stableElapsed >= STABLE_SECONDS;

  // ── Load farms, then that farm's past tests ──────────────────────────────
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      try {
        const res = await axios.get(FARMS_API, { params: { farmerId: user.id } });
        if (res.data.success) {
          setFarms(res.data.farms);
          if (res.data.farms.length > 0) setSelectedFarmId(prev => prev || res.data.farms[0].id);
        }
      } catch {
        setError('Could not load your farms. Is the server running?');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const loadTests = async (farmId) => {
    if (!user?.id || !farmId) return;
    try {
      const res = await axios.get(`${SOIL_API}/tests`, { params: { farmerId: user.id, farmId } });
      if (res.data.success) setTests(res.data.tests);
    } catch {
      /* the page still works without the history list */
    }
  };

  const loadFluctuationHistory = async () => {
    if (!user?.id || !selectedFarmId) return;
    setLoadingFluctHistory(true);
    try {
      const res = await axios.get(`${SOIL_API}/history`, { params: { farmerId: user.id, farmId: selectedFarmId } });
      if (res.data.success) setFluctHistory(res.data.history);
    } catch {
      /* the toggle just stays empty if this fails */
    } finally {
      setLoadingFluctHistory(false);
    }
  };

  const toggleFluctHistory = () => {
    const next = !showFluctHistory;
    setShowFluctHistory(next);
    if (next) loadFluctuationHistory();
  };

  const clearFluctHistory = async () => {
    if (!user?.id || !selectedFarmId) return;
    if (!window.confirm('Delete all raw fluctuation log entries for this farm?')) return;
    try {
      await axios.delete(`${SOIL_API}/history`, { params: { farmerId: user.id, farmId: selectedFarmId } });
      setFluctHistory([]);
      setNotice('Cleared raw fluctuation log.');
      setTimeout(() => setNotice(''), 3000);
    } catch {
      setError('Could not clear raw fluctuation log.');
    }
  };

  useEffect(() => {
    loadTests(selectedFarmId);
    setShowFluctHistory(false);
    setFluctHistory([]);
    /* eslint-disable-next-line */
  }, [selectedFarmId, user?.id]);

  // ── Stability clock — ticks independently so the bar moves smoothly and
  //    so a meter that stops sending is noticed. ───────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (capturedRef.current) return;
      const alive = Date.now() - lastLineAtRef.current < 3000;
      setStreaming(alive);
      if (!alive || !stableSinceRef.current) {
        setStableElapsed(0);
        return;
      }
      setStableElapsed(Math.min((Date.now() - stableSinceRef.current) / 1000, STABLE_SECONDS));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Close the port cleanly if the farmer navigates away mid-reading.
  useEffect(() => () => { disconnect(); /* eslint-disable-next-line */ }, []);

  const handleLine = (line) => {
    // Once a reading has been captured the page is done — nothing further is
    // measured, exactly as a lab result does not keep changing after the fact.
    if (capturedRef.current) return;

    lastLineAtRef.current = Date.now();
    setRawLines(prev => [...prev.slice(-11), line]);

    // "[467 ok / 0 fail]" (or any bracketed status line) starts a fresh block.
    if (line.trim().startsWith('[')) {
      pendingRef.current = {};
      extrasRef.current = {};
      return;
    }

    const parsed = parseSerialLine(line);
    if (Object.keys(parsed).length === 0) return;

    for (const [key, value] of Object.entries(parsed)) {
      if (EXTRA_KEYS.includes(key)) extrasRef.current[key] = value;
      else pendingRef.current[key] = value;
    }

    // Only once every one of the seven has arrived is this a usable reading —
    // whether they came on one line or spread across a block.
    const reading = pendingRef.current;
    if (!isComplete(reading)) return;

    const snapshot = { ...reading };
    liveRef.current = snapshot;
    setLive(snapshot);
    logHistory(snapshot, { ...extrasRef.current });

    // Open a new stability window whenever the probe moves out of tolerance.
    const now = Date.now();
    const problem = stableRefRef.current ? findBreach(stableRefRef.current, snapshot) : null;
    if (!stableRefRef.current || problem) {
      stableRefRef.current = snapshot;
      stableSinceRef.current = now;
      samplesRef.current = [];
      if (problem) {
        setBreach(problem);
        setResetCount(c => c + 1);
      }
    }

    samplesRef.current.push({ t: now, reading: snapshot, extras: { ...extrasRef.current } });

    // The window has held for the full duration: this is the calmest stretch we
    // are going to get, so take it, average out the last of the jitter, and stop.
    if (now - stableSinceRef.current >= STABLE_SECONDS * 1000) {
      capturedRef.current = true;
      const averaged = averageSamples(samplesRef.current);
      setCaptured(averaged.readings);
      setStableElapsed(STABLE_SECONDS);
      saveTest(averaged.readings, 'device', averaged.extras);
    }
  };

  const readLoop = async () => {
    const port = portRef.current;
    const decoder = new TextDecoderStream();
    closedRef.current = port.readable.pipeTo(decoder.writable).catch(() => {});
    const reader = decoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx;
        while ((idx = buffer.search(/[\r\n]/)) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.trim()) handleLine(line);
        }
        if (buffer.length > 500) buffer = '';   // never let junk pile up
      }
    } catch {
      if (keepReadingRef.current) setSerialError('Lost connection to the meter.');
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
    }
  };

  const connect = async () => {
    setSerialError('');
    if (!serialSupported) {
      setSerialError('This browser cannot talk to USB devices. Use Chrome or Edge on a laptop.');
      return;
    }
    setConnecting(true);
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: Number(baudRate) });
      portRef.current = port;
      keepReadingRef.current = true;
      setConnected(true);
      readLoop();
    } catch (err) {
      if (err?.name !== 'NotFoundError') {   // NotFoundError = the picker was dismissed
        setSerialError(err?.message || 'Could not open the meter.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const startNewReading = () => {
    capturedRef.current = false;
    samplesRef.current = [];
    pendingRef.current = {};
    extrasRef.current = {};
    stableSinceRef.current = null;
    stableRefRef.current = null;
    liveRef.current = null;
    setCaptured(null);
    setLive(null);
    setBreach(null);
    setResetCount(0);
    setStableElapsed(0);
    setNotice('');
  };

  const simIntervalRef = useRef(null);

  const disconnect = async () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    keepReadingRef.current = false;
    try { await readerRef.current?.cancel(); } catch { /* already gone */ }
    try { await closedRef.current; } catch { /* already gone */ }
    try { await portRef.current?.close(); } catch { /* already gone */ }
    portRef.current = null;
    readerRef.current = null;
    closedRef.current = null;
    stableSinceRef.current = null;
    stableRefRef.current = null;
    liveRef.current = null;
    pendingRef.current = {};
    extrasRef.current = {};
    setBreach(null);
    setResetCount(0);
    samplesRef.current = [];
    capturedRef.current = false;
    setCaptured(null);
    setConnected(false);
    setLive(null);
    setStableElapsed(0);
    setStreaming(false);
  };

  const startDemoStream = () => {
    disconnect();
    startNewReading();
    setConnected(true);
    setStreaming(true);
    setShowRaw(true);
    setShowFluctHistory(true);

    const targetN = Number((140 + Math.random() * 30).toFixed(1));
    const targetP = Number((370 + Math.random() * 30).toFixed(1));
    const targetK = Number((365 + Math.random() * 30).toFixed(1));
    const targetPh = Number((5.7 + Math.random() * 0.5).toFixed(2));
    const targetMoisture = Number((62 + Math.random() * 12).toFixed(1));
    const targetTemp = Number((26.0 + Math.random() * 2).toFixed(1));
    const targetTds = Number((430 + Math.random() * 40).toFixed(1));

    const frames = [
      `[${Math.floor(Math.random() * 500)} ok / 0 fail]`,
      `N: ${(targetN - 14.2).toFixed(1)} mg/kg  P: ${(targetP - 28.5).toFixed(1)} mg/kg  K: ${(targetK - 24.0).toFixed(1)} mg/kg  pH: ${(targetPh - 0.22).toFixed(2)}  Moisture: ${(targetMoisture - 4.8).toFixed(1)} %  Soil Temp: ${(targetTemp - 0.8).toFixed(1)} C  TDS: ${(targetTds - 32.1).toFixed(1)} ppm`,
      `N: ${(targetN + 11.5).toFixed(1)} mg/kg  P: ${(targetP + 22.1).toFixed(1)} mg/kg  K: ${(targetK + 18.5).toFixed(1)} mg/kg  pH: ${(targetPh + 0.18).toFixed(2)}  Moisture: ${(targetMoisture + 3.9).toFixed(1)} %  Soil Temp: ${(targetTemp + 0.7).toFixed(1)} C  TDS: ${(targetTds + 24.2).toFixed(1)} ppm`,
      `N: ${(targetN - 2.1).toFixed(1)} mg/kg  P: ${(targetP + 3.2).toFixed(1)} mg/kg  K: ${(targetK - 2.5).toFixed(1)} mg/kg  pH: ${(targetPh - 0.03).toFixed(2)}  Moisture: ${(targetMoisture + 0.6).toFixed(1)} %  Soil Temp: ${(targetTemp - 0.2).toFixed(1)} C  TDS: ${(targetTds - 3.8).toFixed(1)} ppm`,
      `N: ${targetN.toFixed(1)} mg/kg  P: ${targetP.toFixed(1)} mg/kg  K: ${targetK.toFixed(1)} mg/kg  pH: ${targetPh.toFixed(2)}  Moisture: ${targetMoisture.toFixed(1)} %  Soil Temp: ${targetTemp.toFixed(1)} C  TDS: ${targetTds.toFixed(1)} ppm`,
      `N: ${targetN.toFixed(1)} mg/kg  P: ${targetP.toFixed(1)} mg/kg  K: ${targetK.toFixed(1)} mg/kg  pH: ${targetPh.toFixed(2)}  Moisture: ${targetMoisture.toFixed(1)} %  Soil Temp: ${targetTemp.toFixed(1)} C  TDS: ${targetTds.toFixed(1)} ppm`,
      `N: ${targetN.toFixed(1)} mg/kg  P: ${targetP.toFixed(1)} mg/kg  K: ${targetK.toFixed(1)} mg/kg  pH: ${targetPh.toFixed(2)}  Moisture: ${targetMoisture.toFixed(1)} %  Soil Temp: ${targetTemp.toFixed(1)} C  TDS: ${targetTds.toFixed(1)} ppm`,
      `N: ${targetN.toFixed(1)} mg/kg  P: ${targetP.toFixed(1)} mg/kg  K: ${targetK.toFixed(1)} mg/kg  pH: ${targetPh.toFixed(2)}  Moisture: ${targetMoisture.toFixed(1)} %  Soil Temp: ${targetTemp.toFixed(1)} C  TDS: ${targetTds.toFixed(1)} ppm`,
      `N: ${targetN.toFixed(1)} mg/kg  P: ${targetP.toFixed(1)} mg/kg  K: ${targetK.toFixed(1)} mg/kg  pH: ${targetPh.toFixed(2)}  Moisture: ${targetMoisture.toFixed(1)} %  Soil Temp: ${targetTemp.toFixed(1)} C  TDS: ${targetTds.toFixed(1)} ppm`
    ];

    let step = 0;
    simIntervalRef.current = setInterval(() => {
      if (step >= frames.length || capturedRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
        return;
      }
      handleLine(frames[step]);
      step++;
    }, 850);
  };

  const saveTest = async (readings, source, extras) => {
    if (!selectedFarmId) { setError('Pick a farm first.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`${SOIL_API}/tests`, {
        farmerId: user.id,
        farmId: selectedFarmId,
        readings,
        extras: source === 'device' ? (extras || { ...extrasRef.current }) : undefined,
        source,
        stabilitySeconds: source === 'device' ? STABLE_SECONDS : null,
      });
      if (res.data.success) {
        setNotice(`Soil test saved for ${selectedFarm?.name || 'this farm'}. Redirecting to AI Report...`);
        setShowManual(false);
        setSavedKey(res.data.test?.id || String(Date.now()));
        loadTests(selectedFarmId);
        setTimeout(() => {
          navigate(`/soil-report?farm=${selectedFarmId}`);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this soil test.');
    } finally {
      setSaving(false);
    }
  };

  // Logs every reading the meter reports while it's still settling — not just
  // the one final answer — so the farm keeps a full history of the raw data.
  // Fire-and-forget: a farmer should never see an error from this.
  const logHistory = (readings, extras) => {
    if (!user?.id || !selectedFarmId) return;
    axios.post(`${SOIL_API}/history`, {
      farmerId: user.id,
      farmId: selectedFarmId,
      readings,
      extras,
    }).then(res => {
      if (res.data.success && res.data.entry) {
        setFluctHistory(prev => [res.data.entry, ...prev.filter(h => h.id !== res.data.entry.id)]);
      }
    }).catch(() => { /* best-effort log — never interrupts the reading */ });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const readings = {};
    for (const key of PARAMS) {
      const value = Number(manualForm[key]);
      if (!Number.isFinite(value) || manualForm[key] === '') {
        setError(`Please enter a value for ${PARAM_META[key].label}.`);
        return;
      }
      readings[key] = value;
    }
    saveTest(readings, 'manual');
  };

  // ── Logged out ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧪</div>
        <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 8px' }}>Log in to test your soil</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          Every confirmed test is saved to that farm's own soil history.
        </p>
        <button
          onClick={onLogin}
          style={{
            padding: '10px 22px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Log in
        </button>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#666', fontSize: '14px' }}>Loading…</p>;

  if (farms.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌱</div>
        <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 8px' }}>Add a farm first</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          A soil test always belongs to one field, so we know where the reading came from.
        </p>
        <Link
          to="/farms"
          style={{
            display: 'inline-block', padding: '10px 22px',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            borderRadius: '10px', color: '#fff', fontSize: '13px',
            fontWeight: 600, textDecoration: 'none',
          }}
        >
          Go to My Farms
        </Link>
      </div>
    );
  }

  const progressPct = Math.round((stableElapsed / STABLE_SECONDS) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {notice && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '10px', padding: '10px 14px', color: '#34d399', fontSize: '13px',
        }}>✓ {notice}</div>
      )}
      {error && !showManual && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px',
        }}>{error}</div>
      )}

      {/* ── Farm selector ───────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <label style={labelStyle}>Testing Which Farm?</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '220px', cursor: 'pointer' }}
          >
            {farms.map(f => <option key={f.id} value={f.id} style={{ background: '#111113' }}>{f.name}</option>)}
          </select>
          <Link to="/farms" style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
            Manage farms →
          </Link>
        </div>
        {selectedFarm && (
          <p style={{ fontSize: '12px', color: '#666', margin: '10px 0 0', lineHeight: 1.6 }}>
            📍 {selectedFarm.location}<br />
            🌱 Crop: {selectedFarm.currentCrop || <span style={{ color: '#34d399' }}>not set — AI will suggest which crop suits this soil</span>}
          </p>
        )}
      </div>

      {/* ── Meter connection ────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>🔌 NPK Meter</h3>
            <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
              {connected
                ? (streaming ? 'Connected — reading live values' : 'Connected — waiting for data from the meter…')
                : 'Plug the meter into this laptop with its USB cable, then connect.'}
            </p>
          </div>
          {connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: streaming ? '#34d399' : '#fbbf24' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: streaming ? '#34d399' : '#fbbf24',
                  boxShadow: `0 0 8px ${streaming ? '#34d399' : '#fbbf24'}`,
                }} />
                {streaming ? 'Live' : 'Idle'}
              </span>
              <button
                onClick={disconnect}
                style={{
                  padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', color: '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(e.target.value)}
                title="Baud rate"
                style={{ ...inputStyle, width: 'auto', padding: '9px 10px', cursor: 'pointer' }}
              >
                {[9600, 19200, 38400, 57600, 115200].map(b => (
                  <option key={b} value={b} style={{ background: '#111113' }}>{b} baud</option>
                ))}
              </select>
              <button
                onClick={connect}
                disabled={connecting || !serialSupported}
                style={{
                  padding: '10px 18px',
                  background: (connecting || !serialSupported) ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px',
                  fontWeight: 600, cursor: (connecting || !serialSupported) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {connecting ? 'Connecting…' : 'Connect Meter'}
              </button>

            </div>
          )}
        </div>

        {/* Action bar for manual input & demo reading */}
        <div style={{
          marginTop: '14px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={() => {
              setManualForm(Object.fromEntries(PARAMS.map(k => [k, String(DEMO_READING[k])])));
              setShowManual(true);
            }}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📝 Enter Soil Values Manually
          </button>

          <button
            onClick={startDemoStream}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: '#a78bfa',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ Test Demo Stream
          </button>
        </div>

        {!serialSupported && (
          <div style={{
            marginTop: '12px', fontSize: '12px', color: '#fbbf24',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '10px', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <span>
              📱 <strong>Mobile Device Detected:</strong> Web USB serial connection works with USB cables on laptops (Chrome/Edge). On your phone, tap <strong>Enter Soil Values Manually</strong> above to input your readings or tap <strong>Test Demo Stream</strong>!
            </span>
          </div>
        )}
        {serialError && (
          <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '12px', color: '#f87171' }}>{serialError}</p>
        )}
      </div>

      {/* ── Live values + stability ─────────────────────────────────────── */}
      {connected && (
        <div style={cardStyle}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px', marginBottom: '18px',
          }}>
            {PARAMS.map((key) => {
              const meta = PARAM_META[key];
              const value = (captured || live)?.[key];
              return (
                <div key={key} style={{
                  background: `rgba(${meta.rgb},0.06)`,
                  border: `1px solid rgba(${meta.rgb},0.2)`,
                  borderRadius: '12px', padding: '12px 14px',
                }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: `rgb(${meta.rgb})`, letterSpacing: '-0.5px' }}>
                    {Number.isFinite(value) ? value.toFixed(key === 'ph' ? 2 : 1) : '—'}
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 500, marginLeft: '4px' }}>{meta.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stability bar */}
          <div style={{
            background: isStable ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isStable ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: (captured || isStable) ? '#34d399' : '#ccc' }}>
                {captured
                  ? '✓ Reading captured'
                  : (streaming ? `Holding steady… ${stableElapsed.toFixed(1)} / ${STABLE_SECONDS}s` : 'Waiting for the meter…')}
              </span>
              <span style={{ fontSize: '11px', color: '#666' }}>
                N ±3 · P/K ±10 · pH ±0.1 · rest ±3%
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: isStable ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                borderRadius: '100px', transition: 'width 0.2s linear',
              }} />
            </div>

            {/* Why the clock keeps restarting — the answer to "it never goes stable" */}
            {!captured && breach && (
              <p style={{ fontSize: '11px', color: '#fbbf24', margin: '10px 0 0', lineHeight: 1.6 }}>
                Clock restarted {resetCount}x — last by <strong>{PARAM_META[breach.key].label}</strong>:{' '}
                {breach.from} → {breach.to} (moved {breach.drift.toFixed(1)}, allowed {breach.allowed.toFixed(1)})
              </p>
            )}

            {captured ? (
              <div style={{ marginTop: '14px' }}>
                <p style={{ fontSize: '12px', color: '#34d399', margin: '0 0 12px', lineHeight: 1.6 }}>
                  {saving
                    ? 'Saving this reading…'
                    : `Values above are the average of the steady window — saved to ${selectedFarm?.name}. The meter is no longer being read. Your full AI report is ready.`}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/soil-report?farm=${selectedFarmId}`)}
                    disabled={saving}
                    style={{
                      flex: 1, minWidth: '180px', padding: '12px',
                      background: saving ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      border: 'none', borderRadius: '10px', color: '#fff',
                      fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    View AI Report →
                  </button>
                  <button
                    onClick={startNewReading}
                    disabled={saving}
                    style={{
                      flex: 1, minWidth: '160px', padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                      color: '#ccc', fontSize: '14px', fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Take Another Reading
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#888', margin: '14px 0 0', lineHeight: 1.6, textAlign: 'center' }}>
                Push the probe fully into the soil and leave it. The reading is captured and saved
                on its own once the values hold steady — nothing to click.
              </p>
            )}
          </div>

          {/* Raw serial log — handy while wiring the hardware up */}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => setShowRaw(!showRaw)}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: '11px', cursor: 'pointer', padding: 0 }}
            >
              {showRaw ? '▾ Hide raw serial data' : '▸ Show raw serial data'}
            </button>
            {showRaw && (
              <pre style={{
                marginTop: '8px', marginBottom: 0, padding: '10px 12px',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', color: '#7dd3fc', fontSize: '11px',
                fontFamily: 'monospace', overflowX: 'auto', maxHeight: '120px',
              }}>
                {rawLines.length ? rawLines.join('\n') : 'nothing received yet…'}
              </pre>
            )}
          </div>
        </div>
      )}



      {/* ── Past tests for this farm ────────────────────────────────────── */}
      <div style={cardStyle}>
        <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
          Saved Tests — {selectedFarm?.name}
        </h3>
        {tests.length === 0 ? (
          <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
            No soil tests saved for this farm yet. Your first confirmed reading will appear here.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '620px' }}>
              <thead>
                <tr style={{ color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Date</th>
                  {PARAMS.map(k => (
                    <th key={k} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {PARAM_META[k].label.replace(/ \(.\)/, '')}
                    </th>
                  ))}
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Crop</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#ccc' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    {PARAMS.map(k => (
                      <td key={k} style={{ padding: '10px' }}>{t.readings[k]}</td>
                    ))}
                    <td style={{ padding: '10px', color: '#888' }}>{t.crop || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, borderRadius: '100px', padding: '2px 8px',
                        color: t.source === 'device' ? '#34d399' : '#fbbf24',
                        background: t.source === 'device' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${t.source === 'device' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                      }}>
                        {t.source === 'device' ? 'Meter' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: '#555', fontSize: '11px', margin: '14px 0 0' }}>
          The full AI report — what each reading means, what to do, which crops suit this soil,
          risks and trends — lives on the <Link to={`/soil-report?farm=${selectedFarmId}`} style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>Soil Report</Link> page.
        </p>

        {/* Every reading the meter sent while still settling, not just the one that got saved above */}
        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={toggleFluctHistory}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: '11px', cursor: 'pointer', padding: 0 }}
            >
              {showFluctHistory ? '▾ Hide raw fluctuation log' : '▸ Show raw fluctuation log'}
            </button>
            {showFluctHistory && fluctHistory.length > 0 && (
              <button
                onClick={clearFluctHistory}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '6px', color: '#f87171', fontSize: '10.5px', fontWeight: 600,
                  cursor: 'pointer', padding: '3px 8px',
                }}
              >
                🗑️ Clear Fluctuation Log
              </button>
            )}
          </div>
          {showFluctHistory && (
            loadingFluctHistory ? (
              <p style={{ color: '#666', fontSize: '12px', margin: '8px 0 0' }}>Loading…</p>
            ) : fluctHistory.length === 0 ? (
              <p style={{ color: '#666', fontSize: '12px', margin: '8px 0 0' }}>
                No fluctuation history logged yet for this farm — it fills up the next time a probe reading is taken.
              </p>
            ) : (
              <div style={{ marginTop: '8px', maxHeight: '220px', overflow: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '560px' }}>
                  <thead>
                    <tr style={{ color: '#666', textAlign: 'left', position: 'sticky', top: 0, background: '#111113' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 600 }}>Time</th>
                      {PARAMS.map(k => (
                        <th key={k} style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {PARAM_META[k].label.replace(/ \(.\)/, '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fluctHistory.map(h => (
                      <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#999' }}>
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
            )
          )}
          <p style={{ color: '#555', fontSize: '10.5px', margin: '8px 0 0' }}>
            Every value the meter sent while it was still settling — even the ones that never held
            steady — shows up here, most recent first.
          </p>
        </div>
      </div>

      {/* ── Manual entry modal ──────────────────────────────────────────── */}
      {showManual && (
        <>
          <div
            onClick={() => setShowManual(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1000, width: '92%', maxWidth: '460px', maxHeight: '88vh', overflowY: 'auto',
            background: '#111113', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Enter Soil Values</h2>
              <button
                onClick={() => setShowManual(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>
            <p style={{ color: '#666', fontSize: '12px', margin: '0 0 18px' }}>
              Saved for <strong style={{ color: '#ccc' }}>{selectedFarm?.name}</strong> and marked as a manual entry.
            </p>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: '12px' }}>
                {PARAMS.map((key) => (
                  <div key={key}>
                    <label style={labelStyle}>
                      {PARAM_META[key].label}{PARAM_META[key].unit ? ` (${PARAM_META[key].unit})` : ''}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={manualForm[key]}
                      onChange={(e) => setManualForm(prev => ({ ...prev, [key]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setManualForm(Object.fromEntries(PARAMS.map(k => [k, String(DEMO_READING[k])])))}
                style={{
                  padding: '9px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                  color: '#a78bfa', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Load demo reading
              </button>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px',
                }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%', padding: '12px',
                  background: saving ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '⏳ Saving…' : 'Save Soil Test'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
