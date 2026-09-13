'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Game } from '@/lib/data';
import { useSession } from '@/lib/useSession';
import {
  createAsteroidsEngine,
  type AsteroidsEngine,
} from '@/lib/games/asteroids/engine';
function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const parsed = JSON.parse(localStorage.getItem('av_scores') || '[]');
    const all = Array.isArray(parsed) ? parsed : [];
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem('av_scores', JSON.stringify(all));
  } catch {
    // ignore malformed/unavailable storage
  }
}
const isAsteroids = (game: Game) => game.id === 'rocas';
export default function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const asteroids = isAsteroids(game);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const level = asteroids ? engineLevel : Math.floor(score / 2500) + 1;
  const name = nameOverride ?? (user ? user.name : 'INVITADO');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const gameOverHandledRef = useRef(false);
  useEffect(() => {
    if (asteroids) return;
    if (over || paused) return;
    const t = setInterval(() => {
      setScore((s) => s + Math.floor(10 + Math.random() * 90));
    }, 220);
    return () => clearInterval(t);
  }, [asteroids, over, paused]);
  useEffect(() => {
    if (!asteroids || !canvasRef.current) return;
    gameOverHandledRef.current = false;
    const engine = createAsteroidsEngine(canvasRef.current, (state) => {
      setScore(state.score);
      setLives(state.lives);
      setEngineLevel(state.level);
      if (state.gameOver && !gameOverHandledRef.current) {
        gameOverHandledRef.current = true;
        setOver(true);
      }
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [asteroids]);
  useEffect(() => {
    if (asteroids) engineRef.current?.setPaused(paused);
  }, [asteroids, paused]);
  const endGame = () => setOver(true);
  const restart = () => {
    if (asteroids) {
      gameOverHandledRef.current = false;
      engineRef.current?.restart();
    } else {
      setScore(0);
    }
    setPaused(false);
    setOver(false);
    setSaved(false);
    setNameOverride(null);
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{'♥ '.repeat(lives).trim() || '—'}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juego/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {asteroids ? (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="game-canvas"
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameOverride(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
