// app/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// Helpers d'affichage
function fmtOdds(x?: number) {
  if (x == null || Number.isNaN(x)) return "—";
  return Number(x).toFixed(2);
}
function fmtPct(x?: number) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${Number(x).toFixed(1)}%`;
}

export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/odds/window?hours=24`, {
    cache: "no-store",
  }).catch(() => null);

  const data = res && res.ok ? await res.json() : { games: [] as any[] };

  return (
    <div className="container" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>NHL Bets — Live Odds (TheOddsAPI)</h1>
      <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
        Fenêtre : prochaines 24h — source <code>/api/odds/window?hours=24</code>.
      </div>

      <table
        className="table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={th}>Date</th>
            <th style={th}>Match</th>
            <th style={th}>Home (best)</th>
            <th style={th}>Away (best)</th>
            <th style={th}>Proba Home</th>
            <th style={th}>Proba Away</th>
            <th style={th}>Moy. Home</th>
            <th style={th}>Moy. Away</th>
            <th style={th}>Totals</th>
            <th style={th}>Over (best)</th>
            <th style={th}>Under (best)</th>
          </tr>
        </thead>
        <tbody>
          {data.games?.length
            ? data.games.map((g: any) => {
                const dt = new Date(g.commence_time);
                const when = isNaN(dt.getTime()) ? g.commence_time : dt.toLocaleString();
                const href = `/match?home=${encodeURIComponent(g.home_team)}&away=${encodeURIComponent(
                  g.away_team
                )}&ts=${encodeURIComponent(g.commence_time)}`;

                return (
                  <tr key={g.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={td}>{when}</td>
                    <td style={td}>
                      <Link href={href}>
                        <b>{g.away_team} @ {g.home_team}</b>
                      </Link>
                    </td>
                    <td style={td}>
                      {fmtOdds(g.h2h?.bestHome?.price)}{" "}
                      <span style={muted}>— {g.h2h?.bestHome?.book ?? "—"}</span>
                    </td>
                    <td style={td}>
                      {fmtOdds(g.h2h?.bestAway?.price)}{" "}
                      <span style={muted}>— {g.h2h?.bestAway?.book ?? "—"}</span>
                    </td>
                    <td style={td}>{fmtPct(g.h2h?.impliedHome)}</td>
                    <td style={td}>{fmtPct(g.h2h?.impliedAway)}</td>
                    <td style={td}>{g.h2h?.avgHome ? fmtOdds(g.h2h.avgHome) : "—"}</td>
                    <td style={td}>{g.h2h?.avgAway ? fmtOdds(g.h2h.avgAway) : "—"}</td>
                    <td style={td}>{g.totals?.line ?? "—"}</td>
                    <td style={td}>
                      {fmtOdds(g.totals?.bestOver?.price)}{" "}
                      <span style={muted}>
                        — {g.totals?.bestOver?.point ?? g.totals?.line ?? ""} ({g.totals?.bestOver?.book ?? "—"})
                      </span>
                    </td>
                    <td style={td}>
                      {fmtOdds(g.totals?.bestUnder?.price)}{" "}
                      <span style={muted}>
                        — {g.totals?.bestUnder?.point ?? g.totals?.line ?? ""} ({g.totals?.bestUnder?.book ?? "—"})
                      </span>
                    </td>
                  </tr>
                );
              })
            : (
              <tr>
                <td style={{ ...td, padding: 18 }} colSpan={11}>
                  Aucune rencontre à afficher.
                </td>
              </tr>
            )}
        </tbody>
      </table>

      <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
        * Probabilités implicites = 100 / cote (non normalisées).
      </div>
    </div>
  );
}

// styles inline simples (fond blanc)
const th: React.CSSProperties = { textAlign: "left", padding: "10px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "10px 8px", verticalAlign: "top" };
const muted: React.CSSProperties = { color: "#6b7280", fontSize: 12 };
