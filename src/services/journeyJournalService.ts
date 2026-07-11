import { supabase, type Tables } from "../lib/supabase";

type MapMarker = Tables["map_markers"];
type MapRoute = Tables["map_routes"];
type RouteProgress = Tables["route_progress"];
type StoryMarkerCompletion = Tables["story_marker_completions"];
type StoryDeck = Tables["story_decks"];
type StoryCard = Tables["story_cards"];
type PlayerStoryDeckView = Tables["player_story_deck_views"];

export type JourneyJournalEntry = {
  id: string;
  sourceType: "marker" | "route" | "story_deck";
  storyDeckId?: string | null;
  title: string;
  body: string | null;
  imageUrl: string | null;
  seasonNumber: number;
  chapterNumber: number;
  sortOrder: number;
  completedAt: string | null;
};

export async function getJourneyJournalEntries() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const [markerEntries, routeEntries, storyDeckEntries] = await Promise.all([
    getCompletedMarkerEntries(user.id),
    getCompletedRouteEntries(user.id),
    getCompletedStoryDeckEntries(user.id),
  ]);

  return [...markerEntries, ...routeEntries, ...storyDeckEntries].sort((a, b) => {
    const seasonDiff = a.seasonNumber - b.seasonNumber;
    if (seasonDiff !== 0) return seasonDiff;
    const chapterDiff = a.chapterNumber - b.chapterNumber;
    if (chapterDiff !== 0) return chapterDiff;
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return String(a.completedAt ?? "").localeCompare(String(b.completedAt ?? ""));
  });
}

async function getCompletedStoryDeckEntries(userId: string): Promise<JourneyJournalEntry[]> {
  const { data: views, error: viewError } = await supabase
    .from("player_story_deck_views")
    .select("*")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  if (viewError || !views?.length) {
    if (viewError) console.warn("[journal] story deck views unavailable", viewError.message);
    return [];
  }

  const deckIds = Array.from(new Set(views.map((view) => view.story_deck_id).filter(Boolean)));
  if (deckIds.length === 0) return [];

  const [{ data: decks, error: deckError }, { data: cards, error: cardError }] = await Promise.all([
    supabase.from("story_decks").select("*").in("id", deckIds),
    supabase.from("story_cards").select("*").in("deck_id", deckIds),
  ]);

  if (deckError || !decks?.length) {
    if (deckError) console.warn("[journal] story decks unavailable", deckError.message);
    return [];
  }
  if (cardError) {
    console.warn("[journal] story deck cards unavailable", cardError.message);
  }

  const viewByDeck = new Map((views as PlayerStoryDeckView[]).map((view) => [view.story_deck_id, view]));
  const cardsByDeck = new Map<string, StoryCard[]>();
  (cards as StoryCard[] | null ?? []).forEach((card) => {
    const list = cardsByDeck.get(card.deck_id) ?? [];
    list.push(card);
    cardsByDeck.set(card.deck_id, list);
  });

  return (decks as StoryDeck[])
    .filter((deck) => deck.save_to_journal && deck.replayable && deck.is_active)
    .map((deck) => {
      const firstCard = [...(cardsByDeck.get(deck.id) ?? [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))[0] ?? null;
      const view = viewByDeck.get(deck.id);

      return {
        id: `story-deck-${deck.id}`,
        sourceType: "story_deck" as const,
        storyDeckId: deck.id,
        title: deck.title,
        body: deck.description || firstCard?.body || null,
        imageUrl: firstCard?.image_url ?? null,
        seasonNumber: Number(deck.season_number ?? 1),
        chapterNumber: Number(deck.chapter_number ?? 1),
        sortOrder: Number(deck.sort_order ?? 0),
        completedAt: view?.completed_at ?? view?.last_viewed_at ?? null,
      };
    });
}

async function getCompletedMarkerEntries(userId: string): Promise<JourneyJournalEntry[]> {
  const { data: completions, error: completionError } = await supabase
    .from("story_marker_completions")
    .select("*")
    .eq("user_id", userId);

  if (completionError || !completions?.length) {
    if (completionError) console.warn("[journal] marker completions unavailable", completionError.message);
    return [];
  }

  const markerIds = Array.from(new Set(completions.map((completion) => completion.marker_id).filter(Boolean)));
  if (markerIds.length === 0) return [];

  const { data: markers, error: markerError } = await supabase.from("map_markers").select("*").in("id", markerIds);

  if (markerError || !markers?.length) {
    if (markerError) console.warn("[journal] markers unavailable", markerError.message);
    return [];
  }

  const completionByMarker = new Map((completions as StoryMarkerCompletion[]).map((completion) => [completion.marker_id, completion.completed_at]));

  return (markers as MapMarker[])
    .filter((marker) => marker.journal_title || marker.journal_body)
    .map((marker) => ({
      id: `marker-${marker.id}`,
      sourceType: "marker",
      title: marker.journal_title || marker.title,
      body: marker.journal_body || marker.description || null,
      imageUrl: marker.journal_image_url || marker.scene_background_image_url || marker.quest_image_url || marker.icon_image_url || null,
      seasonNumber: Number(marker.season_number ?? 1),
      chapterNumber: Number(marker.chapter_number ?? 1),
      sortOrder: Number(marker.journal_sort_order ?? marker.story_order ?? 0),
      completedAt: completionByMarker.get(marker.id) ?? null,
    }));
}

async function getCompletedRouteEntries(userId: string): Promise<JourneyJournalEntry[]> {
  const { data: progressRows, error: progressError } = await supabase
    .from("route_progress")
    .select("*")
    .eq("user_id", userId);

  if (progressError || !progressRows?.length) {
    if (progressError) console.warn("[journal] route progress unavailable", progressError.message);
    return [];
  }

  const routeIds = Array.from(new Set(progressRows.map((progress) => progress.route_id).filter(Boolean)));
  if (routeIds.length === 0) return [];

  const { data: routes, error: routeError } = await supabase.from("map_routes").select("*").in("id", routeIds);

  if (routeError || !routes?.length) {
    if (routeError) console.warn("[journal] routes unavailable", routeError.message);
    return [];
  }

  const routeById = new Map((routes as MapRoute[]).map((route) => [route.id, route]));

  return (progressRows as RouteProgress[])
    .filter((progress) => {
      const route = routeById.get(progress.route_id);
      if (!route) return false;
      const requiredDistance = Math.max(1, Number(route.distance_required_meters) || 1);
      return Number(progress.progress_percent) >= 99.9 || Number(progress.distance_walked_meters) >= requiredDistance * 0.98;
    })
    .map((progress) => {
      const route = routeById.get(progress.route_id)!;
      return {
        id: `route-${route.id}`,
        sourceType: "route" as const,
        title: route.journal_title || route.name,
        body: route.journal_body || `Completed ${route.name}.`,
        imageUrl: route.journal_image_url || route.image_url || null,
        seasonNumber: Number(route.season_number ?? 1),
        chapterNumber: Number(route.chapter_number ?? 1),
        sortOrder: Number(route.journal_sort_order ?? route.sort_order ?? 0),
        completedAt: progress.updated_at ?? null,
      };
    });
}
