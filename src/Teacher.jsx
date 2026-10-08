import { Geolocation } from "@capacitor/geolocation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { exportExcel } from "./exportFile";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function Live({ id, subject, onClose }) {
  const [token, setToken] = useState("");
  const [live, setLive] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {              // QR rotation: re-fetch exactly when the current 3 s slot ends
    let stop = false, t;
    const tick = async () => {
      try {
        const r = await api(`/sessions/${id}/qr/`);
        if (stop) return;
        setToken(r.token); setErr("");
        t = setTimeout(tick, Math.max(300, r.refresh_in * 1000));
      } catch (e) { if (!stop) { setErr(e.message); t = setTimeout(tick, 2000); } }
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [id]);

  useEffect(() => {              // live present list
    const load = () => api(`/sessions/${id}/live/`).then(setLive).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [id]);

  const end = async () => { await api(`/sessions/${id}/end/`, { method: "POST" }); onClose(); };

  return (
    <>
      <h2>{subject}</h2>
      <div className="qr">{token ? <QRCodeSVG value={token} size={280} /> : <p>Loading QR...</p>}</div>
      {err && <p className="error">{err}</p>}
      <p className="count">{live ? live.present_count : 0} present</p>
      <div className="list">
        {live?.students.map((s) => (
          <div className="row" key={s.roll_number}><span>{s.roll_number} · {s.name}</span>
            <small>{new Date(s.marked_at).toLocaleTimeString()}</small></div>
        ))}
      </div>
      <button onClick={() => exportExcel(`/sessions/${id}/export/`, `attendance_${subject}_${id}.xlsx`).catch((e) => setErr(e.message))}>Export / Share Excel</button>
      <button className="danger" onClick={end}>End session</button>
      <button className="link" onClick={onClose}>Back (keep session open)</button>
    </>
  );
}

export default function Teacher() {
  const [active, setActive] = useState(null);
  const [subject, setSubject] = useState("");
  const [radius, setRadius] = useState(30);
  const [minutes, setMinutes] = useState(60);
  const [date, setDate] = useState(today());
  const [sessions, setSessions] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api(`/sessions/?date=${date}`).then(setSessions).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [date, active]);

  const start = async () => {
    setErr(""); setBusy(true);
    try {
      try { await Geolocation.requestPermissions(); } catch {}
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      const s = await api("/sessions/", { method: "POST", body: {
        subject, latitude: p.coords.latitude, longitude: p.coords.longitude,
        radius_m: Number(radius), duration_minutes: Number(minutes) } });
      if (p.coords.accuracy > 30) setErr(`Warning: your GPS accuracy is ${Math.round(p.coords.accuracy)} m. Students may be rejected near the edge.`);
      setActive(s);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (active) return <Live id={active.id} subject={active.subject} onClose={() => setActive(null)} />;

  return (
    <>
      <h3>Start a class</h3>
      <p className="muted">Stand where students sit. Your current location becomes the class centre.</p>
      <input placeholder="Subject (e.g. DBMS)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="two">
        <label>Radius (m)<input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
        <label>Duration (min)<input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
      </div>
      <button disabled={busy || !subject} onClick={start}>{busy ? "Getting location..." : "Start & show QR"}</button>
      {err && <p className="error">{err}</p>}

      <h3>Records</h3>
      <div className="two">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="secondary" onClick={() => exportExcel(`/export/?date=${date}`, `attendance_${date}.xlsx`).catch((e) => setErr(e.message))}>Export day</button>
      </div>
      {sessions.length === 0 && <p className="muted">No classes on this date.</p>}
      {sessions.map((s) => (
        <div className="row" key={s.id}>
          <span>{s.subject}<br /><small>{new Date(s.started_at).toLocaleTimeString()} · {s.present_count} present</small></span>
          <span>
            {s.is_open && <button className="small" onClick={() => setActive(s)}>Open</button>}
            <button className="small secondary" onClick={() => exportExcel(`/sessions/${s.id}/export/`, `attendance_${s.subject}_${s.id}.xlsx`).catch((e) => setErr(e.message))}>Excel</button>
          </span>
        </div>
      ))}
    </>
  );
}
