import { NextResponse } from 'next/server';

export const revalidate = 60;

export async function GET() {
  const today = new Date().toISOString().slice(0,10);
  const url = `https://statsapi.web.nhl.com/api/v1/schedule?date=${today}`;

  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ ok:false, status: res.status, data }, { status: res.status });
  }

  const games = (data?.dates?.[0]?.games ?? []).map((g: any) => ({
    gamePk: g.gamePk,
    status: g.status?.detailedState,
    startTimeUTC: g.gameDate,
    home: g.teams?.home?.team?.name,
    away: g.teams?.away?.team?.name,
  }));

  return NextResponse.json({ ok:true, date: today, games });
}
