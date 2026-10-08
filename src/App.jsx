import { useState } from "react";
import { api, getAuth, setAuth } from "./api";
import Login from "./Login.jsx";
import Student from "./Student.jsx";
import Teacher from "./Teacher.jsx";

export default function App() {
  const [auth, setAuthState] = useState(getAuth());

  const onLogin = (data) => { setAuth(data); setAuthState(data); };
  const logout = async () => {
    try { await api("/auth/logout/", { method: "POST", body: { refresh: auth.refresh } }); } catch {}
    setAuth(null);
    setAuthState(null);
  };

  if (!auth) return <Login onLogin={onLogin} />;
  const { user } = auth;
  return (
    <div className="app">
      <header>
        <div><b>{user.name}</b><small>{user.role === "student" ? ` · ${user.roll_number}` : ` · ${user.role}`}</small></div>
        <button className="link" onClick={logout}>Logout</button>
      </header>
      {user.role === "student" ? <Student /> : <Teacher />}
    </div>
  );
}
