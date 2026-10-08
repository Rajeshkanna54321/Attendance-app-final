import { Device } from "@capacitor/device";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const KEY = "qra_auth";

export const getAuth = () => JSON.parse(localStorage.getItem(KEY) || "null");
export const setAuth = (a) => (a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY));
export const deviceId = async () => (await Device.getId()).identifier;

const send = (path, { method = "GET", body, auth = true } = {}) => {
  const headers = { "Content-Type": "application/json" };
  const a = getAuth();
  if (auth && a) headers.Authorization = `Bearer ${a.access}`;
  return fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
};

export async function api(path, opts = {}) {
  let res = await send(path, opts);
  if (res.status === 401 && opts.auth !== false && getAuth()) {
    const r = await send("/auth/token/refresh/", { method: "POST", body: { refresh: getAuth().refresh }, auth: false });
    if (r.ok) {
      setAuth({ ...getAuth(), access: (await r.json()).access });
      res = await send(path, opts);
    } else {
      setAuth(null);
      location.reload();
    }
  }
  if (opts.blob) {
    if (!res.ok) throw new Error("Download failed");
    return res.blob();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = Object.values(data).flat()[0];
    const e = new Error(data.detail || (typeof first === "string" ? first : "Request failed"));
    e.data = data;
    throw e;
  }
  return data;
}
