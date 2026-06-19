import type { MapChapter, MapRoute, MapSeason, StoryDialogueChoice, StoryDialogueNode } from "../services/mapService";

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

export function isInSelectedChapter(item: { season_number?: number | null; chapter_number?: number | null }, seasonNumber: number, chapterNumber: number) {
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
        is_active: true,
        created_by: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      });
    }
  }
  return Array.from(byNumber.values()).sort((a, b) => a.chapter_number - b.chapter_number);
}

export function getSeasonLabel(seasons: MapSeason[], seasonNumber: number) {
  return seasons.find((season) => season.season_number === seasonNumber)?.name ?? `Season ${seasonNumber}`;
}

export function getChapterLabel(chapters: MapChapter[], seasonNumber: number, chapterNumber: number) {
  return chapters.find((chapter) => chapter.season_number === seasonNumber && chapter.chapter_number === chapterNumber)?.name ?? `Chapter ${chapterNumber}`;
}

export function upsertRouteProgressRow(rows: Array<{ route_id: string; progress_percent: number; is_current?: boolean }>, routeId: string, progressPercent: number, isCurrent?: boolean) {
  const existing = rows.some((row) => row.route_id === routeId);

  if (existing) {
    return rows.map((row) => (row.route_id === routeId ? { ...row, progress_percent: progressPercent, ...(isCurrent !== undefined ? { is_current: isCurrent } : {}) } : row));
  }

  return [...rows, { route_id: routeId, progress_percent: progressPercent, ...(isCurrent !== undefined ? { is_current: isCurrent } : {}) }];
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
