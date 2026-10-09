import { useState } from "react";
import { api, deviceId } from "./api";

export default function Login({ onLogin }) {
  const [step, setStep] = useState("email");
  const [f, setF] = useState({ email: "", otp: "", name: "", roll: "", role: "student" });
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState("");
  const [errType, setErrType] = useState("error"); // "error" | "device"
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (fn) => {
    setErr(""); setBusy(true);
    try { await fn(); } catch (e) {
      // Device binding errors (403) get a special warning style
      const code = e.data?.code || e.data?.detail?.code;
      const isDeviceErr = ["account_bound_elsewhere", "device_in_use", "device_cooldown"].includes(code);
      setErrType(isDeviceErr ? "device" : "error");
      setErr(e.message);
    }
    setBusy(false);
  };

  const requestOtp = () => run(async () => {
    const d = await api("/auth/otp/request/", { method: "POST", auth: false, body: { email: f.email } });
    setIsNew(d.is_new_user);
    setStep("otp");
  });

  const verify = () => run(async () => {
    const d = await api("/auth/otp/verify/", {
      method: "POST", auth: false,
      body: { email: f.email, otp: f.otp, device_id: await deviceId(), name: f.name, roll_number: f.roll, role: f.role },
    });
    onLogin(d);
  });

  const deviceErrStyle = {
    background: "#fff3cd", color: "#856404", border: "1px solid #ffc107",
    borderRadius: "8px", padding: "10px 14px", marginTop: "10px",
    fontSize: "14px", textAlign: "left", lineHeight: "1.5"
  };
  const normalErrStyle = { color: "#e74c3c", marginTop: "8px", fontSize: "14px" };

  return (
    <div className="app center">
      <h1>QR Attendance</h1>
      {step === "email" ? (
        <>
          <input type="email" placeholder="Email" value={f.email} onChange={set("email")} />
          <button disabled={busy || !f.email} onClick={requestOtp}>{busy ? "Sending..." : "Send OTP"}</button>
        </>
      ) : (
        <>
          <p className="muted">OTP sent to {f.email}</p>
          {isNew && (
            <>
              <select value={f.role} onChange={set("role")} style={{ width: "100%", padding: "10px", margin: "5px 0", borderRadius: "5px", border: "1px solid #ccc" }}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              <input placeholder="Full name" value={f.name} onChange={set("name")} />
              {f.role === "student" && <input placeholder="Roll number" value={f.roll} onChange={set("roll")} />}
            </>
          )}
          <input inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={f.otp} onChange={set("otp")} />
          <button disabled={busy || f.otp.length < 6 || (isNew && (!f.name || (f.role === "student" && !f.roll)))} onClick={verify}>
            {busy ? "Checking..." : isNew ? "Sign up" : "Log in"}
          </button>
          <button className="link" onClick={() => setStep("email")}>Change email</button>
        </>
      )}
      {err && (
        errType === "device"
          ? <div style={deviceErrStyle}>⚠️ <strong>Device Issue:</strong><br />{err}<br /><small>Contact your teacher or admin to reset your device.</small></div>
          : <p className="error" style={normalErrStyle}>{err}</p>
      )}
    </div>
  );
}
