// app/page.tsx
import { bestH2HPrices, type OddsGame } from "@/lib/odds";

export const dynamic = "force-dynamic";
export const revalidate = 60;

async function getOdds(): Promise<OddsGame[]> {
  // URL relative (marche en local et sur Vercel)
  const res = await fetch("/api/odds/today", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load odds");
  const data = await res.json();
  return (data?.games ?? []) as OddsGame[];
}

export default async function Page() {
  const games = await getOdds();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        NHL — Meilleures cotes H2H (TheOddsAPI)
      </h1>

      {games.length === 0 ? (
        <p>Aucun match trouvé.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Heure (UTC)</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Meilleure cote — Extérieur</th>
                <th className="px-3 py-2">Meilleure cote — Domicile</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const { bestHome, bestAway } = bestH2HPrices(g);
                const dt = new Date(g.commence_time)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 16);

                return (
                  <tr key={g.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{dt}</td>
                    <td className="px-3 py-2">
                      {g.away_team} @ {g.home_team}
                    </td>
                    <td className="px-3 py-2">
                      {bestAway.price > 0 ? (
                        <span title={bestAway.book}>
                          {bestAway.price.toFixed(2)}{" "}
                          <span className="text-gray-500">
                            ({bestAway.book})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {bestHome.price > 0 ? (
                        <span title={bestHome.book}>
                          {bestHome.price.toFixed(2)}{" "}
                          <span className="text-gray-500">
                            ({bestHome.book})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Source : TheOddsAPI • Actualisation toutes les 60s
      </p>
    </main>
  );
}
