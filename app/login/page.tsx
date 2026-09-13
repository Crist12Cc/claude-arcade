"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
/** Traduce los errores de Supabase Auth a mensajes en español. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Usuario o contraseña incorrectos.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (m.includes("password should be at least"))
    return "La contraseña es demasiado corta (mínimo 6 caracteres).";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "El correo electrónico no es válido.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado.";
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    const { error: authError } =
      tab === "in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
        : await supabase.auth.signUp({
            email: email.trim(),
            password: pass,
            options: { data: { username: user.trim() } },
          });
    if (authError) {
      setError(translateAuthError(authError.message));
      setSending(false);
      return;
    }
    router.push("/");
    router.refresh();
  };
  /** Invitado: no crea cuenta en Supabase, solo entra sin sesión. */
  const playAsGuest = () => {
    router.push("/");
  };
  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => switchTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => switchTab("up")}>
            CREAR CUENTA
          </button>
        </div>
        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            className="btn lg"
            type="submit"
            disabled={sending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {sending ? "CONECTANDO…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>
        </form>
        {error && (
          <div className="auth-error" role="alert">
            ▸ {error}
          </div>
        )}
        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>
        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" disabled title="Próximamente">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button" disabled title="Próximamente">
            ▣ GITHUB
          </button>
        </div>
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
