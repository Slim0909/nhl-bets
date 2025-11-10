'use client';

import { useEffect, useState } from 'react';

// Types min pour parser TheOddsAPI
type Outcome = { name: string; price: number; point?: number };
type Market = { key: string; outcomes: Outcome[] };
type Bookmaker = { title: string; markets: Market[] };
type OddsGame = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

type ApiResp =
  | { ok: true; games: OddsGame[] }
  | { ok: false; status?: number; error?: string };

// Trouve la meilleure cote moneyline pour domicile / extérieur
function bestH2HPrices(game: OddsGame) {
  let bestHome = { price: -Infinity, book: '' };
  let bestAway = { price: -Infinity, book: '' };

  for (const b of game.bookmakers || []) {
    const m = (b.markets || []).find((mm) => mm.key === 'h2h');
    if (!m) continue;
    for (const o of m.outcomes || []) {
      if (o.name === game.home_team && o.price > bestHome.price) {
        bestHome = { price: o.price, book: b.title };
      }
      if (o.name === game.away_team && o.price > bestAway.price) {
        bestAway = { price: o.price, book: b.title };
      }
    }
  }
  return { bestHome, bestAway };
}

export default function Page() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/odds/today', { cache: 'no-store' });
        const json = (await res.json()) as ApiResp;
        setData(json);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();
  }, []);

  if (err) {
    return (
      <main className="p-8">
        <h1 className="text-4xl font-bold mb-6">NHL Bets — Live Odds (TheOddsAPI)</h1>
        <p className="text-red-400">Erreur réseau: {err}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-8">
        <h1 className="text-4xl font-bold mb-6">NHL Bets — Live Odds (TheOddsAPI)</h1>
        <p className="opacity-70">Chargement…</p>
      </main>
    );
  }

  if (!data.ok) {
    return (
      <main className="p-8">
        <h1 className="text-4xl font-bold mb-6">NHL Bets — Live Odds (TheOddsAPI)</h1>
        <p className="text-red-400">
          API en erreur — status: {data.status ?? '?'} | {data.error ?? 'unknown error'}
        </p>
      </main>
    );
  }

  const games = data.games || [];
  if (games.length === 0) {
    return (
      <main className="p-8">
        <h1 className="text-4xl font-bold mb-6">NHL Bets — Live Odds (TheOddsAPI)</h1>
        <p className="opacity-70 mb-4">
          Source: /api/odds/today — meilleures cotes moneyline par équipe.
        </p>
        <div className="border border-neutral-700 rounded-xl p-6">
          Aucune rencontre disponible (ou l’API ne répond pas).
        </div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-4xl font-bold mb-4">NHL Bets — Live Odds (TheOddsAPI)</h1>
      <p className="opacity-70 mb-6">
        Source: /api/odds/today — meilleures cotes moneyline par équipe.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {games.map((g) => {
          const { bestHome, bestAway } = bestH2HPrices(g);
          const dt = new Date(g.commence_time);
          const when = isNaN(dt.getTime()) ? g.commence_time : dt.toLocaleString();

          return (
            <div key={g.id} className="border border-neutral-700 rounded-xl p-5">
              <div className="text-sm opacity-70 mb-1">{when}</div>
              <div className="text-xl font-semibold mb-3">
                {g.away_team} @ {g.home_team}
              </div>
              <div className="text-sm">
                <div className="mb-1">
                  <span className="opacity-70">Home: </span>
                  <span className="font-medium">
                    {bestHome.price > 0 ? bestHome.price.toFixed(2) : '—'}
                  </span>
                  {bestHome.book && <span className="opacity-70"> — {bestHome.book}</span>}
                </div>
                <div>
                  <span className="opacity-70">Away: </span>
                  <span className="font-medium">
                    {bestAway.price > 0 ? bestAway.price.toFixed(2) : '—'}
                  </span>
                  {bestAway.book && <span className="opacity-70"> — {bestAway.book}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

