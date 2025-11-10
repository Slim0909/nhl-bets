// app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 30;

import type { CSSProperties } from "react";

// ---------- Types ----------
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

// ---------- Utils ----------
function bestH2HPrices(game: OddsGame) {
  let bestHome = { price: -Infinity as number, book: "" };
  let bestAway = { price: -Infinity as number, book: "" };

  for (const b of game.bookmakers || []) {
    const m = (b.markets || []).find((mm) => mm.key === "h2h");
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

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function getOdds(): Promise<OddsGame[]> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const res = await fetch(`${base}/api/odds/today`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.games ?? []) as OddsGame[];
}

// ---------- Page ----------
export default async function Page() {
  const games = await getOdds();

  return (
    <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        NHL Bets — Live Odds (TheOddsAPI)
      </h1>
      <p style={{ opacity: 0.75, marginBottom: 20 }}>
        Source: /api/odds/today — meilleures cotes moneyline par équipe.
      </p>

      {games.length === 0 ? (
        <div style={emptyBox}>
          Aucune rencontre disponible (ou l’API ne répond pas).
        </div>
      ) : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Match</th>
              <th style={th}>Home — Best ML</th>
              <th style={th}>Away — Best ML</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const { bestHome, bestAway } = bestH2HPrices(g);
              return (
                <tr key={g.id}>
                  <td style={td}>{fmtTime(g.commence_time)}</td>
                  <td style={td}>
                    <strong>{g.home_team}</strong> vs {g.away_team}
                  </td>
                  <td style={td}>
                    {isFinite(bestHome.price)
                      ? `${bestHome.price} (${bestHome.book})`
                      : "—"}
                  </td>
                  <td style={td}>
                    {isFinite(bestAway.price)
                      ? `${bestAway.price} (${bestAway.book})`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

// ---------- styles ----------
const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #333",
  fontWeight: 600,
  fontSize: 14,
};
const td: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #222",
  fontSize: 14,
};
const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  borderSpacing: 0,
};
const emptyBox: CSSProperties = {
  padding: 24,
  border: "1px solid #333",
  borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
};
