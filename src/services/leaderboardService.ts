import { supabase, type Tables } from "../lib/supabase";
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

export type LeaderboardPeriod = "all_time" | "weekly";
export type WeeklyLeaderboardReward = Tables["weekly_leaderboard_rewards"];
export type WeeklyLeaderboardSettings = Tables["weekly_leaderboard_settings"];
export type WeeklyLeaderboardMetric = WeeklyLeaderboardReward["metric"];

export type WeeklyLeaderboardClaimResult = {
  claimed?: boolean;
  eligible?: boolean;
  already_claimed?: boolean;
  rank?: number;
  score?: number;
  reward_title?: string;
  reward_xp?: number;
  reward_gold?: number;
  reward_item_id?: string | null;
  reward_item_quantity?: number;
  message?: string;
  week_start?: string;
  week_end?: string;
};

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

export const weeklyLeaderboardMetrics: Array<{ key: LeaderboardMetric; label: string }> = [
  { key: "total_distance_walked_meters", label: "Distance" },
  { key: "training_sessions_completed", label: "Training" },
  { key: "event_completions", label: "Events" },
  { key: "total_enemy_kills", label: "Enemy Kills" },
];

export const weeklyRewardMetrics: Array<{ key: WeeklyLeaderboardMetric; label: string }> = [
  { key: "total_distance_walked_meters", label: "Distance" },
  { key: "training_sessions_completed", label: "Training" },
  { key: "event_completions", label: "Events" },
  { key: "total_enemy_kills", label: "Enemy Kills" },
  { key: "trophies", label: "Trophies" },
];

export const weekStartDays = [
  { key: 0, label: "Sunday" },
  { key: 1, label: "Monday" },
  { key: 2, label: "Tuesday" },
  { key: 3, label: "Wednesday" },
  { key: 4, label: "Thursday" },
  { key: 5, label: "Friday" },
  { key: 6, label: "Saturday" },
];

function getLeaderboardView(period: LeaderboardPeriod) {
  return period === "weekly" ? "player_weekly_leaderboards" : "player_leaderboards";
}

function getCurrentWeekStartIso() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function getLeaderboard(metric: LeaderboardMetric, limit = 100, userIds?: string[], period: LeaderboardPeriod = "all_time") {
  let query = supabase
    .from(getLeaderboardView(period))
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
  return getLeaderboardWithRankForPeriod(metric, userIds, "all_time");
}

export async function getLeaderboardWithRankForPeriod(metric: LeaderboardMetric, userIds?: string[], period: LeaderboardPeriod = "all_time") {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  let query = supabase
    .from(getLeaderboardView(period))
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

export async function getWeeklyLeaderboardSettings() {
  const { data, error } = await supabase
    .from("weekly_leaderboard_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? { id: true, week_starts_on: 1, updated_at: new Date().toISOString() }) as WeeklyLeaderboardSettings;
}

export async function saveWeeklyLeaderboardSettings(weekStartsOn: number) {
  const safeDay = Math.max(0, Math.min(6, Math.floor(Number(weekStartsOn) || 0)));
  const { data, error } = await supabase
    .from("weekly_leaderboard_settings")
    .upsert({ id: true, week_starts_on: safeDay, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as WeeklyLeaderboardSettings;
}

export async function getWeeklyLeaderboardRewards() {
  const { data, error } = await supabase
    .from("weekly_leaderboard_rewards")
    .select("*")
    .order("metric", { ascending: true })
    .order("rank", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as WeeklyLeaderboardReward[];
}

export async function saveWeeklyLeaderboardReward(input: Partial<WeeklyLeaderboardReward> & Pick<WeeklyLeaderboardReward, "metric" | "rank">) {
  const payload = {
    metric: input.metric,
    rank: Math.max(1, Math.min(3, Math.floor(Number(input.rank) || 1))),
    title: input.title?.trim() || `${weeklyRewardMetrics.find((metric) => metric.key === input.metric)?.label ?? input.metric} Rank ${input.rank}`,
    reward_xp: Math.max(0, Math.floor(Number(input.reward_xp) || 0)),
    reward_gold: Math.max(0, Math.floor(Number(input.reward_gold) || 0)),
    reward_item_id: input.reward_item_id || null,
    reward_item_quantity: Math.max(1, Math.floor(Number(input.reward_item_quantity) || 1)),
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("weekly_leaderboard_rewards").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("weekly_leaderboard_rewards").upsert(payload, { onConflict: "metric,rank" }).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as WeeklyLeaderboardReward;
}

export async function deleteWeeklyLeaderboardReward(rewardId: string) {
  const { error } = await supabase.from("weekly_leaderboard_rewards").delete().eq("id", rewardId);

  if (error) {
    throw error;
  }
}

export async function claimWeeklyLeaderboardReward(characterId: string, metric: WeeklyLeaderboardMetric) {
  const { data, error } = await supabase.rpc("claim_weekly_leaderboard_reward", {
    p_character_id: characterId,
    p_metric: metric,
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as WeeklyLeaderboardClaimResult;
}

export async function claimWeeklyLeaderboardRewardForCurrentUser(metric: WeeklyLeaderboardMetric) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return { claimed: false, eligible: false, message: "Sign in to claim weekly rewards." } as WeeklyLeaderboardClaimResult;
  }

  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("character_id")
    .eq("user_id", user.id)
    .order("level", { ascending: false })
    .order("xp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.character_id) {
    return { claimed: false, eligible: false, message: "Create a character before claiming weekly rewards." } as WeeklyLeaderboardClaimResult;
  }

  return claimWeeklyLeaderboardReward(data.character_id, metric);
}

export async function getTrophyLeaderboard(limit = 100, userIds?: string[]) {
  return getTrophyLeaderboardForPeriod(limit, userIds, "all_time");
}

export async function getTrophyLeaderboardForPeriod(limit = 100, userIds?: string[], period: LeaderboardPeriod = "all_time") {
  let query = supabase
    .from("player_trophy_harvests")
    .select("*")
    .order("trophy_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (period === "weekly") {
    query = query.gte("created_at", getCurrentWeekStartIso());
  }

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
  return getTrophyLeaderboardWithRankForPeriod(userIds, "all_time");
}

export async function getTrophyLeaderboardWithRankForPeriod(userIds?: string[], period: LeaderboardPeriod = "all_time") {
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

  if (period === "weekly") {
    query = query.gte("created_at", getCurrentWeekStartIso());
  }

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
