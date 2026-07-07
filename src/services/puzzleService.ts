import { supabase, type Tables } from "../lib/supabase";

export type PuzzleDefinition = Tables["puzzle_definitions"];
export type PuzzleTapZone = Tables["puzzle_tap_zones"];
export type PlayerPuzzleProgress = Tables["player_puzzle_progress"];

export type PuzzleWithZones = {
  puzzle: PuzzleDefinition;
  zones: PuzzleTapZone[];
  progress: PlayerPuzzleProgress | null;
};

export function blankPuzzleDefinition(markerId: string, seasonNumber = 1, chapterNumber = 1): Omit<PuzzleDefinition, "id" | "created_at" | "updated_at" | "created_by"> {
  return {
    marker_id: markerId,
    title: "Sequence Puzzle",
    intro_text: "",
    image_url: null,
    success_text: "The sequence settles into place.",
    failure_text: "That does not feel right.",
    reset_on_failure: true,
    max_attempts: 0,
    unlock_marker_id: null,
    set_story_flag_key: null,
    set_story_flag_value: true,
    complete_marker_on_success: true,
    is_active: true,
    season_number: seasonNumber,
    chapter_number: chapterNumber,
  };
}

export function blankPuzzleZone(puzzleId: string, sequenceOrder: number, point?: { x: number; y: number }): Omit<PuzzleTapZone, "id" | "created_at" | "updated_at"> {
  return {
    puzzle_id: puzzleId,
    label: `Step ${sequenceOrder}`,
    player_label: null,
    clue_text: null,
    x_percent: point?.x ?? 50,
    y_percent: point?.y ?? 50,
    radius_percent: 6,
    sequence_order: sequenceOrder,
    icon_label: String(sequenceOrder),
    icon_image_url: null,
    is_active: true,
  };
}

export async function getPuzzleForMarker(markerId: string, characterId?: string | null): Promise<PuzzleWithZones | null> {
  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzle_definitions")
    .select("*")
    .eq("marker_id", markerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (puzzleError) {
    if (isMissingPuzzleSchema(puzzleError)) {
      console.warn("[puzzle] puzzle tables unavailable. Run the sequence puzzle migration.");
      return null;
    }
    throw puzzleError;
  }

  if (!puzzle) {
    return null;
  }

  const { data: zones, error: zoneError } = await supabase
    .from("puzzle_tap_zones")
    .select("*")
    .eq("puzzle_id", puzzle.id)
    .eq("is_active", true)
    .order("sequence_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (zoneError) {
    throw zoneError;
  }

  const progress = characterId ? await getPlayerPuzzleProgress(puzzle.id) : null;

  return {
    puzzle: puzzle as PuzzleDefinition,
    zones: (zones ?? []) as PuzzleTapZone[],
    progress,
  };
}

export async function getPuzzleDefinitionsForMarker(markerId: string) {
  const { data, error } = await supabase
    .from("puzzle_definitions")
    .select("*")
    .eq("marker_id", markerId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingPuzzleSchema(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as PuzzleDefinition[];
}

export async function getPuzzleZones(puzzleId: string) {
  const { data, error } = await supabase
    .from("puzzle_tap_zones")
    .select("*")
    .eq("puzzle_id", puzzleId)
    .order("sequence_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PuzzleTapZone[];
}

export async function savePuzzleDefinition(input: Partial<PuzzleDefinition> & Pick<PuzzleDefinition, "marker_id">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const values = {
    marker_id: input.marker_id,
    title: input.title?.trim() || "Sequence Puzzle",
    intro_text: input.intro_text?.trim() || null,
    image_url: input.image_url?.trim() || null,
    success_text: input.success_text?.trim() || null,
    failure_text: input.failure_text?.trim() || null,
    reset_on_failure: input.reset_on_failure ?? true,
    max_attempts: Math.max(0, Math.round(Number(input.max_attempts) || 0)),
    unlock_marker_id: input.unlock_marker_id ?? null,
    set_story_flag_key: input.set_story_flag_key?.trim() || null,
    set_story_flag_value: input.set_story_flag_value ?? true,
    complete_marker_on_success: input.complete_marker_on_success ?? true,
    is_active: input.is_active ?? true,
    season_number: Math.max(1, Math.round(Number(input.season_number) || 1)),
    chapter_number: Math.max(1, Math.round(Number(input.chapter_number) || 1)),
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("puzzle_definitions").update(values).eq("id", input.id).select("*").single()
    : supabase.from("puzzle_definitions").insert(values).select("*").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as PuzzleDefinition;
}

export async function savePuzzleZone(input: Partial<PuzzleTapZone> & Pick<PuzzleTapZone, "puzzle_id">) {
  const values = {
    puzzle_id: input.puzzle_id,
    label: input.label?.trim() || `Step ${Number(input.sequence_order) || 1}`,
    player_label: input.player_label?.trim() || null,
    clue_text: input.clue_text?.trim() || null,
    x_percent: clampPercent(input.x_percent, 50),
    y_percent: clampPercent(input.y_percent, 50),
    radius_percent: Math.max(1, Math.min(30, Number(input.radius_percent) || 6)),
    sequence_order: Math.max(1, Math.round(Number(input.sequence_order) || 1)),
    icon_label: input.icon_label?.trim() || null,
    icon_image_url: input.icon_image_url?.trim() || null,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("puzzle_tap_zones").update(values).eq("id", input.id).select("*").single()
    : supabase.from("puzzle_tap_zones").insert(values).select("*").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as PuzzleTapZone;
}

export async function deletePuzzleZone(zoneId: string) {
  const { error } = await supabase.from("puzzle_tap_zones").delete().eq("id", zoneId);
  if (error) {
    throw error;
  }
}

export async function getPlayerPuzzleProgress(puzzleId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("player_puzzle_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("puzzle_id", puzzleId)
    .maybeSingle();

  if (error) {
    if (isMissingPuzzleSchema(error)) {
      return null;
    }
    throw error;
  }

  return (data as PlayerPuzzleProgress | null) ?? null;
}

export async function savePlayerPuzzleProgress(input: {
  characterId: string;
  puzzleId: string;
  markerId: string;
  currentIndex: number;
  attempts: number;
  completed?: boolean;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save puzzle progress.");
  }

  const { data, error } = await supabase
    .from("player_puzzle_progress")
    .upsert(
      {
        user_id: user.id,
        character_id: input.characterId,
        puzzle_id: input.puzzleId,
        marker_id: input.markerId,
        current_index: Math.max(0, Math.round(Number(input.currentIndex) || 0)),
        attempts: Math.max(0, Math.round(Number(input.attempts) || 0)),
        completed_at: input.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,puzzle_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerPuzzleProgress;
}

function clampPercent(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Number(value) || fallback));
}

function isMissingPuzzleSchema(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST205" || error?.code === "42P01" || message.includes("schema cache") || message.includes("could not find the table");
}
