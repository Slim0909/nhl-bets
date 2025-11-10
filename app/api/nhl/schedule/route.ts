import { NextResponse } from 'next/server';

export const runtime = 'nodejs';        // force l'exécution côté Node (pas Edge)
export const dynamic = 'force-dynamic'; // pas de pré-render
export const revalidate = 0;            // pas de cache Vercel

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://statsapi.web.nhl.com/api/v1/schedule?date=${today}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'nhl-bets/1.0 (+vercel)',
        'Accept': 'application/json',
      },
    });

    // Le body peut être vide en cas d'erreur réseau/HTTP
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error('NHL schedule HTTP error', res.status, data);
      return NextResponse.json(
        { ok: false, status: res.status, data },
        { status: res.status }
      );
    }

    const games = (data?.dates?.[0]?.games || []).map((g: any) => ({
      gamePk: g.gamePk,
      status: g.status?.detailedState,
      startTimeUTC: g.gameDate,
      home: g.teams?.home?.team?.name,
      away: g.teams?.away?.team?.name,
    }));

    return NextResponse.json({ ok: true, date: today, games });
