'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game } from '@/lib/data';
import { useSession } from '@/lib/useSession';
import { createClient } from '@/lib/supabase/client';
import {
  createAsteroidsEngine,
  type AsteroidsEngine,
} from '@/lib/games/asteroids/engine';
import {
  createTetrisEngine,
  type TetrisEngine,
} from '@/lib/games/tetris/engine';
import {
  createBloqueBusterEngine,
  type BloqueBusterEngine,
} from '@/lib/games/bloque-buster/engine';
type EngineState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};
type Engine = AsteroidsEngine | TetrisEngine | BloqueBusterEngine;
const ENGINES: Record<
  string,
  (
    canvas: HTMLCanvasElement,
    onStateChange: (state: EngineState) => void
  ) => Engine
> = {
  rocas: createAsteroidsEngine,
  caida: createTetrisEngine,
  'bloque-buster': createBloqueBusterEngine,
};
export default function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const engineFactory = ENGINES[game.id];
  const hasEngine = !!engineFactory;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const level = hasEngine ? engineLevel : Math.floor(score / 2500) + 1;
  const name = user ? user.name : 'INVITADO';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const gameOverHandledRef = useRef(false);
  useEffect(() => {
    if (hasEngine) return;
    if (over || paused) return;
    const t = setInterval(() => {
      setScore((s) => s + Math.floor(10 + Math.random() * 90));
    }, 220);
    return () => clearInterval(t);
  }, [hasEngine, over, paused]);
  useEffect(() => {
    if (!engineFactory || !canvasRef.current) return;
    gameOverHandledRef.current = false;
    const engine = engineFactory(canvasRef.current, (state) => {
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
  }, [engineFactory]);
  useEffect(() => {
    if (hasEngine) engineRef.current?.setPaused(paused || over);
  }, [hasEngine, paused, over]);
  const endGame = () => setOver(true);
  const restart = () => {
    if (hasEngine) {
      gameOverHandledRef.current = false;
      engineRef.current?.restart();
    } else {
      setScore(0);
    }
    setPaused(false);
    setOver(false);
    setSaved(false);
  };
  const saveScore = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('scores')
      .insert({ game_id: game.id, user_id: user.id, score });
    if (!error) setSaved(true);
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
          {hasEngine ? (
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
              user ? (
                <div className="input-row">
                  <button className="btn yellow" onClick={saveScore}>
                    GUARDAR PUNTUACIÓN
                  </button>
                </div>
              ) : (
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    letterSpacing: '0.08em',
                    marginTop: 14,
                  }}
                >
                  INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN
                  <br />
                  <Link
                    href="/login"
                    className="btn ghost"
                    style={{ marginTop: 10 }}
                  >
                    IR A INICIAR SESIÓN →
                  </Link>
                </div>
              )
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
