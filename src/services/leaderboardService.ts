import { supabase } from "../lib/supabase";
import type { EnemyDefinition, PlayerTrophyHarvest } from "./combatAdminService";
import { resolveEnemyThumbnailUri } from "./combatAdminService";

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
  portrait_thumb_url?: string | null;
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

export type TrophyLeaderboardRow = PlayerTrophyHarvest & {
  character_name: string;
  display_name: string;
  portrait_url: string | null;
  portrait_thumb_url?: string | null;
  enemy_image_url: string | null;
  enemy_image_thumb_url?: string | null;
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

export async function getTrophyLeaderboard(limit = 100, userIds?: string[]) {
  let query = supabase
    .from("player_trophy_harvests")
    .select("*")
    .order("trophy_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  const harvests = (data ?? []) as PlayerTrophyHarvest[];
  return hydrateTrophyRows(harvests);
}

export async function getTrophyLeaderboardWithRank(userIds?: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  let query = supabase
    .from("player_trophy_harvests")
    .select("*")
    .order("trophy_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query.limit(5000);

  if (error) {
    throw error;
  }

  const harvests = (data ?? []) as PlayerTrophyHarvest[];
  const hydrated = await hydrateTrophyRows(harvests);
  const ranked = hydrated.map((row, index) => ({ row, rank: index + 1 }));
  const topRows = ranked.slice(0, 100);
  const currentPlayer = user ? ranked.find((entry) => entry.row.user_id === user.id) ?? null : null;

  return {
    rows: topRows.map((entry) => entry.row),
    currentPlayerRow: currentPlayer?.row ?? null,
    currentPlayerRank: currentPlayer?.rank ?? null,
  };
}

async function hydrateTrophyRows(harvests: PlayerTrophyHarvest[]): Promise<TrophyLeaderboardRow[]> {
  if (harvests.length === 0) {
    return [];
  }

  const characterIds = [...new Set(harvests.map((row) => row.character_id))];
  const enemyIds = [...new Set(harvests.map((row) => row.enemy_id).filter(Boolean) as string[])];
  const [profilesResult, enemiesResult] = await Promise.all([
    supabase.from("player_leaderboards").select("*").in("character_id", characterIds),
    enemyIds.length ? supabase.from("enemy_definitions").select("*").in("id", enemyIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }
  if (enemiesResult.error) {
    throw enemiesResult.error;
  }

  const profiles = new Map(((profilesResult.data ?? []) as LeaderboardRow[]).map((row) => [row.character_id, row]));
  const enemyImages = new Map(((enemiesResult.data ?? []) as EnemyDefinition[]).map((row) => [row.id, resolveEnemyThumbnailUri(row)]));

  return harvests.map((harvest) => {
    const profile = profiles.get(harvest.character_id);

    return {
      ...harvest,
      character_name: profile?.character_name ?? "Unknown Character",
      display_name: profile?.display_name ?? "Unknown Player",
      portrait_url: profile?.portrait_url ?? null,
      portrait_thumb_url: profile?.portrait_thumb_url ?? null,
      enemy_image_url: harvest.enemy_id ? enemyImages.get(harvest.enemy_id) ?? null : null,
      enemy_image_thumb_url: harvest.enemy_id ? enemyImages.get(harvest.enemy_id) ?? null : null,
    };
  });
}
