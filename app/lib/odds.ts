// lib/odds.ts
export type OddsGame = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
};

export function bestH2HPrices(game: OddsGame) {
  let bestHome = { price: -Infinity, book: "" };
  let bestAway = { price: -Infinity, book: "" };

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
