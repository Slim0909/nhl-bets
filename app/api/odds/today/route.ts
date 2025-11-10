import { NextResponse } from 'next/server';

export const revalidate = 60;

export async function GET() {
  const key = process.env.THEODDSAPI_KEY;
  if (!key) {
    return NextResponse.json({ ok:false, error:'Missing THEODDSAPI_KEY' }, { status: 500 });
  }

  const sport = 'icehockey_nhl';
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=us&markets=h2h,totals&oddsFormat=decimal&apiKey=${key}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok:false, status: res.status, data }, { status: res.status });
    }
    return NextResponse.json({ ok:true, games: data });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'fetch_failed' }, { status: 500 });
  }
}
