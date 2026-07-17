import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { EnemyDefinition, NpcDefinition } from "../../services/combatAdminService";
import type { ItemDefinition } from "../../services/inventoryService";
import { marketListingModes, type MapEvent, type MapMarker, type MapRoute, type MarkerMarketItem, type MarkerRouteLink, type MiniMap } from "../../services/mapService";
import { colors, fonts } from "../theme";

const exitTargetTypes = ["world_marker", "mini_map"] as const;
const lockTypes = ["public", "story_locked", "quest_locked"] as const;
const lockTypeLabels: Record<(typeof lockTypes)[number], string> = {
  public: "Public",
  story_locked: "Story Locked",
  quest_locked: "Quest Locked",
};
const rewardTimings = ["on_interact", "on_path_complete"] as const;
const rewardTimingLabels: Record<(typeof rewardTimings)[number], string> = {
  on_interact: "When Interacted",
  on_path_complete: "After Linked Path Completion",
};

type MiniMapChapterFilter = "all" | "current";

function formatMiniMapChapter(miniMap: MiniMap) {
  if ((miniMap.content_scope ?? "universal") === "universal") {
    return "Universal";
  }

  return `S${Number(miniMap.season_number ?? 1)} / C${Number(miniMap.chapter_number ?? 1)}`;
}

function useMiniMapChapterFilter(miniMaps: MiniMap[], selectedSeason?: number, selectedChapter?: number) {
  const [filter, setFilter] = useState<MiniMapChapterFilter>("all");
  const filteredMiniMaps = useMemo(() => {
    if (filter !== "current" || !selectedSeason || !selectedChapter) {
      return miniMaps;
    }

    return miniMaps.filter((miniMap) => (miniMap.content_scope ?? "universal") === "universal" || (Number(miniMap.season_number ?? 1) === selectedSeason && Number(miniMap.chapter_number ?? 1) === selectedChapter));
  }, [filter, miniMaps, selectedChapter, selectedSeason]);

  return { filter, setFilter, filteredMiniMaps };
}

function MiniMapChapterFilterBar({
  filter,
  setFilter,
  selectedSeason,
  selectedChapter,
}: {
  filter: MiniMapChapterFilter;
  setFilter: (value: MiniMapChapterFilter) => void;
  selectedSeason?: number;
  selectedChapter?: number;
}) {
  if (!selectedSeason || !selectedChapter) {
    return null;
  }

  return (
    <View style={styles.storyRoutePicker}>
      <Pressable style={[styles.routeChip, filter === "all" && styles.routeChipActive]} onPress={() => setFilter("all")}>
        <Text style={styles.routeChipText}>All Mini Maps</Text>
      </Pressable>
      <Pressable style={[styles.routeChip, filter === "current" && styles.routeChipActive]} onPress={() => setFilter("current")}>
        <Text style={styles.routeChipText}>Current S{selectedSeason} / C{selectedChapter}</Text>
      </Pressable>
    </View>
  );
}

export function ItemPicker({ label, items, selectedId, onSelect }: { label: string; items: ItemDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {items.map((item) => (
          <Pressable key={item.id} style={[styles.routeChip, selectedId === item.id && styles.routeChipActive]} onPress={() => onSelect(item.id)}>
            <Text style={styles.routeChipText}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function LockPicker({ label, value, onSelect }: { label: string; value: (typeof lockTypes)[number]; onSelect: (value: (typeof lockTypes)[number]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        {lockTypes.map((type) => (
          <Pressable key={type} style={[styles.routeChip, value === type && styles.routeChipActive]} onPress={() => onSelect(type)}>
            <Text style={styles.routeChipText}>{lockTypeLabels[type]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function RouteCompletionConditionPicker({ value, onSelect }: { value: MarkerRouteLink["completion_condition"]; onSelect: (value: MarkerRouteLink["completion_condition"]) => void }) {
  const options: Array<{ value: MarkerRouteLink["completion_condition"]; label: string; description: string }> = [
    { value: "end", label: "Path End Only", description: "Unlock when this path reaches 100%." },
    { value: "start", label: "Path Start Only", description: "Unlock when reverse travel returns this path to 0%." },
    { value: "either", label: "Either End", description: "Unlock at 100%, or at 0% after reverse travel." },
  ];

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Path Unlock Point</Text>
      <Text style={styles.copy}>Choose which end of the linked path can activate this marker.</Text>
      <View style={styles.storyRoutePicker}>
        {options.map((option) => (
          <Pressable key={option.value} style={[styles.routeChip, value === option.value && styles.routeChipActive]} onPress={() => onSelect(option.value)}>
            <Text style={styles.routeChipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.debugLine}>{options.find((option) => option.value === value)?.description}</Text>
    </View>
  );
}

export function RewardTimingPicker({ value, onSelect }: { value: (typeof rewardTimings)[number]; onSelect: (value: (typeof rewardTimings)[number]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Reward Timing</Text>
      <View style={styles.storyRoutePicker}>
        {rewardTimings.map((timing) => (
          <Pressable key={timing} style={[styles.routeChip, value === timing && styles.routeChipActive]} onPress={() => onSelect(timing)}>
            <Text style={styles.routeChipText}>{rewardTimingLabels[timing]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ExitTargetEditor({
  targetType,
  setTargetType,
  targetMarkerId,
  setTargetMarkerId,
  targetMiniMapId,
  setTargetMiniMapId,
  targetSpawnMarkerId,
  setTargetSpawnMarkerId,
  worldMarkers,
  miniMaps,
  spawnMarkers,
  selectedSeason,
  selectedChapter,
}: {
  targetType: MapMarker["exit_target_type"];
  setTargetType: (value: MapMarker["exit_target_type"]) => void;
  targetMarkerId: string | null;
  setTargetMarkerId: (value: string | null) => void;
  targetMiniMapId: string | null;
  setTargetMiniMapId: (value: string | null) => void;
  targetSpawnMarkerId: string | null;
  setTargetSpawnMarkerId: (value: string | null) => void;
  worldMarkers: MapMarker[];
  miniMaps: MiniMap[];
  spawnMarkers: MapMarker[];
  selectedSeason?: number;
  selectedChapter?: number;
}) {
  const safeType = targetType ?? "world_marker";
  const { filter: miniMapFilter, setFilter: setMiniMapFilter, filteredMiniMaps } = useMiniMapChapterFilter(miniMaps, selectedSeason, selectedChapter);
  const worldTargets = worldMarkers.filter((marker) => !marker.mini_map_id);
  const targetSpawns = spawnMarkers.filter((marker) => marker.mini_map_id === targetMiniMapId && marker.type === "Player Spawn");
  const selectedWorldTarget = worldTargets.find((marker) => marker.id === targetMarkerId) ?? null;
  const selectedMiniMap = miniMaps.find((miniMap) => miniMap.id === targetMiniMapId) ?? null;
  const selectedSpawn = targetSpawns.find((marker) => marker.id === targetSpawnMarkerId) ?? null;

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Exit Target</Text>
      <Text style={styles.copy}>Choose exactly where this exit sends the player. Save Marker Details after changing this section.</Text>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Current Exit</Text>
        <Text style={styles.summaryValue}>
          {safeType === "world_marker"
            ? selectedWorldTarget
              ? `World: ${selectedWorldTarget.title}`
              : "World: no return marker selected"
            : selectedMiniMap
              ? `Mini Map: ${selectedMiniMap.name}${selectedSpawn ? ` / Spawn: ${selectedSpawn.title}` : " / center fallback"}`
              : "Mini Map: no target selected"}
        </Text>
      </View>
      <View style={styles.storyRoutePicker}>
        {exitTargetTypes.map((type) => (
          <Pressable
            key={type}
            style={[styles.routeChip, safeType === type && styles.routeChipActive]}
            onPress={() => {
              setTargetType(type);
              if (type === "world_marker") {
                setTargetMiniMapId(null);
                setTargetSpawnMarkerId(null);
              } else {
                setTargetMarkerId(null);
              }
            }}
          >
            <Text style={styles.routeChipText}>{type === "world_marker" ? "Return To World Marker" : "Open Another Mini Map"}</Text>
          </Pressable>
        ))}
      </View>
      {safeType === "world_marker" ? (
        <View style={styles.pickerPanel}>
          <Text style={styles.selectedTitle}>World Return Marker</Text>
          <Text style={styles.copy}>Pick the overworld marker/location this exit returns to.</Text>
          <View style={styles.pickerGrid}>
            <Pressable style={[styles.targetCard, targetMarkerId === null && styles.routeChipActive]} onPress={() => setTargetMarkerId(null)}>
              <Text style={styles.targetCardTitle}>None</Text>
              <Text style={styles.targetCardMeta}>No saved world return</Text>
            </Pressable>
            {worldTargets.map((marker) => (
              <Pressable key={marker.id} style={[styles.targetCard, targetMarkerId === marker.id && styles.routeChipActive]} onPress={() => setTargetMarkerId(marker.id)}>
                <Text style={styles.targetCardTitle}>{marker.title}</Text>
                <Text style={styles.targetCardMeta}>{marker.type} / X {Number(marker.x_percent).toFixed(1)} / Y {Number(marker.y_percent).toFixed(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.pickerPanel}>
            <Text style={styles.selectedTitle}>Linked Mini Map</Text>
            <Text style={styles.copy}>Pick the mini map this exit opens. Targets can cross chapters; use the filter only to shorten the list.</Text>
            <MiniMapChapterFilterBar filter={miniMapFilter} setFilter={setMiniMapFilter} selectedSeason={selectedSeason} selectedChapter={selectedChapter} />
            <View style={styles.pickerGrid}>
              <Pressable
                style={[styles.targetCard, targetMiniMapId === null && styles.routeChipActive]}
                onPress={() => {
                  setTargetMiniMapId(null);
                  setTargetSpawnMarkerId(null);
                }}
              >
                <Text style={styles.targetCardTitle}>None</Text>
                <Text style={styles.targetCardMeta}>No mini map target</Text>
              </Pressable>
              {filteredMiniMaps.map((miniMap) => (
                <Pressable
                  key={miniMap.id}
                  style={[styles.targetCard, targetMiniMapId === miniMap.id && styles.routeChipActive]}
                  onPress={() => {
                    setTargetMiniMapId(miniMap.id);
                    setTargetSpawnMarkerId(null);
                  }}
                >
                  <Text style={styles.targetCardTitle}>{miniMap.name}</Text>
                  <Text style={styles.targetCardMeta}>{formatMiniMapChapter(miniMap)} / {miniMap.type}{miniMap.area_name ? ` / ${miniMap.area_name}` : ""}</Text>
                </Pressable>
              ))}
            </View>
            {filteredMiniMaps.length === 0 ? <Text style={styles.debugLine}>No mini maps match this filter.</Text> : null}
          </View>
          {targetMiniMapId ? (
            <View style={styles.pickerPanel}>
              <Text style={styles.selectedTitle}>Target Spawn In Mini Map</Text>
              <Text style={styles.copy}>Use a Player Spawn marker to control exactly where the player appears.</Text>
              <View style={styles.pickerGrid}>
                <Pressable style={[styles.targetCard, targetSpawnMarkerId === null && styles.routeChipActive]} onPress={() => setTargetSpawnMarkerId(null)}>
                  <Text style={styles.targetCardTitle}>None</Text>
                  <Text style={styles.targetCardMeta}>Use center fallback</Text>
                </Pressable>
                {targetSpawns.map((marker) => (
                  <Pressable key={marker.id} style={[styles.targetCard, targetSpawnMarkerId === marker.id && styles.routeChipActive]} onPress={() => setTargetSpawnMarkerId(marker.id)}>
                    <Text style={styles.targetCardTitle}>{marker.title}</Text>
                    <Text style={styles.targetCardMeta}>X {Number(marker.x_percent).toFixed(1)} / Y {Number(marker.y_percent).toFixed(1)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {safeType === "mini_map" && targetMiniMapId && targetSpawns.length === 0 ? (
            <Text style={styles.debugLine}>No Player Spawn marker exists in this mini map yet. The exit will fall back to the center of the mini map.</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

export function MarketListingModePicker({ value, onSelect }: { value: MarkerMarketItem["listing_mode"]; onSelect: (value: MarkerMarketItem["listing_mode"]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Listing Mode</Text>
      <View style={styles.storyRoutePicker}>
        {marketListingModes.map((mode) => (
          <Pressable key={mode} style={[styles.routeChip, value === mode && styles.routeChipActive]} onPress={() => onSelect(mode)}>
            <Text style={styles.routeChipText}>{formatMarketListingMode(mode)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.copy}>Sell Only means this market buys the item from players but does not sell it as stock.</Text>
    </View>
  );
}

export function RoutePicker({ routes, selectedId, onSelect }: { routes: MapRoute[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Walking Path</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {routes.map((route) => (
          <Pressable key={route.id} style={[styles.routeChip, selectedId === route.id && styles.routeChipActive]} onPress={() => onSelect(route.id)}>
            <Text style={styles.routeChipText}>{route.sort_order}. {route.name}{route.mini_map_id ? " (Mini)" : " (World)"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function EventPicker({ label, events, selectedId, onSelect }: { label: string; events: MapEvent[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {events.map((event) => (
          <Pressable key={event.id} style={[styles.routeChip, selectedId === event.id && styles.routeChipActive]} onPress={() => onSelect(event.id)}>
            <Text style={styles.routeChipText}>{event.title}</Text>
          </Pressable>
        ))}
      </View>
      {events.length === 0 ? <Text style={styles.copy}>Create a reusable event first, then link it here.</Text> : null}
    </View>
  );
}

export function EnemyPicker({ enemies, selectedId, onSelect }: { enemies: EnemyDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.copy}>Select an enemy created in Home / Abilities / Enemy Admin.</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>Manual Enemy</Text>
        </Pressable>
        {enemies.map((enemy) => (
          <Pressable key={enemy.id} style={[styles.routeChip, selectedId === enemy.id && styles.routeChipActive]} onPress={() => onSelect(enemy.id)}>
            <Text style={styles.routeChipText}>{enemy.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function NpcPicker({ label, npcs, selectedId, onSelect, battleOnly = false }: { label: string; npcs: NpcDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void; battleOnly?: boolean }) {
  const options = battleOnly ? npcs.filter((npc) => npc.can_battle) : npcs;
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.copy}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {options.map((npc) => (
          <Pressable key={npc.id} style={[styles.routeChip, selectedId === npc.id && styles.routeChipActive]} onPress={() => onSelect(npc.id)}>
            <Text style={styles.routeChipText}>{npc.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MiniMapPicker({
  miniMaps,
  selectedId,
  onSelect,
  selectedSeason,
  selectedChapter,
  helper,
}: {
  miniMaps: MiniMap[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedSeason?: number;
  selectedChapter?: number;
  helper?: string;
}) {
  const { filter, setFilter, filteredMiniMaps } = useMiniMapChapterFilter(miniMaps, selectedSeason, selectedChapter);
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Mini Map</Text>
      {helper ? <Text style={styles.copy}>{helper}</Text> : null}
      <MiniMapChapterFilterBar filter={filter} setFilter={setFilter} selectedSeason={selectedSeason} selectedChapter={selectedChapter} />
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {filteredMiniMaps.map((miniMap) => (
          <Pressable key={miniMap.id} style={[styles.routeChip, selectedId === miniMap.id && styles.routeChipActive]} onPress={() => onSelect(miniMap.id)}>
            <Text style={styles.routeChipText}>{miniMap.name} ({formatMiniMapChapter(miniMap)})</Text>
          </Pressable>
        ))}
      </View>
      {filteredMiniMaps.length === 0 ? <Text style={styles.debugLine}>No mini maps match this filter.</Text> : null}
    </View>
  );
}

export function MarkerPicker({ label, markers, selectedId, onSelect }: { label: string; markers: MapMarker[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {markers.map((marker) => (
          <Pressable key={marker.id} style={[styles.routeChip, selectedId === marker.id && styles.routeChipActive]} onPress={() => onSelect(marker.id)}>
            <Text style={styles.routeChipText}>{marker.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function getItemName(items: ItemDefinition[], itemId: string | null) {
  return items.find((item) => item.id === itemId)?.name ?? "Unknown Item";
}

export function formatMarketListingMode(mode: MarkerMarketItem["listing_mode"] | null | undefined) {
  if (mode === "buy_only") {
    return "Buy Only";
  }
  if (mode === "sell_only") {
    return "Sell Only";
  }
  return "Buy and Sell";
}

export function getEnemyName(enemies: EnemyDefinition[], enemyId: string | null) {
  return enemies.find((enemy) => enemy.id === enemyId)?.name ?? "Unknown Enemy";
}

export function getNpcName(npcs: NpcDefinition[], npcId: string | null) {
  return npcs.find((npc) => npc.id === npcId)?.name ?? "Unknown NPC";
}

export function getRouteName(routes: MapRoute[], routeId: string) {
  return routes.find((route) => route.id === routeId)?.name ?? "Unknown Path";
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(30, 168, 236, 0.22)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  selectedTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  storyEditor: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerPanel: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  summaryBox: {
    backgroundColor: "rgba(30, 168, 236, 0.12)",
    borderColor: colors.blue,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  summaryLabel: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 12,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "800",
  },
  targetCard: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 4,
    minWidth: 160,
    padding: 10,
  },
  targetCardMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  targetCardTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
