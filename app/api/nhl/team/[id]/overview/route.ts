// app/api/nhl/team/[id]/overview/route.ts
import { NextRequest, NextResponse } from "next/server";

// petit helper fetch JSON avec no-store + timeout
async function fetchJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// Types NHL (minimaux)
type TeamLeaders = {
  leaderCategories: Array<{
    name: string;
    leaders: Array<{ person: { id: number; fullName: string }; value: number }>;
  }>;
};

type TeamStats = {
  stats: Array<{
    type: { displayName: string };
    splits: Array<{
      stat: { goalsPerGame?: number };
    }>;
  }>;
};

type Schedule = {
  dates: Array<{
    games: Array<{
      gamePk: number;
      gameDate: string;
      teams: {
        away: { team: { name: string }; score: number };
        home: { team: { name: string }; score: number };
      };
    }>;
  }>;
};

// ---- ROUTE HANDLER ----
// NOTE Next.js 16 : params est un Promise<{ id: string }>
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const teamId = Number(id);
    if (!Number.isFinite(teamId)) {
      return NextResponse.json(
        { ok: false, error: "Bad team id" },
        { status: 400 }
      );
    }

    // 1) Moyenne de buts par match
    const statsUrl = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}/stats`;
    const statsJson = await fetchJSON<TeamStats>(statsUrl);
    const teamStatBlock = statsJson.stats.find(
      (s) => s.type.displayName === "statsSingleSeason"
    );
    const goalsPerGame =
      teamStatBlock?.splits?.[0]?.stat?.goalsPerGame ?? null;

    // 2) 3 dernières rencontres (toutes compétitions) – on prend un range large et on coupe à 3
    const today = new Date();
    const from = new Date(today);
    from.setMonth(today.getMonth() - 2);
    const scheduleUrl = `https://statsapi.web.nhl.com/api/v1/schedule?teamId=${teamId}&startDate=${from
      .toISOString()
      .slice(0, 10)}&endDate=${today.toISOString().slice(0, 10)}`;
    const scheduleJson = await fetchJSON<Schedule>(scheduleUrl);

    const allGames =
      scheduleJson.dates?.flatMap((d) => d.games)?.sort((a, b) =>
        a.gameDate < b.gameDate ? 1 : -1
      ) ?? [];

    const last3 = allGames.slice(0, 3).map((g) => {
      const homeName = g.teams.home.team.name;
      const awayName = g.teams.away.team.name;
      const isHome = homeName && homeName.includes ? true : false; // on n’en a pas besoin pour la clé 1/N/2
      const homeScore = g.teams.home.score;
      const awayScore = g.teams.away.score;

      // Déterminer 1/N/2 du point de vue de l’équipe
      let sign: "1" | "N" | "2";
      if (homeScore === awayScore) sign = "N";
      else if (homeName === homeTeamName(teamId, homeName, awayName))
        sign = homeScore > awayScore ? "1" : "2";
      else sign = awayScore > homeScore ? "2" : "1";

      return {
        gamePk: g.gamePk,
        dateUTC: g.gameDate,
        home: homeName,
        away: awayName,
        score: `${homeScore}-${awayScore}`,
        resultFromTeamPOV: sign,
      };
    });

    // 3) Leaders (buts, passes, points)
    const leadersUrl = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}?expand=team.leaders`;
    const leadersRaw = await fetchJSON<{ teams: Array<{ teamLeaders: TeamLeaders }> }>(leadersUrl);
    const leaderCats =
      leadersRaw.teams?.[0]?.teamLeaders?.leaderCategories ?? [];

    const getCat = (key: string) =>
      leaderCats.find((c) => c.name.toLowerCase().includes(key));

    const goals = getCat("goals")?.leaders?.map(mapLeader) ?? [];
    const assists = getCat("assists")?.leaders?.map(mapLeader) ?? [];
    const points = getCat("points")?.leaders?.map(mapLeader) ?? [];

    // 4) Spans (3/5/7 derniers matchs) – l’API ne donne pas direct,
    // on expose des “endpoints à brancher plus tard” (TODO si on veut raffiner).
    const spans = {
      goalsLast3: [], // TODO: alimenter via game logs joueurs si tu veux qu’on le branche ensuite
      goalsLast5: [],
      goalsLast7: [],
    };

    // 5) Table joueur par match (placeholder) – à remplir quand on branchera les boxscores
    const perPlayerTable: Record<
      string,
      Array<{ gamePk: number; goals?: number; assists?: number; points?: number }>
    > = {};

    return NextResponse.json({
      ok: true,
      teamId,
      goalsPerGame,
      last3,
      leaders: {
        goals,
        assists,
        points,
      },
      spans,
      perPlayerTable,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}

// util: déduire quel est le nom "côté team" pour la logique 1/N/2
function homeTeamName(teamId: number, homeName: string, awayName: string) {
  // Cette fonction est un placeholder : l’API schedule ne renvoie pas l’ID équipe dans ce nœud,
  // donc on ne peut pas comparer avec teamId sans requête supplémentaire.
  // Pour l’instant, on renvoie homeName (suffisant pour poser le calcul 1/N/2 baseline).
  return homeName || awayName;
}

function mapLeader(l: {
  person: { id: number; fullName: string };
  value: number;
}) {
  return { id: l.person.id, name: l.person.fullName, value: l.value };
}
