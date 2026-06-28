import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { canMarketItemBeBought, canMarketItemBeSoldTo, type MapMarker, type MapRoute, type MarkerMarketItem, type MarkerRouteLink } from "../../services/mapService";
import type { InventoryItem, ItemDefinition } from "../../services/inventoryService";
import { getMarkerLockMessage } from "../../utils/mapVisibility";
import { getRouteLockLabel, getRouteLockMessage, isRouteLocked } from "../../utils/mapProgress";
import { Frame } from "../Frame";
import { colors, fonts } from "../theme";

type MarkerInteractionPanelProps = {
  marker: MapMarker;
  message: string | null;
  locked: boolean;
  canUse: boolean;
  unavailableReason: string | null;
  distance: number;
  radius: number;
  isTracking: boolean;
  routeLinks: MarkerRouteLink[];
  routes: MapRoute[];
  routeProgressRows: Array<{ route_id: string; progress_percent: number; travel_direction?: "forward" | "reverse" }>;
  marketItems: MarkerMarketItem[];
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  onClose: () => void;
  onStartTracking: () => void;
  onStartPath: (route: MapRoute) => void;
  onEnterArea: () => void;
  onStartBattleEvent: () => void;
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (entry: InventoryItem) => void;
  onClaimReward: () => void;
};

export function MarkerInteractionPanel({
  marker,
  message,
  locked,
  canUse,
  unavailableReason,
  distance,
  radius,
  isTracking,
  routeLinks,
  routes,
  routeProgressRows,
  marketItems,
  inventoryItems,
  itemDefinitions,
  onClose,
  onStartTracking,
  onStartPath,
  onEnterArea,
  onStartBattleEvent,
  onBuy,
  onSell,
  onClaimReward,
}: MarkerInteractionPanelProps) {
  if (locked) {
    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Locked</Text>
          <Text style={styles.dialogueText}>{getMarkerLockMessage(marker)}</Text>
        </View>
      </PanelShell>
    );
  }

  if (!canUse) {
    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          {marker.quest_image_url || marker.shop_image_url ? <Image source={{ uri: marker.shop_image_url || marker.quest_image_url || "" }} style={styles.eventImage} /> : null}
          <Text style={styles.selectedTitle}>Travel Required</Text>
          <Text style={styles.copy}>{unavailableReason ?? `You need to travel closer before entering. Distance: ${distance.toFixed(2)}% / Required: ${radius.toFixed(2)}%.`}</Text>
          <Pressable style={styles.primaryButton} onPress={isTracking ? undefined : onStartTracking}>
            <Text style={styles.primaryText}>{isTracking ? "Tracking Walk" : "Start Tracking Walk"}</Text>
          </Pressable>
        </View>
      </PanelShell>
    );
  }

  if (marker.type === "Sign Post") {
    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
          {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
          {routeLinks.length === 0 ? <Text style={styles.copy}>No walking paths are linked to this sign post yet.</Text> : null}
          {routeLinks.map((link) => {
            const linkedRoute = routes.find((item) => item.id === link.route_id);
            const progress = routeProgressRows.find((row) => row.route_id === link.route_id)?.progress_percent ?? 0;

            if (!linkedRoute) {
              return null;
            }
            const routeLocked = isRouteLocked(linkedRoute);

            return (
              <View key={link.id} style={[styles.storyCard, routeLocked && styles.lockedCard]}>
                <Text style={styles.markerName}>{linkedRoute.name}</Text>
                <Text style={styles.copy}>Destination: {link.destination_label || linkedRoute.terrain}</Text>
                <Text style={styles.copy}>{metersToMiles(linkedRoute.distance_required_meters)} mi / Progress {Math.round(progress)}%</Text>
                <Text style={routeLocked ? styles.lockText : styles.unlockText}>{routeLocked ? getRouteLockMessage(linkedRoute) : "Available"}</Text>
                <Pressable style={[styles.primaryButton, routeLocked && styles.disabledAction]} onPress={() => onStartPath(linkedRoute)} disabled={routeLocked}>
                  <Text style={styles.primaryText}>{routeLocked ? getRouteLockLabel(linkedRoute) : "Start Path"}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </PanelShell>
    );
  }

  if (marker.type === "Area/Town Entrance") {
    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          {marker.scene_background_image_url || marker.quest_image_url ? <Image source={{ uri: marker.scene_background_image_url || marker.quest_image_url || "" }} style={styles.eventImage} /> : null}
          <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
          {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={onEnterArea}>
            <Text style={styles.primaryText}>Enter Area</Text>
          </Pressable>
        </View>
      </PanelShell>
    );
  }

  if (isBattleMarkerType(marker.type)) {
    const hasOpponent = Boolean(marker.battle_event_id || marker.enemy_id || marker.npc_id);

    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          {marker.scene_npc_image_url || marker.quest_image_url ? <Image source={{ uri: marker.scene_npc_image_url || marker.quest_image_url || "" }} style={styles.eventImage} /> : null}
          <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
          {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
          <Text style={styles.copy}>{hasOpponent ? "This marker starts a standalone battle." : "No Battle Event, Enemy, or NPC is linked to this battle marker yet."}</Text>
          <Pressable style={[styles.primaryButton, !hasOpponent && styles.disabledAction]} onPress={onStartBattleEvent} disabled={!hasOpponent}>
            <Text style={styles.primaryText}>Start Battle</Text>
          </Pressable>
        </View>
      </PanelShell>
    );
  }

  if (marker.type === "NPC") {
    const hasOpponent = Boolean(marker.battle_event_id || marker.enemy_id);

    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={styles.storyEditor}>
          {marker.scene_npc_image_url || marker.quest_image_url ? <Image source={{ uri: marker.scene_npc_image_url || marker.quest_image_url || "" }} style={styles.eventImage} /> : null}
          <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
          {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
          <Text style={styles.copy}>Open this NPC from the full marker scene to use its linked dialogue tree.</Text>
          {hasOpponent ? (
            <Pressable style={styles.secondaryButton} onPress={onStartBattleEvent}>
              <Text style={styles.secondaryText}>Challenge / Fight</Text>
            </Pressable>
          ) : null}
        </View>
      </PanelShell>
    );
  }

  if (marker.type === "Market") {
    const buyableItems = marketItems.filter(canMarketItemBeBought);
    const sellableItems = inventoryItems.filter((entry) => entry.item.sellable && marketItems.some((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item)));

    return (
      <PanelShell marker={marker} message={message} onClose={onClose}>
        <View style={[styles.shopPanel, marker.shop_background_image_url ? ({ backgroundImage: `url(${marker.shop_background_image_url})` } as object) : null]}>
          {marker.shop_image_url ? <Image source={{ uri: marker.shop_image_url }} style={styles.eventImage} /> : null}
          <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
          {marker.quest_dialogue ? <Text style={styles.dialogueText}>{marker.quest_dialogue}</Text> : null}
          <Text style={styles.selectedTitle}>Buy</Text>
          {buyableItems.length === 0 ? <Text style={styles.copy}>This market has no items for sale.</Text> : null}
          {buyableItems.map((marketItem) => (
            <View key={marketItem.id} style={styles.storyCard}>
              <Text style={styles.markerName}>{getItemName(itemDefinitions, marketItem.item_id)}</Text>
              <Text style={styles.copy}>{marketItem.buy_price} gold / {marketItem.unlimited_stock ? "Unlimited stock" : `${marketItem.stock_quantity ?? 0} left`}</Text>
              <Pressable style={styles.primaryButton} onPress={() => onBuy(marketItem)}>
                <Text style={styles.primaryText}>Buy</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.selectedTitle}>Sell</Text>
          {sellableItems.length === 0 ? <Text style={styles.copy}>This market is not buying anything in your inventory.</Text> : null}
          {sellableItems.map((entry) => {
            const marketItem = marketItems.find((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item));
            const price = marketItem?.sell_price ?? 0;
            return (
              <View key={entry.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{entry.item.name} x{entry.quantity}</Text>
                <Text style={styles.copy}>Sell for {price} gold</Text>
                <Pressable style={styles.secondaryButton} onPress={() => onSell(entry)}>
                  <Text style={styles.secondaryText}>Sell One</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </PanelShell>
    );
  }

  return (
    <PanelShell marker={marker} message={message} onClose={onClose}>
      <View style={styles.storyEditor}>
        {marker.quest_image_url ? <Image source={{ uri: marker.quest_image_url }} style={styles.eventImage} /> : null}
        <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
        {marker.quest_dialogue ? <Text style={styles.dialogueText}>{marker.quest_dialogue}</Text> : null}
        <Text style={styles.copy}>
          Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
          {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
          {marker.reward_full_heal ? " / Full heal" : ""}
        </Text>
        <Pressable style={styles.primaryButton} onPress={onClaimReward}>
          <Text style={styles.primaryText}>Claim Reward</Text>
        </Pressable>
      </View>
    </PanelShell>
  );
}

function isBattleMarkerType(type: string) {
  return type === "Battle" || type === "Battle Zone";
}

function PanelShell({ marker, message, onClose, children }: { marker: MapMarker; message: string | null; onClose: () => void; children: ReactNode }) {
  return (
    <Frame style={styles.panel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.sectionTitle}>{marker.title}</Text>
          <Text style={styles.copy}>{marker.type}</Text>
        </View>
        <Pressable style={styles.secondaryButtonFlex} onPress={onClose}>
          <Text style={styles.secondaryText}>Close</Text>
        </Pressable>
      </View>
      {marker.description ? <Text style={styles.copy}>{marker.description}</Text> : null}
      {message ? <Text style={styles.adminMessage}>{message}</Text> : null}
      {children}
    </Frame>
  );
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

function getItemName(items: ItemDefinition[], itemId: string | null) {
  if (!itemId) {
    return "No item";
  }
  return items.find((item) => item.id === itemId)?.name ?? "Unknown item";
}

const styles = StyleSheet.create({
  adminMessage: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  dialogueText: {
    color: colors.text,
    lineHeight: 20,
  },
  disabledAction: {
    opacity: 0.5,
  },
  eventImage: {
    borderRadius: 8,
    height: 160,
    width: "100%",
  },
  lockText: {
    color: colors.red,
    fontFamily: fonts.title,
  },
  lockedCard: {
    opacity: 0.7,
  },
  markerName: {
    color: colors.text,
    fontFamily: fonts.title,
  },
  panel: {
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 14,
  },
  primaryText: {
    color: colors.bg,
    fontFamily: fonts.title,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryButtonFlex: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
    textTransform: "uppercase",
  },
  selectedTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  shopPanel: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    padding: 10,
  },
  storyCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  storyEditor: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  unlockText: {
    color: colors.green,
    fontFamily: fonts.title,
  },
});
