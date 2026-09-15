'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
/** Traduce los errores de Supabase Auth a mensajes en español. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'Usuario o contraseña incorrectos.';
  if (
    m.includes('user already registered') ||
    m.includes('already been registered')
  )
    return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (m.includes('password should be at least'))
    return 'La contraseña es demasiado corta (mínimo 6 caracteres).';
  if (m.includes('invalid email') || m.includes('unable to validate email'))
    return 'El correo electrónico no es válido.';
  if (m.includes('email not confirmed'))
    return 'Tu correo aún no está confirmado.';
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const redirectTarget = searchParams.get('redirect') || '/';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    if (tab === 'in') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (authError) {
        setError(translateAuthError(authError.message));
        setSending(false);
        return;
      }
      router.push(redirectTarget);
      router.refresh();
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { username: user.trim() } },
    });
    if (authError) {
      setError(translateAuthError(authError.message));
      setSending(false);
      return;
    }
    if (!data.session) {
      // "Confirm email" está activo: no hay sesión hasta que el usuario
      // confirme el correo desde el link enviado por Supabase.
      setAwaitingConfirmation(true);
      setSending(false);
      return;
    }
    router.push(redirectTarget);
    router.refresh();
  };
  /** Invitado: no crea cuenta en Supabase, solo entra sin sesión. */
  const playAsGuest = () => {
    router.push('/');
  };
  const signInWithProvider = async (provider: 'google' | 'github') => {
    setError(null);
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('redirect_to', redirectTarget);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl.toString() },
    });
    if (authError) setError(translateAuthError(authError.message));
  };
  const switchTab = (next: 'in' | 'up') => {
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
            style={{
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.16em',
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        {awaitingConfirmation ? (
          <div className="auth-error" role="status" style={{ marginTop: 16 }}>
            ▸ Revisa tu correo para confirmar tu cuenta. Una vez confirmado,
            podrás iniciar sesión.
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={tab === 'in' ? 'on' : ''}
                onClick={() => switchTab('in')}
              >
                INICIAR SESIÓN
              </button>
              <button
                className={tab === 'up' ? 'on' : ''}
                onClick={() => switchTab('up')}
              >
                CREAR CUENTA
              </button>
            </div>
            <form onSubmit={submit}>
              {tab === 'up' && (
                <div className="field">
                  <label>Usuario</label>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="px_kai"
                  />
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
                style={{ width: '100%', marginTop: 8 }}
              >
                {sending
                  ? 'CONECTANDO…'
                  : tab === 'in'
                    ? 'ENTRAR AL VAULT'
                    : 'CREAR Y JUGAR'}
              </button>
            </form>
            {error && (
              <div className="auth-error" role="alert">
                ▸ {error}
              </div>
            )}
            <button
              className="btn ghost"
              style={{ width: '100%', marginTop: 10 }}
              onClick={playAsGuest}
            >
              JUGAR COMO INVITADO
            </button>
            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                onClick={() => signInWithProvider('google')}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => signInWithProvider('github')}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}
        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
