import React from "react";
import { adminLogin } from "./AdminAuth";

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const r = await adminLogin(email.trim(), password);
    setLoading(false);

    if (!r.ok) {
      setErr("Email o password incorrecto.");
      return;
    }
    onSuccess();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form onSubmit={submit} style={{ width: 360, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ margin: 0 }}>Admin Login</h2>
        <p style={{ marginTop: 8, color: "#666" }}>Ingresa con tu correo y password.</p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginTop: 12, padding: 10 }}
          autoComplete="username"
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginTop: 12, padding: 10 }}
          autoComplete="current-password"
        />

        {err ? <div style={{ color: "crimson", marginTop: 10 }}>{err}</div> : null}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", marginTop: 14, padding: 10 }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
