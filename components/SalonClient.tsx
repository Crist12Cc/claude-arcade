'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/useSession';
interface GameTab {
  id: string;
  title: string;
}
interface Row {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export default function SalonClient({ games }: { games: GameTab[] }) {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState(games[0]?.id ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [you, setYou] = useState<{ rank: number; score: number } | null>(null);
  const game = games.find((g) => g.id === tab);
  useEffect(() => {
    if (!tab) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: scoresData } = await supabase
        .from('scores')
        .select('score, created_at, profiles(username)')
        .eq('game_id', tab)
        .order('score', { ascending: false })
        .limit(12);
      const topRows: Row[] = (scoresData ?? []).map((r, i) => {
        const profile = r.profiles as unknown as { username: string } | null;
        return {
          rank: i + 1,
          name: profile?.username ?? 'JUGADOR',
          score: r.score,
          date: new Date(r.created_at).toLocaleDateString('es-ES'),
        };
      });
      let youRow: { rank: number; score: number } | null = null;
      if (user) {
        const { data: mine } = await supabase
          .from('scores')
          .select('score')
          .eq('game_id', tab)
          .eq('user_id', user.id)
          .order('score', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mine) {
          const { count } = await supabase
            .from('scores')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', tab)
            .gt('score', mine.score);
          youRow = { rank: (count ?? 0) + 1, score: mine.score };
        }
      }
      if (!active) return;
      setRows(topRows);
      setYou(youRow);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [tab, user, supabase]);
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>
      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={'chip' + (tab === g.id ? ' active' : '')}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>
      {!loading && rows.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: 'var(--ink-faint)',
          }}
        >
          AÚN NO HAY PUNTUACIONES REGISTRADAS
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{rows[1]?.name ?? '—'}</div>
              <div className="score">
                {(rows[1]?.score ?? 0).toLocaleString('es-ES')}
              </div>
              <div className="date">{rows[1]?.date ?? ''}</div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: 'var(--gold)',
                  letterSpacing: '0.18em',
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{rows[0].name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {rows[0].score.toLocaleString('es-ES')}
              </div>
              <div className="date">{rows[0].date}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{rows[2]?.name ?? '—'}</div>
              <div className="score">
                {(rows[2]?.score ?? 0).toLocaleString('es-ES')}
              </div>
              <div className="date">{rows[2]?.date ?? ''}</div>
            </div>
          </div>
          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={
                  'tr' +
                  (i === 0
                    ? ' top1'
                    : i === 1
                      ? ' top2'
                      : i === 2
                        ? ' top3'
                        : '')
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString('es-ES')}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && you && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game?.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: 'var(--yellow)' }}>
                    #{String(you.rank).padStart(2, '0')}
                  </div>
                  <div className="pl" style={{ color: 'var(--yellow)' }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: 'var(--yellow)',
                      textShadow: '0 0 6px rgba(245,255,0,0.5)',
                    }}
                  >
                    {you.score.toLocaleString('es-ES')}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
