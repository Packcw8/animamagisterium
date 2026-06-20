import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { canUseItemInContext, type InventoryItem, type ItemDefinition, resolveInventoryImageUri } from "../../services/inventoryService";
import {
  canMarketItemBeBought,
  canMarketItemBeSoldTo,
  type MapMarker,
  type MapRoute,
  type MarkerMarketItem,
  type MarkerRouteLink,
} from "../../services/mapService";
import {
  getMarkerLockMessage,
  getOrderedMarkerRouteLinks,
  isExitMarker,
  isStoryQuestMarker,
} from "../../utils/mapVisibility";
import { getRouteLockLabel, getRouteLockMessage, isRouteLocked } from "../../utils/mapProgress";

export function MarkerSceneScreen({
  marker,
  characterGold,
  marketItems,
  marketPurchaseCounts,
  routeLinks,
  routes,
  routeProgressRows,
  inventoryItems,
  itemDefinitions,
  message,
  onExit,
  onBuy,
  onSell,
  onClaimReward,
  onAcceptQuest,
  onStartPath,
  onUseExit,
  onEnterArea,
  onOpenDialogueEvent,
  onStartBattleEvent,
}: {
  marker: MapMarker;
  characterGold: number;
  marketItems: MarkerMarketItem[];
  marketPurchaseCounts: Record<string, number>;
  routeLinks: MarkerRouteLink[];
  routes: MapRoute[];
  routeProgressRows: Array<{ route_id: string; progress_percent: number; is_current?: boolean }>;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  message: string | null;
  onExit: () => void;
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
  onClaimReward: () => void;
  onAcceptQuest: () => void;
  onStartPath: (route: MapRoute) => void;
  onUseExit: () => void;
  onEnterArea: () => void;
  onOpenDialogueEvent: () => void;
  onStartBattleEvent: () => void;
}) {
  const backgroundUri = resolveSceneImageUri(marker.scene_background_image_url || marker.shop_background_image_url);
  const npcUri = resolveSceneImageUri(marker.scene_npc_image_url || marker.shop_image_url || marker.quest_image_url);
  const orderedRouteLinks = getOrderedMarkerRouteLinks(routeLinks);
  const storyLinkedRoutes = orderedRouteLinks
    .map((link) => ({ link, route: routes.find((item) => item.id === link.route_id) ?? null }))
    .filter((item): item is { link: MarkerRouteLink; route: MapRoute } => Boolean(item.route));
  const firstIncompleteStoryRoute = storyLinkedRoutes.find(({ route }) => {
    const progress = routeProgressRows.find((row) => row.route_id === route.id)?.progress_percent ?? 0;
    return progress < 100;
  });
  const nextStoryRoute = firstIncompleteStoryRoute?.route ?? null;
  const nextStoryRouteLocked = nextStoryRoute ? isRouteLocked(nextStoryRoute) : false;
  const storyRoutesComplete = storyLinkedRoutes.length > 0 && !firstIncompleteStoryRoute;

  return (
    <Screen>
      <Frame style={backgroundUri ? [styles.eventScreen, ({ backgroundImage: `url(${backgroundUri})`, backgroundSize: "cover", backgroundPosition: "center" } as never)] : styles.eventScreen}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>{marker.quest_title || marker.title}</Text>
            <Text style={styles.copy}>{marker.type}</Text>
          </View>
          <Pressable style={styles.secondaryButtonFlex} onPress={onExit}>
            <Text style={styles.secondaryText}>Leave</Text>
          </Pressable>
        </View>
        {npcUri ? <Image source={{ uri: npcUri }} style={marker.type === "Market" ? styles.eventImage : styles.npcPortrait} /> : null}
        {marker.description ? <Text style={styles.copy}>{marker.description}</Text> : null}
        {marker.quest_dialogue ? <Text style={styles.dialogueText}>{marker.quest_dialogue}</Text> : null}
        {message ? <Text style={styles.adminMessage}>{message}</Text> : null}
        {isExitMarker(marker) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
            {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={onUseExit}>
              <Text style={styles.primaryText}>Exit / Leave</Text>
            </Pressable>
          </View>
        ) : marker.type === "Area/Town Entrance" ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
            {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={onEnterArea}>
              <Text style={styles.primaryText}>Enter Area</Text>
            </Pressable>
          </View>
        ) : marker.type === "Sign Post" ? (
          <SignPostScene
            routeLinks={orderedRouteLinks}
            routes={routes}
            routeProgressRows={routeProgressRows}
            onStartPath={onStartPath}
          />
        ) : isStoryQuestMarker(marker) && storyLinkedRoutes.length > 0 ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Story Quest Paths</Text>
            <Text style={styles.copy}>Complete these walking paths in order to finish this story quest.</Text>
            {storyLinkedRoutes.map(({ link, route }, index) => {
              const progress = routeProgressRows.find((row) => row.route_id === route.id)?.progress_percent ?? 0;
              const complete = progress >= 100;
              const current = route.id === nextStoryRoute?.id;
              const locked = !complete && !current;

              return (
                <View key={link.id} style={[styles.storyCard, locked && styles.lockedCard]}>
                  <Text style={styles.markerName}>{index + 1}. {route.name}</Text>
                  <Text style={styles.copy}>Destination: {link.destination_label || route.terrain}</Text>
                  <Text style={styles.copy}>{metersToMiles(route.distance_required_meters)} mi / Progress {Math.round(progress)}%</Text>
                  <Text style={complete ? styles.unlockText : locked ? styles.lockText : styles.adminMessage}>
                    {complete ? "Completed" : locked ? "Locked until earlier story paths are completed" : nextStoryRouteLocked ? getRouteLockMessage(route) : "Next path"}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.copy}>
              Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
              {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
            </Text>
            <Pressable style={[styles.primaryButton, nextStoryRouteLocked && !storyRoutesComplete && styles.disabledAction]} onPress={onAcceptQuest} disabled={nextStoryRouteLocked && !storyRoutesComplete}>
              <Text style={styles.primaryText}>
                {storyRoutesComplete ? "Complete Story Quest" : nextStoryRoute ? `Start ${nextStoryRoute.name}` : "Continue Story Quest"}
              </Text>
            </Pressable>
          </View>
        ) : marker.type === "Market" ? (
          <MarketScene
            characterGold={characterGold}
            marketItems={marketItems}
            marketPurchaseCounts={marketPurchaseCounts}
            inventoryItems={inventoryItems}
            itemDefinitions={itemDefinitions}
            onBuy={onBuy}
            onSell={onSell}
          />
        ) : isBattleMarkerType(marker.type) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Battle</Text>
            <Text style={styles.copy}>{marker.battle_event_id ? "This marker starts its linked Battle Event without changing trail progress." : "No Battle Event is linked to this marker yet."}</Text>
            <Pressable style={[styles.primaryButton, !marker.battle_event_id && styles.disabledAction]} onPress={onStartBattleEvent} disabled={!marker.battle_event_id}>
              <Text style={styles.primaryText}>Start Battle</Text>
            </Pressable>
          </View>
        ) : marker.dialogue_event_id ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Dialogue</Text>
            <Text style={styles.copy}>Open the linked dialogue tree for this marker.</Text>
            <Pressable style={styles.primaryButton} onPress={onOpenDialogueEvent}>
              <Text style={styles.primaryText}>Start Dialogue</Text>
            </Pressable>
            <Text style={styles.copy}>
              Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
              {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
            </Text>
          </View>
        ) : (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Options</Text>
            <Text style={styles.copy}>
              Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
              {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
            </Text>
            {marker.linked_route_id && marker.starts_route_on_accept ? <Text style={styles.copy}>Accepting this quest starts its linked walking path.</Text> : null}
            <Pressable style={styles.primaryButton} onPress={marker.linked_route_id && marker.starts_route_on_accept ? onAcceptQuest : onClaimReward}>
              <Text style={styles.primaryText}>{marker.linked_route_id && marker.starts_route_on_accept ? "Accept Quest" : marker.type === "Side Quest" ? "Complete Quest" : "Claim Reward"}</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.secondaryButton} onPress={onExit}>
          <Text style={styles.secondaryText}>Exit to Map</Text>
        </Pressable>
      </Frame>
    </Screen>
  );
}

function SignPostScene({
  routeLinks,
  routes,
  routeProgressRows,
  onStartPath,
}: {
  routeLinks: MarkerRouteLink[];
  routes: MapRoute[];
  routeProgressRows: Array<{ route_id: string; progress_percent: number; is_current?: boolean }>;
  onStartPath: (route: MapRoute) => void;
}) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Choose Your Path</Text>
      {routeLinks.length === 0 ? <Text style={styles.copy}>No walking paths are linked to this sign post yet.</Text> : null}
      {routeLinks.map((link) => {
        const linkedRoute = routes.find((item) => item.id === link.route_id);
        const progress = routeProgressRows.find((row) => row.route_id === link.route_id)?.progress_percent ?? 0;

        if (!linkedRoute) {
          return null;
        }
        const locked = isRouteLocked(linkedRoute);

        return (
          <View key={link.id} style={[styles.storyCard, locked && styles.lockedCard]}>
            <Text style={styles.markerName}>{linkedRoute.name}</Text>
            <Text style={styles.copy}>Destination: {link.destination_label || linkedRoute.terrain}</Text>
            <Text style={styles.copy}>{metersToMiles(linkedRoute.distance_required_meters)} mi / Progress {Math.round(progress)}%</Text>
            <Text style={locked ? styles.lockText : styles.unlockText}>{locked ? getRouteLockMessage(linkedRoute) : "Available"}</Text>
            <Pressable style={[styles.primaryButton, locked && styles.disabledAction]} onPress={() => onStartPath(linkedRoute)} disabled={locked}>
              <Text style={styles.primaryText}>{locked ? getRouteLockLabel(linkedRoute) : "Start Path"}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function MarketScene({
  characterGold,
  marketItems,
  marketPurchaseCounts,
  inventoryItems,
  itemDefinitions,
  onBuy,
  onSell,
}: {
  characterGold: number;
  marketItems: MarkerMarketItem[];
  marketPurchaseCounts: Record<string, number>;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
}) {
  const buyableItems = marketItems.filter((item) => canMarketItemBeBought(item) && getRemainingMarketStock(item, marketPurchaseCounts) > 0);
  const sellableItems = inventoryItems.filter((entry) => entry.item.sellable && marketItems.some((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item)));

  return (
    <View style={styles.storyEditor}>
      <View style={styles.marketHeaderRow}>
        <Text style={styles.selectedTitle}>Market</Text>
        <View style={styles.marketGoldPill}>
          <Text style={styles.marketPriceLabel}>Your Gold</Text>
          <Text style={styles.marketBuyPrice}>{characterGold.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.marketGrid}>
        {buyableItems.length === 0 ? <Text style={styles.copy}>This market has no items for sale.</Text> : null}
        {buyableItems.map((marketItem) => (
          <MarketBuyCard
            key={marketItem.id}
            marketItem={marketItem}
            purchasedCount={marketPurchaseCounts[marketItem.id] ?? 0}
            item={getItemDefinition(itemDefinitions, marketItem.item_id)}
            onBuy={() => onBuy(marketItem)}
          />
        ))}
      </View>
      <Text style={styles.selectedTitle}>Sell</Text>
      <View style={styles.marketGrid}>
        {sellableItems.length === 0 ? <Text style={styles.copy}>This market is not buying anything in your inventory.</Text> : null}
        {sellableItems.map((entry) => {
          const marketItem = marketItems.find((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item));
          return (
            <MarketSellCard
              key={entry.id}
              entry={entry}
              sellPrice={marketItem?.sell_price ?? 0}
              onSell={() => onSell(entry)}
            />
          );
        })}
      </View>
    </View>
  );
}

function MarketBuyCard({ marketItem, purchasedCount, item, onBuy }: { marketItem: MarkerMarketItem; purchasedCount: number; item: ItemDefinition | null; onBuy: () => void }) {
  const imageUri = resolveInventoryImageUri(item?.image_path);
  const remainingStock = getRemainingMarketStock(marketItem, { [marketItem.id]: purchasedCount });
  const outOfStock = remainingStock <= 0;

  return (
    <View style={[styles.marketCard, outOfStock && styles.lockedCard]}>
      <View style={styles.marketImageBox}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{(item?.name ?? "?").slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{item?.name ?? "Unknown Item"}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{item?.type ?? "item"} / {item?.rarity ?? "common"}</Text>
        <View style={styles.marketPriceRow}>
          <Text style={styles.marketPriceLabel}>Buy</Text>
          <Text style={styles.marketBuyPrice}>{marketItem.buy_price} gold</Text>
        </View>
        <Text style={styles.marketStockText}>{marketItem.unlimited_stock ? "Unlimited stock" : `${remainingStock} available for you`}</Text>
      </View>
      <Pressable style={[styles.marketActionButton, outOfStock && styles.disabledAction]} onPress={onBuy} disabled={outOfStock}>
        <Text style={styles.primaryText}>{outOfStock ? "Sold Out" : "Buy"}</Text>
      </Pressable>
    </View>
  );
}

function MarketSellCard({ entry, sellPrice, onSell }: { entry: InventoryItem; sellPrice: number; onSell: () => void }) {
  const imageUri = resolveInventoryImageUri(entry.item.image_path);

  return (
    <View style={styles.marketCard}>
      <View style={styles.marketImageBox}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{entry.item.name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{entry.item.name}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{entry.item.type} / owned x{entry.quantity}</Text>
        <View style={styles.marketPriceRow}>
          <Text style={styles.marketPriceLabel}>Sell</Text>
          <Text style={styles.marketSellPrice}>{sellPrice} gold</Text>
        </View>
        <Text style={styles.marketStockText}>{entry.item.description || "Marketable inventory item"}</Text>
      </View>
      <Pressable style={styles.marketSellButton} onPress={onSell}>
        <Text style={styles.secondaryText}>Sell One</Text>
      </Pressable>
    </View>
  );
}

function resolveSceneImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

function getItemName(items: ItemDefinition[], itemId: string | null) {
  return items.find((item) => item.id === itemId)?.name ?? "item";
}

function getItemDefinition(items: ItemDefinition[], itemId: string | null) {
  return items.find((item) => item.id === itemId) ?? null;
}

function isBattleMarkerType(type: string) {
  return type === "Battle" || type === "Battle Zone";
}

function getRemainingMarketStock(marketItem: MarkerMarketItem, purchaseCounts: Record<string, number>) {
  if (marketItem.unlimited_stock) {
    return Number.POSITIVE_INFINITY;
  }

  const stockLimit = Math.max(0, Number(marketItem.stock_quantity) || 0);
  const purchased = Math.max(0, Number(purchaseCounts[marketItem.id]) || 0);
  return Math.max(0, stockLimit - purchased);
}

const styles = StyleSheet.create({
  eventScreen: {
    margin: 12,
    padding: 14,
    gap: 12,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryButtonFlex: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  eventImage: {
    width: "100%",
    height: 220,
    borderRadius: 8,
  },
  npcPortrait: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  adminMessage: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  storyEditor: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  selectedTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
  dialogueText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#120e08",
    fontWeight: "900",
  },
  storyCard: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  markerName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 2,
  },
  lockedCard: {
    borderStyle: "dashed",
    opacity: 0.68,
  },
  lockText: {
    color: "#f0a0a0",
    fontWeight: "800",
    lineHeight: 18,
  },
  unlockText: {
    color: colors.blue,
    fontWeight: "800",
  },
  disabledAction: {
    opacity: 0.45,
  },
  marketGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  marketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  marketGoldPill: {
    minWidth: 128,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(218,164,65,0.1)",
    alignItems: "flex-end",
  },
  marketCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  marketImageBox: {
    width: "100%",
    aspectRatio: 1.45,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(218,164,65,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  marketItemImage: {
    width: "100%",
    height: "100%",
  },
  marketItemFallback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 30,
  },
  marketCardBody: {
    gap: 5,
  },
  marketItemName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  marketItemType: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "capitalize",
  },
  marketPriceRow: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(218,164,65,0.08)",
  },
  marketPriceLabel: {
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 11,
  },
  marketBuyPrice: {
    color: colors.gold,
    fontWeight: "900",
  },
  marketSellPrice: {
    color: colors.blue,
    fontWeight: "900",
  },
  marketStockText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  marketActionButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  marketSellButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,61,86,0.28)",
  },
});
