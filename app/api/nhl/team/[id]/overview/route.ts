// app/api/nhl/team/[id]/overview/route.ts
import { NextResponse } from "next/server";
import { j, currentSeasonId } from "../../../_lib";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const teamId = Number(params.id);
  if (!teamId) {
    return NextResponse.json({ ok: false, error: "bad team id" }, { status: 400 });
  }

  try {
    const season = currentSeasonId();

    // 1) Stats équipe (moy. buts marqués)
    const teamStats = await j<any>(`https://statsapi.web.nhl.com/api/v1/teams/${teamId}/stats`);
    const splits = teamStats.stats?.[0]?.splits?.[0]?.stat || {};
    const goalsPerGame = Number(splits.goalsPerGame ?? null);

    // 2) Derniers matchs (3) + buteurs via live feed
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 10); // fenêtre large pour capter au moins 3 matchs
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const sched = await j<any>(
      `https://statsapi.web.nhl.com/api/v1/schedule?teamId=${teamId}&startDate=${fmt(from)}&endDate=${fmt(
        today
      )}&expand=schedule.linescore`
    );
    const allGames = (sched.dates || []).flatMap((d: any) => d.games || []);
    const last3 = allGames.slice(-3);

    async function gameScorers(g: any) {
      const gamePk = g.gamePk;
      const live = await j<any>(`https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`);
      const scoring = (live.liveData?.plays?.scoringPlays || []).map(
        (idx: number) => live.liveData.plays.allPlays[idx]
      );
      const events = scoring.map((p: any) => ({
        period: p.about?.period,
        team: p.team?.name,
        players: (p.players || []).map((pl: any) => ({ name: pl.player.fullName, type: pl.playerType })), // Scorer/Assist
      }));
      return events;
    }

    const last3Detailed: any[] = [];
    for (const g of last3) {
      const home = g.teams?.home?.team?.name;
      const away = g.teams?.away?.team?.name;
      const homeScore = g.teams?.home?.score;
      const awayScore = g.teams?.away?.score;
      const where = g.teams?.home?.team?.id === teamId ? "1" : "2"; // 1=domicile, 2=extérieur
      const scorers = await gameScorers(g);
      last3Detailed.push({
        when: g.gameDate,
        label: `${away} @ ${home}`,
        result: `${awayScore}-${homeScore}`,
        where,
        scorers,
      });
    }

    // 3) Roster + leaders saison (goals/assists/points)
    const rosterRes = await j<any>(`https://statsapi.web.nhl.com/api/v1/teams/${teamId}?expand=team.roster`);
    const roster = rosterRes?.teams?.[0]?.roster?.roster || [];

    async function playerSeason(pid: number) {
      const s = await j<any>(`https://statsapi.web.nhl.com/api/v1/people/${pid}/stats?stats=statsSingleSeason&season=${season}`);
      const sk = s.stats?.[0]?.splits?.[0]?.stat || {};
      return {
        goals: Number(sk.goals || 0),
        assists: Number(sk.assists || 0),
        points: Number(sk.points || 0),
        games: Number(sk.games || 0),
      };
    }

    async function playerGameLog(pid: number, count: number) {
      const s = await j<any>(`https://statsapi.web.nhl.com/api/v1/people/${pid}/stats?stats=gameLog&season=${season}`);
      const logs = s.stats?.[0]?.splits || [];
      const last = logs.slice(0, count); // les plus récents d’abord
      const goals = last.reduce((a: number, x: any) => a + Number(x.stat.goals || 0), 0);
      const points = last.reduce((a: number, x: any) => a + Number(x.stat.points || 0), 0);
      const perGame = last.map((x: any) => ({
        date: x.date,
        opponent: x.opponent?.name,
        isHome: x.isHome,
        goals: Number(x.stat.goals || 0),
        points: Number(x.stat.points || 0),
      }));
      return { goals, points, perGame };
    }

    const skaters = (roster || []).filter((r: any) => r.position?.type !== "Goalie").map((r: any) => ({
      id: r.person.id,
      name: r.person.fullName,
    }));

    const seasonStats = await Promise.all(
      skaters.map(async (p) => {
        const s = await playerSeason(p.id);
        return { ...p, ...s };
      })
    );

    const topGoals = [...seasonStats].sort((a, b) => b.goals - a.goals).slice(0, 10);
    const topAssists = [...seasonStats].sort((a, b) => b.assists - a.assists).slice(0, 10);
    const topPoints = [...seasonStats].sort((a, b) => b.points - a.points).slice(0, 10);

    async function leadersSpan(span: number) {
      const arr = await Promise.all(
        skaters.map(async (p) => {
          const lg = await playerGameLog(p.id, span);
          return { id: p.id, name: p.name, goals: lg.goals, points: lg.points };
        })
      );
      return arr.sort((a, b) => b.goals - a.goals).slice(0, 10);
    }

    const [last3Goals, last5Goals, last7Goals] = await Promise.all([leadersSpan(3), leadersSpan(5), leadersSpan(7)]);

    const perPlayerTable: Record<string, any[]> = {};
    await Promise.all(
      skaters.map(async (p) => {
        const lg = await playerGameLog(p.id, 7);
        perPlayerTable[p.name] = lg.perGame;
      })
    );

    return NextResponse.json({
      ok: true,
      teamId,
      goalsPerGame,
      last3: last3Detailed,
      leaders: {
        goals: topGoals,
        assists: topAssists,
        points: topPoints,
      },
      spans: {
        topGoalsLast3: last3Goals,
        topGoalsLast5: last5Goals,
        topGoalsLast7: last7Goals,
      },
      perPlayerTable,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
