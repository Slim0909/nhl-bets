// app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 60;

// Types minimaux pour parser TheOddsAPI
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

// Trouve la meilleure cote moneyline pour domicile / extérieur
function bestH2HPrices(game: OddsGame) {
  let bestHome = { price: -Infinity, book: "" };
  let bestAway = { price: -Infinity, book: "" };

  for (const b of game.bookmakers || []) {
    const m = (b.markets || []).find((mm) => mm.key === "h2h");
    if (!m) continue;
    for (const o of m.outcomes || []) {
      if (o.name === game.home_team && o.price > bestHome.price) {
        bestHome = { price: o.price, book: b.title };
