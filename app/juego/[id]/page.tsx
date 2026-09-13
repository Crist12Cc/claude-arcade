import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Game } from '@/lib/data';
interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export default async function GameDetailPage(props: PageProps<'/juego/[id]'>) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: gameData } = await supabase
    .from('games_with_stats')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const game = gameData as Game | null;
  if (!game) notFound();
  const { data: scoresData } = await supabase
    .from('scores')
    .select('score, created_at, profiles(username)')
    .eq('game_id', id)
    .order('score', { ascending: false })
    .limit(10);
  const scores: LeaderboardRow[] = (scoresData ?? []).map((row, i) => {
    const profile = row.profiles as unknown as { username: string } | null;
    return {
      rank: i + 1,
      name: profile?.username ?? 'JUGADOR',
      score: row.score,
      date: new Date(row.created_at).toLocaleDateString('es-ES'),
    };
  });
  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={'cover-bg ' + game.cover} />
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: 'var(--magenta)',
                  textShadow: '0 0 6px rgba(255,0,110,0.5)',
                }}
              >
                {game.best.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/jugar/${game.id}`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>
      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div
              style={{
                padding: '24px 0',
                color: 'var(--ink-faint)',
                textAlign: 'center',
              }}
            >
              AÚN NO HAY PUNTUACIONES REGISTRADAS
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={`${r.name}-${r.rank}`}
              className={
                'lb-row' +
                (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '')
              }
            >
              <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString('es-ES')}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
