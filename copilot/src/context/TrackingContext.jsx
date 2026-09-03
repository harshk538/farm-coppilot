import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Keeps the "delivery is on its way" state alive across page navigation
// (Orders, Equipment, Advisory, etc.) and even across a full page reload,
// so switching pages/windows doesn't reset or pause the tracking.
const TrackingContext = createContext(null);
const STORAGE_KEY = 'fc_active_tracking';

// Kept in sync with the same duration used in Treatment.jsx / the backend.
export const DELIVERY_DURATION_MS = 2 * 60 * 1000;

export function TrackingProvider({ children }) {
  const [tracking, setTracking] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Force a re-render every second so any live countdown text stays current.
  // The actual progress math is always based on real timestamps, never this tick.
  const [, bumpTick] = useState(0);
  useEffect(() => {
    if (!tracking) return;
    const interval = setInterval(() => bumpTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [tracking]);

  const startTracking = useCallback((info) => {
    setTracking((prev) => {
      // Don't restart an identical, already-running tracking (avoids resetting
      // bookedAtMs every time the map page re-mounts for the same delivery).
      if (prev && prev.id === info.id && prev.type === info.type) return prev;
      const next = { ...info, bookedAtMs: info.bookedAtMs || Date.now() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const stopTracking = useCallback(() => {
    setTracking(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const elapsed = tracking ? Date.now() - tracking.bookedAtMs : 0;
  const fraction = tracking ? Math.min(1, Math.max(0, elapsed / DELIVERY_DURATION_MS)) : 0;
  const arrived = !!tracking && fraction >= 1;
  const secondsLeft = tracking ? Math.max(0, Math.ceil((DELIVERY_DURATION_MS - elapsed) / 1000)) : 0;

  return (
    <TrackingContext.Provider value={{ tracking, startTracking, stopTracking, fraction, arrived, secondsLeft }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  return useContext(TrackingContext);
}
