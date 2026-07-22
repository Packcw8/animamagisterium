import type { PlayerRouteFinding, MapRoute, RouteProgress } from "../services/mapService";
import { formatResourceName } from "./dialogueFlow";
import { resolveGameAssetUri } from "./assetResolver";

export type RouteCompletionSummaryItem = {
  key: string;
  title: string;
  message: string;
  quantity: number;
  rarity: PlayerRouteFinding["rarity"];
  imageUrl: string | null;
  findingType: PlayerRouteFinding["finding_type"];
  progressPercent: number;
};

export type RouteCompletionSummary = {
  key: string;
  routeName: string;
  subtitle: string;
  iconUrl: string | null;
  items: RouteCompletionSummaryItem[];
  totalFindings: number;
  battleCount: number;
  emptyMessage?: string;
};

export function buildRouteCompletionSummary(
  route: MapRoute,
  routeFindings: PlayerRouteFinding[],
  currentRouteProgress: RouteProgress | null,
): RouteCompletionSummary | null {
  if ((route.route_kind ?? "story") !== "farming") {
    return null;
  }

  const routeProgressId = currentRouteProgress?.id ?? null;
  const findingsForThisWalk = routeFindings
    .filter((finding) => finding.route_id === route.id);

  const summaryRows = new Map<string, RouteCompletionSummaryItem>();
  for (const finding of findingsForThisWalk) {
    const quantity = Math.max(1, Math.round(Number(finding.quantity ?? 1) || 1));
    const isStackableItem = finding.finding_type === "item" || finding.item_id;
    const key = isStackableItem
      ? `item:${finding.item_id ?? finding.item_name ?? finding.title}`
      : `${finding.finding_type}:${finding.event_id ?? finding.id}`;
    const existing = summaryRows.get(key);

    if (existing) {
      existing.quantity += quantity;
      existing.progressPercent = Math.max(existing.progressPercent, Number(finding.progress_percent ?? 0) || 0);
      continue;
    }

    summaryRows.set(key, {
      key,
      title: finding.item_name ?? finding.title,
      message: finding.message ?? formatResourceName(finding.finding_type),
      quantity,
      rarity: finding.rarity ?? "common",
      imageUrl: finding.item_image_url ? resolveGameAssetUri(finding.item_image_url) : null,
      findingType: finding.finding_type,
      progressPercent: Number(finding.progress_percent ?? 0) || 0,
    });
  }

  const items = Array.from(summaryRows.values()).sort(
    (left, right) =>
      left.progressPercent - right.progressPercent ||
      left.title.localeCompare(right.title),
  );

  return {
    key: `${route.id}:${routeProgressId ?? "route"}:${findingsForThisWalk.length}`,
    routeName: route.name,
    subtitle: findingsForThisWalk.length > 0
      ? `${findingsForThisWalk.length} trail record${findingsForThisWalk.length === 1 ? "" : "s"} gathered`
      : "No trail finds were recorded this walk",
    iconUrl: resolveGameAssetUri("assets/Reusable/Icons/TrophyHuntIcon.jpg", "icon"),
    items,
    totalFindings: findingsForThisWalk.length,
    battleCount: findingsForThisWalk.filter((finding) => finding.finding_type === "battle").length,
    emptyMessage: findingsForThisWalk.length === 0 ? "Nothing useful turned up this time. Try the route again for another roll." : undefined,
  };
}
