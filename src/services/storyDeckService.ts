import { supabase, type Tables } from "../lib/supabase";

export type StoryDeck = Tables["story_decks"];
export type StoryCard = Tables["story_cards"];
export type PlayerStoryDeckView = Tables["player_story_deck_views"];
export type StoryDeckTriggerType = StoryDeck["trigger_type"];
export type StoryDeckType = StoryDeck["deck_type"];
export type StoryCardTextPosition = StoryCard["text_position"];
export type StoryCardTextStyle = StoryCard["text_style"];

export const storyDeckTypes: StoryDeckType[] = ["lore", "chapter_summary", "cutscene", "recap", "tutorial", "area_intro"];
export const storyDeckTriggerTypes: StoryDeckTriggerType[] = [
  "manual",
  "opening_game",
  "entering_area",
  "leaving_area",
  "starting_path",
  "completing_path",
  "marker_interaction",
  "dialogue_choice",
  "puzzle_complete",
  "completing_chapter",
  "receiving_reward",
];

export const storyCardTextPositions: StoryCardTextPosition[] = ["bottom", "top", "center"];
export const storyCardTextStyles: StoryCardTextStyle[] = ["dark", "light", "gold"];

export function blankStoryDeck(): Omit<StoryDeck, "id" | "created_at" | "updated_at" | "created_by"> {
  return {
    title: "",
    description: null,
    deck_type: "lore",
    trigger_type: "manual",
    trigger_key: null,
    season_number: 1,
    chapter_number: 1,
    play_once: true,
    save_to_journal: true,
    replayable: true,
    is_published: true,
    is_active: true,
    sort_order: 0,
  };
}

export function blankStoryCard(deckId = ""): Omit<StoryCard, "id" | "created_at" | "updated_at"> {
  return {
    deck_id: deckId,
    title: null,
    body: "",
    image_url: null,
    text_position: "bottom",
    text_style: "dark",
    button_text: "Continue",
    sound_url: null,
    sort_order: 0,
  };
}

export async function getStoryDecks() {
  const { data, error } = await supabase
    .from("story_decks")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.warn("[story-decks] unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryDeck[];
}

export async function getStoryCards(deckId: string) {
  const { data, error } = await supabase
    .from("story_cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[story-decks] cards unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryCard[];
}

export async function getStoryDeck(deckId: string) {
  const { data, error } = await supabase
    .from("story_decks")
    .select("*")
    .eq("id", deckId)
    .maybeSingle();

  if (error) {
    console.warn("[story-decks] deck unavailable", error.message);
    return null;
  }

  return data as StoryDeck | null;
}

export async function saveStoryDeck(input: Partial<StoryDeck> & Pick<StoryDeck, "title">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    deck_type: input.deck_type ?? "lore",
    trigger_type: input.trigger_type ?? "manual",
    trigger_key: input.trigger_key?.trim() || null,
    season_number: Math.max(1, Math.round(Number(input.season_number) || 1)),
    chapter_number: Math.max(1, Math.round(Number(input.chapter_number) || 1)),
    play_once: input.play_once ?? true,
    save_to_journal: input.save_to_journal ?? true,
    replayable: input.replayable ?? true,
    is_published: input.is_published ?? true,
    is_active: input.is_active ?? true,
    sort_order: Math.round(Number(input.sort_order) || 0),
    created_by: input.created_by ?? user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("story_decks").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("story_decks").insert(payload).select("*").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as StoryDeck;
}

export async function deleteStoryDeck(deckId: string) {
  const { error } = await supabase.from("story_decks").delete().eq("id", deckId);
  if (error) throw error;
}

export async function saveStoryCard(input: Partial<StoryCard> & Pick<StoryCard, "deck_id" | "body">) {
  const payload = {
    deck_id: input.deck_id,
    title: input.title?.trim() || null,
    body: input.body.trim(),
    image_url: input.image_url?.trim() || null,
    text_position: input.text_position ?? "bottom",
    text_style: input.text_style ?? "dark",
    button_text: input.button_text?.trim() || "Continue",
    sound_url: input.sound_url?.trim() || null,
    sort_order: Math.round(Number(input.sort_order) || 0),
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("story_cards").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("story_cards").insert(payload).select("*").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as StoryCard;
}

export async function deleteStoryCard(cardId: string) {
  const { error } = await supabase.from("story_cards").delete().eq("id", cardId);
  if (error) throw error;
}

export async function getCompletedStoryDeckViews() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return [];

  const { data, error } = await supabase
    .from("player_story_deck_views")
    .select("*")
    .eq("user_id", user.id)
    .not("completed_at", "is", null);

  if (error) {
    console.warn("[story-decks] completed views unavailable", error.message);
    return [];
  }

  return (data ?? []) as PlayerStoryDeckView[];
}

export async function markStoryDeckViewed(deckId: string, characterId?: string | null, completed = true) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("player_story_deck_views")
    .select("*")
    .eq("user_id", user.id)
    .eq("story_deck_id", deckId)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    character_id: characterId ?? existing?.character_id ?? null,
    story_deck_id: deckId,
    first_viewed_at: existing?.first_viewed_at ?? now,
    last_viewed_at: now,
    view_count: Number(existing?.view_count ?? 0) + 1,
    completed_at: completed ? now : existing?.completed_at ?? null,
  };

  const { data, error } = await supabase
    .from("player_story_deck_views")
    .upsert(payload, { onConflict: "user_id,story_deck_id" })
    .select("*")
    .single();

  if (error) {
    console.warn("[story-decks] could not save view", error.message);
    return null;
  }

  return data as PlayerStoryDeckView;
}

export function resolveStoryDeckAssetUri(path?: string | null) {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function formatStoryDeckLabel(value: string) {
  return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}
