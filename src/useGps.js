import { Geolocation } from "@capacitor/geolocation";
import { useCallback, useEffect, useRef } from "react";

// ---- Tunable limits ----
export const GPS_RESTART_MS = 10 * 60 * 1000; // start a brand-new GPS session at least this often (keep <= 20 min)
export const GPS_POLL_MS = 8 * 1000;          // also ask for a fresh fix this often (browsers only report when you move)
export const MAX_FIX_AGE_MS = 20 * 1000;      // a fix older than this is NEVER used for a scan

/**
 * Keeps a fresh location available while the scanner is open.
 *   start()  -> begin tracking      stop() -> stop tracking (battery)
 *   getFix() -> { coords } if the latest fix is fresh, otherwise { error: "no_fix" | "stale" }
 */
export function useGps() {
  const fix = useRef(null);
  const watchId = useRef(null);
  const timers = useRef({ restart: null, poll: null });

  const save = (p) => { if (p) fix.current = { coords: p.coords, receivedAt: Date.now() }; };

  const poll = async () => {
    try {
      save(await Geolocation.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }));
    } catch { /* keep the previous fix; it will simply go stale if GPS keeps failing */ }
  };

  const beginWatch = async () => {
    if (watchId.current) { await Geolocation.clearWatch({ id: watchId.current }); watchId.current = null; }
    watchId.current = await Geolocation.watchPosition(
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      (p) => save(p),
    );
  };

  const stop = useCallback(() => {
    clearInterval(timers.current.restart);
    clearInterval(timers.current.poll);
    if (watchId.current) { Geolocation.clearWatch({ id: watchId.current }); watchId.current = null; }
  }, []);

  const start = useCallback(async () => {
    stop();
    fix.current = null;
    try { await Geolocation.requestPermissions(); } catch { /* not implemented on web */ }
    await beginWatch();
    poll();
    timers.current.poll = setInterval(poll, GPS_POLL_MS);
    timers.current.restart = setInterval(beginWatch, GPS_RESTART_MS);
  }, [stop]);

  const getFix = useCallback(() => {
    const f = fix.current;
    if (!f) return { error: "no_fix" };
    if (Date.now() - f.receivedAt > MAX_FIX_AGE_MS) return { error: "stale" };
    return { coords: f.coords };
  }, []);

  useEffect(() => stop, [stop]); // stop when the screen is left
  return { start, stop, getFix };
}
