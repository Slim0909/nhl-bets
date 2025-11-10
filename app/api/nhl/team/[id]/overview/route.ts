// app/api/nhl/team/[id]/overview/route.ts
import { NextRequest, NextResponse } from "next/server";

// --- helpers ---
async function fetchJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// --- types (minimaux) ---
type TeamResp = { teams: Array<{ id: number; name: string }> };

type TeamStats = {
  stats: Array<{
    type: { displayName: string };
    splits: Array<{ stat: { goalsPerGame?: number } }>;
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

type TeamLeaders = {
  leaderCategories: Array<{
    name: string;
    leaders: Array<{ person: { id: number; fullName: string }; value: number }>;
  }>;
};

// --- route handler (Next.js 16: params est un Promise) ---
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const teamId = Number(id);
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ ok: false, error: "Bad team id" }, { status: 400 });
    }

    // 0) Nom officiel de l’équipe (pour savoir si elle était home/away dans les matchs)
    const teamInfoUrl = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}`;
    const teamInfo = await fetchJSON<TeamResp>(teamInfoUrl);
    const teamName = teamInfo.teams?.[0]?.name;
    if (!teamName) {
      return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });
    }

    // 1) Moyenne de buts par match
    const statsUrl = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}/stats`;
    const statsJson = await fetchJSON<TeamStats>(statsUrl);
    const statBlock = statsJson.stats.find(s => s.type.displayName === "statsSingleSeason");
    const goalsPerGame = statBlock?.splits?.[0]?.stat?.goalsPerGame ?? null;

    // 2) 3 dernières rencontres (on prend 2 mois en arrière, on trie desc et on coupe)
    const today = new Date();
    const from = new Date(today);
    from.setMonth(today.getMonth() - 2);
    const scheduleUrl =
      `https://statsapi.web.nhl.com/api/v1/schedule?teamId=${teamId}` +
      `&startDate=${from.toISOString().slice(0, 10)}` +
      `&endDate=${today.toISOString().slice(0, 10)}`;

    const scheduleJson = await fetchJSON<Schedule>(scheduleUrl);
    const allGames =
      scheduleJson.dates?.flatMap(d => d.games)?.sort((a, b) => (a.gameDate < b.gameDate ? 1 : -1)) ?? [];

    const last3 = allGames.slice(0, 3).map(g => {
      const homeName = g.teams.home.team.name;
      const awayName = g.teams.away.team.name;
      const homeScore = g.teams.home.score;
      const awayScore = g.teams.away.score;

      // résultat 1/N/2 du point de vue de teamId
      let resultFromTeamPOV: "1" | "N" | "2";
      if (homeScore === awayScore) {
        resultFromTeamPOV = "N";
      } else if (teamName === homeName) {
        resultFromTeamPOV = homeScore > awayScore ? "1" : "2";
      } else if (teamName === awayName) {
        resultFromTeamPOV = awayScore > homeScore ? "2" : "1";
      } else {
        // fallback (ne devrait pas arriver)
        resultFromTeamPOV = homeScore > awayScore ? "1" : "2";
      }

      return {
        gamePk: g.gamePk,
        dateUTC: g.gameDate,
        home: homeName,
        away: awayName,
        score: `${homeScore}-${awayScore}`,
        resultFromTeamPOV,
        venue: teamName === homeName ? "home" : teamName === awayName ? "away" : "unknown",
      };
    });

    // 3) Leaders (buts, passes, points)
    const leadersUrl = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}?expand=team.leaders`;
    const leadersRaw = await fetchJSON<{ teams: Array<{ teamLeaders: TeamLeaders }> }>(leadersUrl);
    const leaderCats = leadersRaw.teams?.[0]?.teamLeaders?.leaderCategories ?? [];

    const mapLeader = (l: { person: { id: number; fullName: string }; value: number }) => ({
      id: l.person.id,
      name: l.person.fullName,
      value: l.value,
    });
    const getCat = (key: string) => leaderCats.find(c => c.name.toLowerCase().includes(key));

    const goals = getCat("goals")?.leaders?.map(mapLeader) ?? [];
    const assists = getCat("assists")?.leaders?.map(mapLeader) ?? [];
    const points = getCat("points")?.leaders?.map(mapLeader) ?? [];

    // 4) placeholders spans et table joueur (on branchera les boxscores plus tard)
    const spans = { goalsLast3: [], goalsLast5: [], goalsLast7: [] };
    const perPlayerTable: Record<string, Array<{ gamePk: number; goals?: number; assists?: number; points?: number }>> = {};

    return NextResponse.json({
      ok: true,
      teamId,
      teamName,
      goalsPerGame,
      last3,
      leaders: { goals, assists, points },
      spans,
      perPlayerTable,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "unexpected" }, { status: 500 });
  }
}
