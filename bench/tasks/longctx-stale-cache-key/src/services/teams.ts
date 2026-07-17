import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export interface Team { id: string; orgId: string; members: string[] }

const TEAMS: Record<string, Team> = {
  t1: { id: "t1", orgId: "o1", members: ["u1", "u2"] },
};

export function loadTeam(teamId: string): Team | undefined {
  const key = cacheKey("team", teamId);
  const cached = cacheGet<Team>(key);
  if (cached) return cached;
  const team = TEAMS[teamId];
  if (team) cacheSet(key, team);
  return team;
}
