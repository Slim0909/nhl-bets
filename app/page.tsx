'use client';
import { useEffect, useState } from 'react';

type PriceBook = { price: number; book: string };
type TotSide = { price: number; point: number | null; book: string };
type GameRow = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  h2h: { bestHome: PriceBook; bestAway: PriceBook; avgHome: number|null; avgAway: number|null; impliedHome: number|null; impliedAway: number|null; };
  totals: { line: number|null; bestOver: TotSide; bestUnder: TotSide; };
};
type ApiResp = { ok:true; hours:number; count:number; games:GameRow[] } | { ok:false; status?:number; error?:string };

const fmtPct = (n:number|null|undefined)=> n==null? '—' : `${n.toFixed(1)}%`;
const fmtOdds = (n:number|null|undefined)=> n==null? '—' : n.toFixed(2);

export default function Page(){
  const [data,setData]=useState<ApiResp|null>(null);
  const [err,setErr]=useState<string|null>(null);

  useEffect(()=>{ (async()=>{
    try{ const r=await fetch('/api/odds/window?hours=24',{cache:'no-store'}); setData(await r.json()); }
    catch(e:any){ setErr(String(e?.message??e)); }
  })(); },[]);

  return (
    <main className="p-6 md:p-8">
      <h1 className="text-4xl font-bold mb-2">NHL Bets — Live Odds (TheOddsAPI)</h1>
      <p className="opacity-70 mb-6">Fenêtre : prochaines 24h — source <code>/api/odds/window?hours=24</code>.</p>

      {err && <div className="text-red-400 mb-4">Erreur : {err}</div>}
      {!data && !err && <div className="opacity-70">Chargement…</div>}
      {data && !('ok' in data && data.ok) && (
        <div className="text-red-400 mb-4">API en erreur — status {('status'in data)&&data.status} {('error'in data)&&data.error}</div>
      )}

      {data && 'ok' in data && data.ok && (
        <>
          <div className="mb-3 opacity-70">{data.count} rencontres trouvées.</div>
          <div className="overflow-x-auto border border-neutral-700 rounded-xl">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-neutral-900/40">
                <tr className="text-left">
                  <th className="p-3">Date</th><th className="p-3">Match</th>
                  <th className="p-3">Home (best)</th><th className="p-3">Away (best)</th>
                  <th className="p-3">Proba Home</th><th className="p-3">Proba Away</th>
                  <th className="p-3">Moy. Home</th><th className="p-3">Moy. Away</th>
                  <th className="p-3">Totals</th><th className="p-3">Over (best)</th><th className="p-3">Under (best)</th>
                </tr>
              </thead>
              <tbody>
                {data.games.map((g)=>{
                  const dt=new Date(g.commence_time);
                  const when=isNaN(dt.getTime())?g.commence_time:dt.toLocaleString();
                  return (
                    <tr key={g.id} className="border-t border-neutral-800">
                      <td className="p-3 whitespace-nowrap">{when}</td>
                      <td className="p-3 font-medium">{g.away_team} @ {g.home_team}</td>
                      <td className="p-3">{fmtOdds(g.h2h.bestHome.price)} <span className="opacity-70">— {g.h2h.bestHome.book}</span></td>
                      <td className="p-3">{fmtOdds(g.h2h.bestAway.price)} <span className="opacity-70">— {g.h2h.bestAway.book}</span></td>
                      <td className="p-3">{fmtPct(g.h2h.impliedHome)}</td>
                      <td className="p-3">{fmtPct(g.h2h.impliedAway)}</td>
                      <td className="p-3">{g.h2h.avgHome?fmtOdds(g.h2h.avgHome):'—'}</td>
                      <td className="p-3">{g.h2h.avgAway?fmtOdds(g.h2h.avgAway):'—'}</td>
                      <td className="p-3">{g.totals.line ?? '—'}</td>
                      <td className="p-3">{fmtOdds(g.totals.bestOver.price)} <span className="opacity-70">— {g.totals.bestOver.point ?? g.totals.line ?? ''} ({g.totals.bestOver.book})</span></td>
                      <td className="p-3">{fmtOdds(g.totals.bestUnder.price)} <span className="opacity-70">— {g.totals.bestUnder.point ?? g.totals.line ?? ''} ({g.totals.bestUnder.book})</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs opacity-60">* Probas = 100 / cote décimale (non normalisées). « Moy. » = moyenne simple des cotes par bookmaker.</p>
        </>
      )}
    </main>
  );
}
