import type { MapChapter, MapRoute, MapSeason, StoryDialogueChoice, StoryDialogueNode } from "../services/mapService";

export type ChapterAccessType = NonNullable<MapChapter["access_type"]>;

export function getDefaultChapterRuleFields(): Pick<
  MapChapter,
  | "access_type"
  | "unlock_story_flag_key"
  | "unlock_story_flag_value"
  | "completion_story_flag_key"
  | "completion_story_flag_value"
  | "transition_title"
  | "transition_body"
  | "unlock_message"
  | "subscription_prompt"
> {
  return {
    access_type: "free",
    unlock_story_flag_key: null,
    unlock_story_flag_value: true,
    completion_story_flag_key: null,
    completion_story_flag_value: true,
    transition_title: null,
    transition_body: null,
    unlock_message: null,
    subscription_prompt: null,
  };
}

export function normalizeChapterRules(chapter: MapChapter): MapChapter {
  return {
    ...getDefaultChapterRuleFields(),
    ...chapter,
    access_type: chapter.access_type ?? "free",
    unlock_story_flag_key: chapter.unlock_story_flag_key?.trim() || null,
    unlock_story_flag_value: chapter.unlock_story_flag_value ?? true,
    completion_story_flag_key: chapter.completion_story_flag_key?.trim() || null,
    completion_story_flag_value: chapter.completion_story_flag_value ?? true,
    transition_title: chapter.transition_title?.trim() || null,
    transition_body: chapter.transition_body?.trim() || null,
    unlock_message: chapter.unlock_message?.trim() || null,
    subscription_prompt: chapter.subscription_prompt?.trim() || null,
  };
}

export function getChapterAccessStatus(chapter: MapChapter | null | undefined, storyFlags: Map<string, boolean>, isAdmin = false) {
  if (!chapter) {
    return { unlocked: true, message: "" };
  }

  const accessType = chapter.access_type ?? "free";
  if (accessType === "free") {
    return { unlocked: true, message: "" };
  }

  if (accessType === "admin_test") {
    return {
      unlocked: isAdmin,
      message: isAdmin ? "" : chapter.unlock_message || "This chapter is available to admins for testing.",
    };
  }

  const flagKey = chapter.unlock_story_flag_key?.trim();
  const flagMatches = flagKey ? storyFlags.get(flagKey) === (chapter.unlock_story_flag_value ?? true) : false;

  if (accessType === "story_locked") {
    return {
      unlocked: flagMatches,
      message: flagMatches ? "" : chapter.unlock_message || (flagKey ? `Requires story flag: ${flagKey}` : "This chapter needs a story unlock flag."),
    };
  }

  if (accessType === "subscription_locked") {
    return {
      unlocked: false,
      message: chapter.subscription_prompt || chapter.unlock_message || "This chapter will require an active chapter unlock.",
    };
  }

  return { unlocked: true, message: "" };
}

export function compareRoutes(a: MapRoute, b: MapRoute) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return a.created_at.localeCompare(b.created_at);
}

export function isRouteLocked(route: MapRoute) {
  return (route.lock_type ?? "public") !== "public";
}

export function getRouteLockLabel(route: MapRoute) {
  const lockType = route.lock_type ?? "public";
  return lockType === "quest_locked" ? "Quest Locked" : lockType === "story_locked" ? "Story Locked" : "Locked";
}

export function getRouteLockMessage(route: MapRoute) {
  if (!isRouteLocked(route)) {
    return "Available";
  }

  if (route.lock_message?.trim()) {
    return route.lock_message;
  }

  return route.lock_type === "quest_locked" ? "Continue the required quest to unlock this path." : "Progress further in the story to unlock this path.";
}

export function isInSelectedChapter(item: { content_scope?: string | null; season_number?: number | null; chapter_number?: number | null }, seasonNumber: number, chapterNumber: number) {
  if (item.content_scope === "universal") {
    return true;
  }

  return Number(item.season_number ?? 1) === seasonNumber && Number(item.chapter_number ?? 1) === chapterNumber;
}

export function getAvailableNumbers(items: Array<{ season_number?: number | null; chapter_number?: number | null }>, key: "season_number" | "chapter_number") {
  const values = new Set<number>([1]);
  for (const item of items) {
    const value = Number(item[key] ?? 1);
    if (Number.isFinite(value) && value > 0) {
      values.add(value);
    }
  }
  return Array.from(values).sort((a, b) => a - b);
}

export function mergeSeasonRecords(seasons: MapSeason[], inferredNumbers: number[]) {
  const byNumber = new Map<number, MapSeason>();
  for (const season of seasons) {
    byNumber.set(Number(season.season_number), season);
  }
  for (const number of inferredNumbers) {
    if (!byNumber.has(number)) {
      byNumber.set(number, {
        id: `inferred-season-${number}`,
        season_number: number,
        name: `Season ${number}`,
        description: null,
        is_active: true,
        created_by: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      });
    }
  }
  return Array.from(byNumber.values()).sort((a, b) => a.season_number - b.season_number);
}

export function mergeChapterRecords(chapters: MapChapter[], inferredNumbers: number[], seasonNumber: number) {
  const byNumber = new Map<number, MapChapter>();
  for (const chapter of chapters) {
    byNumber.set(Number(chapter.chapter_number), chapter);
  }
  for (const number of inferredNumbers) {
    if (!byNumber.has(number)) {
      byNumber.set(number, {
        id: `inferred-chapter-${seasonNumber}-${number}`,
        season_number: seasonNumber,
        chapter_number: number,
        name: `Chapter ${number}`,
        description: null,
        ...getDefaultChapterRuleFields(),
        is_active: true,
        created_by: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      });
    }
  }
  return Array.from(byNumber.values()).map(normalizeChapterRules).sort((a, b) => a.chapter_number - b.chapter_number);
}

export function getSeasonLabel(seasons: MapSeason[], seasonNumber: number) {
  return seasons.find((season) => season.season_number === seasonNumber)?.name ?? `Season ${seasonNumber}`;
}

export function getChapterLabel(chapters: MapChapter[], seasonNumber: number, chapterNumber: number) {
  return chapters.find((chapter) => chapter.season_number === seasonNumber && chapter.chapter_number === chapterNumber)?.name ?? `Chapter ${chapterNumber}`;
}

export function upsertRouteProgressRow<T extends { route_id: string; progress_percent: number; is_current?: boolean }>(
  rows: T[],
  routeId: string,
  progressPercent: number,
  isCurrent?: boolean,
): T[] {
  const existing = rows.some((row) => row.route_id === routeId);

  if (existing) {
    return rows.map((row) => (row.route_id === routeId ? { ...row, progress_percent: progressPercent, ...(isCurrent !== undefined ? { is_current: isCurrent } : {}) } : row));
  }

  return [...rows, { route_id: routeId, progress_percent: progressPercent, ...(isCurrent !== undefined ? { is_current: isCurrent } : {}) } as T];
}

export function getNextRouteOrder(routes: MapRoute[]) {
  return routes.reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
}

export function getNextDialogueNodeOrder(nodes: StoryDialogueNode[]) {
  return nodes.reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
}

export function getNextChoiceOrder(choices: StoryDialogueChoice[], nodeId: string) {
  return choices.filter((choice) => choice.node_id === nodeId).reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
}
