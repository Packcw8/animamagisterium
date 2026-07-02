import { Pressable, StyleSheet, Text, View } from "react-native";
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
}) {
  const safeType = targetType ?? "world_marker";
  const worldTargets = worldMarkers.filter((marker) => !marker.mini_map_id);
  const targetSpawns = spawnMarkers.filter((marker) => marker.mini_map_id === targetMiniMapId && marker.type === "Player Spawn");

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Exit Target</Text>
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
        <MarkerPicker label="World return marker" markers={worldTargets} selectedId={targetMarkerId} onSelect={setTargetMarkerId} />
      ) : (
        <>
          <MiniMapPicker
            miniMaps={miniMaps}
            selectedId={targetMiniMapId}
            onSelect={(miniMapId) => {
              setTargetMiniMapId(miniMapId);
              setTargetSpawnMarkerId(null);
            }}
          />
          {targetMiniMapId ? (
            <MarkerPicker label="Target spawn in mini map" markers={targetSpawns} selectedId={targetSpawnMarkerId} onSelect={setTargetSpawnMarkerId} />
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
            <Text style={styles.routeChipText}>{route.sort_order}. {route.name}</Text>
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

export function MiniMapPicker({ miniMaps, selectedId, onSelect }: { miniMaps: MiniMap[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Mini Map</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {miniMaps.map((miniMap) => (
          <Pressable key={miniMap.id} style={[styles.routeChip, selectedId === miniMap.id && styles.routeChipActive]} onPress={() => onSelect(miniMap.id)}>
            <Text style={styles.routeChipText}>{miniMap.name}</Text>
          </Pressable>
        ))}
      </View>
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
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
