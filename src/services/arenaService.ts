import { supabase, Tables } from "../lib/supabase";
import type { MapMarker } from "./mapService";
import type { PlayerBattleSnapshot } from "./battleSnapshotService";

export type ArenaSpot = Tables["arena_spots"];
export type ArenaHolder = Tables["arena_holders"];

export type ArenaLeaderboardEntry = {
  holder: ArenaHolder;
  snapshot: PlayerBattleSnapshot | null;
  heldMs: number;
};

export type ArenaWithLeaders = {
  arena: ArenaSpot | null;
  currentHolder: ArenaLeaderboardEntry | null;
  mostDefenses: ArenaLeaderboardEntry[];
  longestHeld: ArenaLeaderboardEntry[];
  unavailableReason: string | null;
};

export async function getArenaForMarker(marker: MapMarker): Promise<ArenaWithLeaders> {
  const emptyArena = createEmptyArenaResult();

  if (marker.type !== "Arena") {
    return emptyArena;
  }

  const { data: arena, error: arenaError } = await supabase
    .from("arena_spots")
    .select("*")
    .eq("marker_id", marker.id)
    .eq("is_active", true)
    .maybeSingle();

  if (arenaError) {
    console.warn("[arena] arena spots unavailable", arenaError.message);
    return {
      ...emptyArena,
      unavailableReason: "Arena tables are not ready yet. Run the latest arena migration.",
    };
  }

  if (!arena) {
    return {
      ...emptyArena,
      unavailableReason: "This Arena marker does not have an arena record yet.",
    };
  }

  const { data: holders, error: holdersError } = await supabase
    .from("arena_holders")
    .select("*")
    .eq("arena_id", arena.id)
    .order("wins_defended", { ascending: false })
    .order("won_at", { ascending: true })
    .limit(25);

  if (holdersError) {
    console.warn("[arena] arena holders unavailable", holdersError.message);
    return {
      arena: arena as ArenaSpot,
      currentHolder: null,
      mostDefenses: [],
      longestHeld: [],
      unavailableReason: "Arena holders could not be loaded.",
    };
  }

  const holderRows = (holders ?? []) as ArenaHolder[];
  const snapshotIds = Array.from(new Set(holderRows.map((holder) => holder.holder_snapshot_id).filter(Boolean))) as string[];
  const snapshots = await getSnapshotsById(snapshotIds);
  const entries = holderRows.map((holder) => toEntry(holder, snapshots.get(holder.holder_snapshot_id ?? "")));
  const currentHolder = entries.find((entry) => entry.holder.is_current) ?? null;

  return {
    arena: arena as ArenaSpot,
    currentHolder,
    mostDefenses: [...entries]
      .sort((left, right) => right.holder.wins_defended - left.holder.wins_defended || right.heldMs - left.heldMs)
      .slice(0, 10),
    longestHeld: [...entries]
      .sort((left, right) => right.heldMs - left.heldMs || right.holder.wins_defended - left.holder.wins_defended)
      .slice(0, 10),
    unavailableReason: null,
  };
}

export async function saveArenaForMarker(marker: MapMarker) {
  if (marker.type !== "Arena") {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const values: Partial<ArenaSpot> = {
    marker_id: marker.id,
    name: marker.quest_title || marker.title,
    description: marker.description,
    background_image_url: marker.scene_background_image_url,
    reward_xp: Math.max(0, Number(marker.reward_xp) || 0),
    reward_gold: Math.max(0, Number(marker.reward_gold) || 0),
    season_number: marker.season_number ?? 1,
    chapter_number: marker.chapter_number ?? 1,
    is_active: marker.is_active,
    created_by: user?.id ?? marker.created_by ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("arena_spots")
    .upsert(values, { onConflict: "marker_id" })
    .select("*")
    .single();

  if (error) {
    console.warn("[arena] could not save arena spot", error.message);
    throw error;
  }

  return data as ArenaSpot;
}

export async function claimOpenArena(arenaId: string, snapshot: PlayerBattleSnapshot) {
  const existing = await getCurrentArenaHolder(arenaId);

  if (existing) {
    throw new Error("This arena already has a current holder.");
  }

  const { data, error } = await supabase
    .from("arena_holders")
    .insert({
      arena_id: arenaId,
      holder_user_id: snapshot.user_id,
      holder_character_id: snapshot.character_id,
      holder_snapshot_id: snapshot.id,
      wins_defended: 0,
      is_current: true,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ArenaHolder;
}

async function getCurrentArenaHolder(arenaId: string) {
  const { data, error } = await supabase
    .from("arena_holders")
    .select("*")
    .eq("arena_id", arenaId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ArenaHolder | null;
}

async function getSnapshotsById(snapshotIds: string[]) {
  if (snapshotIds.length === 0) {
    return new Map<string, PlayerBattleSnapshot>();
  }

  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .select("*")
    .in("id", snapshotIds);

  if (error) {
    console.warn("[arena] snapshots unavailable", error.message);
    return new Map<string, PlayerBattleSnapshot>();
  }

  return new Map(((data ?? []) as PlayerBattleSnapshot[]).map((snapshot) => [snapshot.id, snapshot]));
}

function toEntry(holder: ArenaHolder, snapshot?: PlayerBattleSnapshot | null): ArenaLeaderboardEntry {
  const endMs = holder.replaced_at ? new Date(holder.replaced_at).getTime() : Date.now();
  const startMs = new Date(holder.won_at).getTime();

  return {
    holder,
    snapshot: snapshot ?? null,
    heldMs: Math.max(0, endMs - startMs),
  };
}

function createEmptyArenaResult(): ArenaWithLeaders {
  return {
    arena: null,
    currentHolder: null,
    mostDefenses: [],
    longestHeld: [],
    unavailableReason: null,
  };
}
