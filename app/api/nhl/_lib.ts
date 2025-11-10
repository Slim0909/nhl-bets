// app/api/nhl/_lib.ts
export async function j<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.json() as Promise<T>;
}

export function currentSeasonId() {
  // Saison croisant 2 années, ex. 2025-2026 => "20252026"
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  const end = start + 1;
  return `${start}${end}`;
}

export type Team = { id: number; name: string; triCode?: string; abbreviation?: string };

let TEAMS_CACHE: Team[] | null = null;

export async function getTeams(): Promise<Team[]> {
  if (TEAMS_CACHE) return TEAMS_CACHE;
  const data = await j<any>("https://statsapi.web.nhl.com/api/v1/teams");
  const teams: Team[] = (data.teams || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    triCode: t.triCode,
    abbreviation: t.abbreviation,
  }));
  TEAMS_CACHE = teams;
  return teams;
}

export async function findTeamIdByName(name: string): Promise<number | null> {
  const teams = await getTeams();
  const n = name.toLowerCase().replace(/\./g, "");
  const hit = teams.find(
    (t) =>
      t.name.toLowerCase().replace(/\./g, "") === n ||
      t.abbreviation?.toLowerCase() === n ||
      t.triCode?.toLowerCase() === n
  );
  return hit ? hit.id : null;
}
