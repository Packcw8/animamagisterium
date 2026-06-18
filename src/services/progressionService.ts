import { supabase, Tables } from "../lib/supabase";

export type EnemyKillLog = Tables["enemy_kill_log"];
export type PlayerEnemyKillStat = Tables["player_enemy_kill_stats"];
export type PlayerEnemyTypeKillStat = Tables["player_enemy_type_kill_stats"];

export type EnemyKillInput = {
  userId: string;
  characterId: string;
  enemyId?: string | null;
  npcId?: string | null;
  enemyName: string;
  enemyType?: string | null;
  enemySource: EnemyKillLog["enemy_source"];
  routeId?: string | null;
  mapEventId?: string | null;
  seasonNumber?: number;
  chapterNumber?: number;
};

export async function recordEnemyKill(input: EnemyKillInput) {
  const now = new Date().toISOString();
  const enemyName = input.enemyName.trim() || "Unknown Enemy";
  const enemyType = input.enemyType?.trim() || "Unknown";
  const enemyKey = getEnemyKey(input.enemySource, input.enemyId, input.npcId, enemyName);

  const { error: logError } = await supabase.from("enemy_kill_log").insert({
    user_id: input.userId,
    character_id: input.characterId,
    enemy_key: enemyKey,
    enemy_id: input.enemyId ?? null,
    npc_id: input.npcId ?? null,
    enemy_name: enemyName,
    enemy_type: enemyType,
    enemy_source: input.enemySource,
    route_id: input.routeId ?? null,
    map_event_id: input.mapEventId ?? null,
    season_number: Number(input.seasonNumber) || 1,
    chapter_number: Number(input.chapterNumber) || 1,
    killed_at: now,
  });

  if (logError) {
    throw logError;
  }

  const [enemyStat, typeStat] = await Promise.all([
    getEnemyKillStat(input.characterId, enemyKey),
    getEnemyTypeKillStat(input.characterId, enemyType),
  ]);

  const enemyPayload = {
    user_id: input.userId,
    character_id: input.characterId,
    enemy_key: enemyKey,
    enemy_id: input.enemyId ?? null,
    npc_id: input.npcId ?? null,
    enemy_name: enemyName,
    enemy_type: enemyType,
    enemy_source: input.enemySource,
    kill_count: Number(enemyStat?.kill_count ?? 0) + 1,
    last_killed_at: now,
  };

  const typePayload = {
    user_id: input.userId,
    character_id: input.characterId,
    enemy_type: enemyType,
    kill_count: Number(typeStat?.kill_count ?? 0) + 1,
    last_killed_at: now,
  };

  const [enemyUpsert, typeUpsert] = await Promise.all([
    supabase.from("player_enemy_kill_stats").upsert(enemyPayload, { onConflict: "character_id,enemy_key" }),
    supabase.from("player_enemy_type_kill_stats").upsert(typePayload, { onConflict: "character_id,enemy_type" }),
  ]);

  if (enemyUpsert.error) {
    throw enemyUpsert.error;
  }

  if (typeUpsert.error) {
    throw typeUpsert.error;
  }

  return {
    enemyKey,
    enemyName,
    enemyType,
    enemyKillCount: enemyPayload.kill_count,
    typeKillCount: typePayload.kill_count,
  };
}

async function getEnemyKillStat(characterId: string, enemyKey: string) {
  const { data, error } = await supabase
    .from("player_enemy_kill_stats")
    .select("*")
    .eq("character_id", characterId)
    .eq("enemy_key", enemyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerEnemyKillStat | null;
}

async function getEnemyTypeKillStat(characterId: string, enemyType: string) {
  const { data, error } = await supabase
    .from("player_enemy_type_kill_stats")
    .select("*")
    .eq("character_id", characterId)
    .eq("enemy_type", enemyType)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerEnemyTypeKillStat | null;
}

function getEnemyKey(source: EnemyKillLog["enemy_source"], enemyId: string | null | undefined, npcId: string | null | undefined, enemyName: string) {
  if (source === "enemy" && enemyId) {
    return `enemy:${enemyId}`;
  }

  if (source === "npc" && npcId) {
    return `npc:${npcId}`;
  }

  return `manual:${enemyName.trim().toLowerCase().replace(/\s+/g, "-") || "unknown"}`;
}
