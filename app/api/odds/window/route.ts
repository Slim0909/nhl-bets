import { NextResponse } from "next/server";

// GET /api/odds/window?hours=24
export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const hours = Math.max(1, Math.min(72, Number(urlObj.searchParams.get("hours") || 24)));
  const key = process.env.THEODDSAPI_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing THEODDSAPI_KEY" }, { status: 500 });
  }

  const sport = "icehockey_nhl";
  const url =
    `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=us&markets=h2h,totals&oddsFormat=decimal&apiKey=${key}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, data }, { status: res.status });
    }

    const now = Date.now();
    const cutoff = now + hours * 3600_000;

    function bestH2H(game: any) {
      let bestHome = { price: -Infinity, book: "" };
      let bestAway = { price: -Infinity, book: "" };
      let sumHome = 0, nHome = 0, sumAway = 0, nAway = 0;

      for (const b of game.bookmakers ?? []) {
        const m = (b.markets ?? []).find((mm: any) => mm.key === "h2h");
        if (!m) continue;
        for (const o of m.outcomes ?? []) {
          if (o.name === game.home_team) { sumHome += o.price; nHome++; if (o.price > bestHome.price) bestHome = { price: o.price, book: b.title }; }
          if (o.name === game.away_team) { sumAway += o.price; nAway++; if (o.price > bestAway.price) bestAway = { price: o.price, book: b.title }; }
        }
      }
      return { bestHome, bestAway, avgHome: nHome ? sumHome / nHome : null, avgAway: nAway ? sumAway / nAway : null };
    }

    function bestTotals(game: any) {
      let bestOver = { price: -Infinity, point: null as number | null, book: "" };
      let bestUnder = { price: -Infinity, point: null as number | null, book: "" };
      for (const b of game.bookmakers ?? []) {
        const m = (b.markets ?? []).find((mm: any) => mm.key === "totals");
        if (!m) continue;
        for (const o of m.outcomes ?? []) {
          if (o.name === "Over"  && o.price > bestOver.price)  bestOver  = { price: o.price, point: o.point ?? null, book: b.title };
          if (o.name === "Under" && o.price > bestUnder.price) bestUnder = { price: o.price, point: o.point ?? null, book: b.title };
        }
      }
      const line =
        bestOver.point && bestUnder.point && bestOver.point === bestUnder.point
          ? bestOver.point
          : bestOver.point ?? bestUnder.point ?? null;
      return { bestOver, bestUnder, line };
    }

    const games = (data as any[])
      .filter((g) => {
        const t = Date.parse(g.commence_time);
        return !Number.isNaN(t) && t >= now && t <= cutoff;
      })
      .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))
      .map((g) => {
        const h2h = bestH2H(g);
        const totals = bestTotals(g);
        const impliedHome = h2h.bestHome.price > 0 ? 100 / h2h.bestHome.price : null;
        const impliedAway = h2h.bestAway.price > 0 ? 100 / h2h.bestAway.price : null;
        return {
          id: g.id,
          commence_time: g.commence_time,
          home_team: g.home_team,
          away_team: g.away_team,
          h2h: { bestHome: h2h.bestHome, bestAway: h2h.bestAway, avgHome: h2h.avgHome, avgAway: h2h.avgAway, impliedHome, impliedAway },
          totals: { line: totals.line, bestOver: totals.bestOver, bestUnder: totals.bestUnder },
        };
      });

    return NextResponse.json({ ok: true, hours, count: games.length, games });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "fetch_failed" }, { status: 500 });
  }
}
