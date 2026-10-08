import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { api, deviceId } from "./api";
import { useGps } from "./useGps";

const SCAN_IDLE_MS = 5 * 60 * 1000; // scanner closes itself after 5 minutes (saves battery, stops stale GPS use)

function Scanner({ onCode, onFail }) {
  useEffect(() => {
    const q = new Html5Qrcode("reader");
    let done = false;
    q.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
      if (done) return;
      done = true;
      q.stop().catch(() => {}).finally(() => onCode(text));
    }, () => {}).catch((e) => onFail("Camera error: " + e));
    return () => { try { if (q.isScanning) q.stop().catch(() => {}); } catch {} };
  }, []);
  return <div id="reader" />;
}

export default function Student() {
  const [view, setView] = useState("home");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const dev = useRef(null);
  const idleTimer = useRef(null);
  const gps = useGps();

  const loadHistory = () => api("/attendance/my/").then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); deviceId().then((d) => (dev.current = d)); }, []);

  const closeScanner = (msg) => {
    clearTimeout(idleTimer.current);
    gps.stop();
    setView("home");
    if (msg) setResult({ ok: false, msg });
  };

  // Close the scanner if the app goes to the background.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && view === "scan") closeScanner("Scanner closed because the app went to the background.");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); clearTimeout(idleTimer.current); };
  }, [view]);

  const openScanner = async () => {
    setResult(null);
    await gps.start();
    idleTimer.current = setTimeout(
      () => closeScanner("Scanner closed after 5 minutes. Tap Scan to start again."), SCAN_IDLE_MS);
    setView("scan");
  };

  const onCode = async (token) => {
    const f = gps.getFix();          // read the fix first, then shut GPS down
    closeScanner();
    if (f.error === "no_fix") return setResult({ ok: false, msg: "GPS not ready yet. Keep the scanner open a few seconds, then retry." });
    if (f.error === "stale") return setResult({ ok: false, msg: "Your location is outdated. Check GPS is on, wait a few seconds, then scan again." });
    try {
      const r = await api("/attendance/scan/", { method: "POST", body: {
        token, device_id: dev.current, latitude: f.coords.latitude, longitude: f.coords.longitude,
        accuracy: f.coords.accuracy, is_mock: false } });
      setResult({ ok: true, msg: r.already_marked ? "Already marked present." : `Present: ${r.subject}` });
      loadHistory();
    } catch (e) { setResult({ ok: false, msg: e.message }); }
  };

  if (view === "scan") {
    return (
      <>
        <p className="muted">Point the camera at the QR on your teacher's screen</p>
        <Scanner onCode={onCode} onFail={(m) => closeScanner(m)} />
        <button className="secondary" onClick={() => closeScanner()}>Cancel</button>
      </>
    );
  }
  return (
    <>
      <button className="big" onClick={openScanner}>Scan QR to mark attendance</button>
      {result && <div className={result.ok ? "ok" : "error box"}>{result.msg}</div>}
      <h3>My attendance</h3>
      {history.length === 0 && <p className="muted">No records yet.</p>}
      {history.map((h, i) => (
        <div className="row" key={i}><span>{h.subject}</span><small>{new Date(h.marked_at).toLocaleString()}</small></div>
      ))}
    </>
  );
}
