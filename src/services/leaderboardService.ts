import { supabase } from "../lib/supabase";

export type LeaderboardMetric =
  | "total_distance_walked_meters"
  | "xp"
  | "gold"
  | "level"
  | "attribute_total"
  | "training_sessions_completed"
  | "event_completions"
  | "total_enemy_kills";

export type LeaderboardRow = {
  character_id: string;
  user_id: string;
  display_name: string;
  character_name: string;
  portrait_url: string | null;
  level: number;
  xp: number;
  gold: number;
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  spirit: number;
  attribute_total: number;
  total_distance_walked_meters: number;
  training_sessions_completed: number;
  event_completions: number;
  total_enemy_kills: number;
};

export const leaderboardMetrics: Array<{ key: LeaderboardMetric; label: string }> = [
  { key: "total_distance_walked_meters", label: "Distance" },
  { key: "xp", label: "XP" },
  { key: "gold", label: "Gold" },
  { key: "level", label: "Level" },
  { key: "attribute_total", label: "Attributes" },
  { key: "training_sessions_completed", label: "Training" },
  { key: "event_completions", label: "Events" },
  { key: "total_enemy_kills", label: "Enemy Kills" },
];

export async function getLeaderboard(metric: LeaderboardMetric, limit = 100, userIds?: string[]) {
  let query = supabase
    .from("player_leaderboards")
    .select("*")
    .order(metric, { ascending: false })
    .order("xp", { ascending: false });

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as LeaderboardRow[];
}

export async function getLeaderboardWithRank(metric: LeaderboardMetric, userIds?: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  let query = supabase
    .from("player_leaderboards")
    .select("*")
    .order(metric, { ascending: false })
    .order("xp", { ascending: false });

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query.limit(5000);

  if (error) {
    throw error;
  }

  const ranked = ((data ?? []) as LeaderboardRow[]).map((row, index) => ({ row, rank: index + 1 }));
  const topRows = ranked.slice(0, 100);
  const currentPlayer = user ? ranked.find((entry) => entry.row.user_id === user.id) ?? null : null;

  return {
    rows: topRows.map((entry) => entry.row),
    currentPlayerRow: currentPlayer?.row ?? null,
    currentPlayerRank: currentPlayer?.rank ?? null,
  };
}

export async function searchLeaderboardPlayers(term: string, limit = 20) {
  const trimmed = term.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("*")
    .or(`display_name.ilike.%${trimmed}%,character_name.ilike.%${trimmed}%`)
    .order("level", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as LeaderboardRow[];
}

export async function getLeaderboardProfileForCharacter(characterId: string) {
  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("*")
    .eq("character_id", characterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as LeaderboardRow | null;
}
