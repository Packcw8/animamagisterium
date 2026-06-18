import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";

export type BadgeDefinition = Tables["badge_definitions"];
export type PlayerBadge = Tables["player_badges"];
export type BadgeType = BadgeDefinition["badge_type"];
export type BadgeState = {
  definition: BadgeDefinition;
  progressValue: number;
  isEarned: boolean;
  earnedAt: string | null;
};
export type EarnedBadgeSummary = {
  badge: BadgeDefinition;
  earnedAt: string | null;
  progressValue: number;
};

export const badgeTypes: BadgeType[] = ["distance", "enemy_name_kills", "enemy_type_kills", "story_completion", "training_sessions"];

export const badgeTypeLabels: Record<BadgeType, string> = {
  distance: "Distance Walked",
  enemy_name_kills: "Enemy Name Kills",
  enemy_type_kills: "Enemy Type Kills",
  story_completion: "Story Completion",
  training_sessions: "Training Sessions",
};

export async function getBadgeDefinitions(includeInactive = false) {
  let query = supabase
    .from("badge_definitions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as BadgeDefinition[];
}

export async function saveBadgeDefinition(input: Partial<BadgeDefinition>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to save badges.");
  }

  const payload = {
    title: input.title?.trim() || "New Badge",
    description: input.description?.trim() || null,
    badge_type: input.badge_type ?? "distance",
    metric_key: input.metric_key?.trim() || null,
    target_value: Math.max(1, Math.round(Number(input.target_value) || 1)),
    icon_url: input.icon_url?.trim() || null,
    icon_label: input.icon_label?.trim() || null,
    sort_order: Math.round(Number(input.sort_order) || 0),
    is_active: input.is_active ?? true,
    season_number: Math.max(1, Math.round(Number(input.season_number) || 1)),
    chapter_number: Math.max(1, Math.round(Number(input.chapter_number) || 1)),
    created_by: input.id ? input.created_by ?? user.id : user.id,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("badge_definitions").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("badge_definitions").insert(payload).select("*").single();

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as BadgeDefinition;
}

export async function deleteBadgeDefinition(id: string) {
  const { error } = await supabase.from("badge_definitions").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function getBadgeState(character: CharacterWithDetails) {
  const definitions = await getBadgeDefinitions();

  if (definitions.length === 0) {
    return [];
  }

  const [existingResult, routeResult, enemyNameResult, enemyTypeResult, storyResult, trainingResult] = await Promise.all([
    supabase.from("player_badges").select("*").eq("character_id", character.id),
    supabase.from("route_progress").select("distance_walked_meters").eq("user_id", character.user_id),
    supabase.from("player_enemy_kill_stats").select("enemy_key, kill_count").eq("character_id", character.id),
    supabase.from("player_enemy_type_kill_stats").select("enemy_type, kill_count").eq("character_id", character.id),
    supabase.from("story_marker_completions").select("marker_id").eq("user_id", character.user_id),
    supabase.from("training_sessions").select("attribute_key").eq("user_id", character.user_id).eq("character_id", character.id),
  ]);

  const firstError = existingResult.error ?? routeResult.error ?? enemyNameResult.error ?? enemyTypeResult.error ?? storyResult.error ?? trainingResult.error;
  if (firstError) {
    throw firstError;
  }

  const existing = new Map(((existingResult.data ?? []) as PlayerBadge[]).map((row) => [row.badge_id, row]));
  const distanceWalked = (routeResult.data ?? []).reduce((sum, row) => sum + Number(row.distance_walked_meters ?? 0), 0);
  const enemyNameCounts = new Map((enemyNameResult.data ?? []).map((row) => [String(row.enemy_key ?? "").toLowerCase(), Number(row.kill_count ?? 0)]));
  const enemyTypeCounts = new Map((enemyTypeResult.data ?? []).map((row) => [String(row.enemy_type ?? "").toLowerCase(), Number(row.kill_count ?? 0)]));
  const completedStories = new Set((storyResult.data ?? []).map((row) => String(row.marker_id)));
  const trainingRows = trainingResult.data ?? [];
  const trainingByAttribute = trainingRows.reduce<Record<string, number>>((counts, row) => {
    const key = String(row.attribute_key ?? "").toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const now = new Date().toISOString();

  const states = definitions.map((definition) => {
    const progressValue = getProgressForDefinition(definition, {
      distanceWalked,
      enemyNameCounts,
      enemyTypeCounts,
      completedStories,
      trainingTotal: trainingRows.length,
      trainingByAttribute,
    });
    const previous = existing.get(definition.id);
    const isEarned = progressValue >= definition.target_value;
    const earnedAt = isEarned ? previous?.earned_at ?? now : previous?.earned_at ?? null;

    return {
      definition,
      progressValue,
      isEarned,
      earnedAt,
    };
  });

  const upsertRows = states.map((state) => ({
    user_id: character.user_id,
    character_id: character.id,
    badge_id: state.definition.id,
    progress_value: state.progressValue,
    is_earned: state.isEarned,
    earned_at: state.earnedAt,
    updated_at: now,
  }));

  const { error: upsertError } = await supabase.from("player_badges").upsert(upsertRows, { onConflict: "character_id,badge_id" });

  if (upsertError) {
    throw upsertError;
  }

  return states;
}

export async function getEarnedBadgesForCharacter(characterId: string) {
  const { data, error } = await supabase
    .from("player_badges")
    .select("badge_id, progress_value, earned_at")
    .eq("character_id", characterId)
    .eq("is_earned", true)
    .order("earned_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ badge_id: string; progress_value: number; earned_at: string | null }>;
  if (rows.length === 0) {
    return [];
  }

  const { data: badgeRows, error: badgeError } = await supabase
    .from("badge_definitions")
    .select("*")
    .in("id", rows.map((row) => row.badge_id));

  if (badgeError) {
    throw badgeError;
  }

  const badges = new Map(((badgeRows ?? []) as BadgeDefinition[]).map((badge) => [badge.id, badge]));

  return rows
    .map((row) => {
      const badge = badges.get(row.badge_id);
      return badge ? { badge, earnedAt: row.earned_at, progressValue: row.progress_value } : null;
    })
    .filter(Boolean) as EarnedBadgeSummary[];
}

function getProgressForDefinition(
  definition: BadgeDefinition,
  metrics: {
    distanceWalked: number;
    enemyNameCounts: Map<string, number>;
    enemyTypeCounts: Map<string, number>;
    completedStories: Set<string>;
    trainingTotal: number;
    trainingByAttribute: Record<string, number>;
  },
) {
  const metricKey = definition.metric_key?.trim().toLowerCase() ?? "";

  if (definition.badge_type === "distance") {
    return Math.floor(metrics.distanceWalked);
  }

  if (definition.badge_type === "enemy_name_kills") {
    if (!metricKey) {
      return Array.from(metrics.enemyNameCounts.values()).reduce((sum, count) => sum + count, 0);
    }

    return metrics.enemyNameCounts.get(metricKey) ?? 0;
  }

  if (definition.badge_type === "enemy_type_kills") {
    if (!metricKey) {
      return Array.from(metrics.enemyTypeCounts.values()).reduce((sum, count) => sum + count, 0);
    }

    return metrics.enemyTypeCounts.get(metricKey) ?? 0;
  }

  if (definition.badge_type === "story_completion") {
    if (!metricKey) {
      return metrics.completedStories.size;
    }

    return metrics.completedStories.has(metricKey) ? 1 : 0;
  }

  if (definition.badge_type === "training_sessions") {
    if (!metricKey) {
      return metrics.trainingTotal;
    }

    return metrics.trainingByAttribute[metricKey] ?? 0;
  }

  return 0;
}
