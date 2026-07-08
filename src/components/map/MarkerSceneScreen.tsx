import { useState } from "react";
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
import type { ArenaLeaderboardEntry, ArenaWithLeaders } from "../../services/arenaService";

const marketModes = ["Buy", "Sell"] as const;
type MarketMode = (typeof marketModes)[number];

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
  markerHasDialogue,
  arena,
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
  onClaimArena,
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
  markerHasDialogue: boolean;
  arena: ArenaWithLeaders | null;
  message: string | null;
  onExit: () => void;
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
  onClaimReward: () => void;
  onAcceptQuest: () => void;
  onStartPath: (route: MapRoute, routeLink?: MarkerRouteLink) => void;
  onUseExit: () => void;
  onEnterArea: () => void;
  onOpenDialogueEvent: () => void;
  onStartBattleEvent: () => void;
  onClaimArena: () => void;
}) {
  const backgroundUri = resolveSceneImageUri(marker.scene_background_image_url || marker.shop_background_image_url);
  const npcUri = resolveSceneImageUri(marker.scene_npc_image_url || marker.shop_image_url || marker.quest_image_url);
  const orderedRouteLinks = getOrderedMarkerRouteLinks(routeLinks);
  const storyLinkedRoutes = orderedRouteLinks
    .map((link) => ({ link, route: routes.find((item) => item.id === link.route_id) ?? null }))
    .filter((item): item is { link: MarkerRouteLink; route: MapRoute } => Boolean(item.route));
  const continuationRoute = marker.linked_route_id && marker.starts_route_on_accept
    ? routes.find((item) => item.id === marker.linked_route_id) ?? null
    : null;
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
        <View style={styles.sceneIntro}>
          <View style={styles.panelHeader}>
            <View style={styles.titleBlock}>
              <Text style={styles.markerType}>{marker.type}</Text>
            <Text style={styles.sectionTitle}>{marker.quest_title || marker.title}</Text>
            </View>
            {marker.reward_xp || marker.reward_gold || marker.reward_item_id || marker.reward_full_heal ? (
              <View style={styles.rewardPill}>
                <Text style={styles.rewardPillText}>Reward</Text>
              </View>
            ) : null}
          </View>
          {npcUri ? (
            <View style={marker.type === "Market" ? styles.sceneImageWrap : styles.portraitSceneWrap}>
              <Image source={{ uri: npcUri }} style={marker.type === "Market" ? styles.eventImage : styles.npcPortrait} />
            </View>
          ) : null}
          {marker.description ? <Text style={styles.copy}>{marker.description}</Text> : null}
          {marker.quest_dialogue ? <Text style={styles.dialogueText}>{marker.quest_dialogue}</Text> : null}
        </View>
        {message ? <Text style={styles.adminMessage}>{message}</Text> : null}
        {isExitMarker(marker) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
            {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
            {continuationRoute ? <Text style={styles.copy}>Continues onto {continuationRoute.name}.</Text> : null}
            <Pressable style={styles.primaryButton} onPress={onUseExit}>
              <Text style={styles.primaryText}>{continuationRoute ? "Exit / Continue Trail" : "Exit / Leave"}</Text>
            </Pressable>
          </View>
        ) : marker.type === "Area/Town Entrance" ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>{marker.quest_title || marker.title}</Text>
            {marker.quest_dialogue || marker.description ? <Text style={styles.dialogueText}>{marker.quest_dialogue || marker.description}</Text> : null}
            {continuationRoute ? <Text style={styles.copy}>Entering starts {continuationRoute.name}.</Text> : null}
            <Pressable style={styles.primaryButton} onPress={onEnterArea}>
              <Text style={styles.primaryText}>{continuationRoute ? "Enter / Continue Trail" : "Enter Area"}</Text>
            </Pressable>
          </View>
        ) : marker.type === "Sign Post" ? (
          <SignPostScene
            routeLinks={orderedRouteLinks}
            routes={routes}
            routeProgressRows={routeProgressRows}
            onStartPath={onStartPath}
          />
        ) : marker.type === "NPC" ? (
          <View style={styles.storyEditor}>
            {markerHasDialogue ? (
              <Pressable style={styles.primaryButton} onPress={onOpenDialogueEvent}>
                <Text style={styles.primaryText}>Talk</Text>
              </Pressable>
            ) : (
              <Text style={styles.copy}>No dialogue tree is linked to this NPC yet.</Text>
            )}
            {marker.battle_event_id || marker.enemy_id ? (
              <Pressable style={styles.secondaryButton} onPress={onStartBattleEvent}>
                <Text style={styles.secondaryText}>Challenge / Fight</Text>
              </Pressable>
            ) : null}
          </View>
        ) : markerHasDialogue && isDialogueMarkerType(marker.type) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Dialogue</Text>
            <Pressable style={styles.primaryButton} onPress={onOpenDialogueEvent}>
              <Text style={styles.primaryText}>Start Dialogue</Text>
            </Pressable>
          </View>
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
              {marker.reward_full_heal ? " / Full heal" : ""}
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
        ) : marker.type === "Arena" ? (
          <ArenaScene arena={arena} marker={marker} onClaimArena={onClaimArena} />
        ) : isBattleMarkerType(marker.type) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Battle</Text>
            <Text style={styles.copy}>{marker.battle_event_id || marker.enemy_id || marker.npc_id ? "This marker starts a standalone battle without changing trail progress." : "No Battle Event, Enemy, or NPC is linked to this marker yet."}</Text>
            <Pressable style={[styles.primaryButton, !marker.battle_event_id && !marker.enemy_id && !marker.npc_id && styles.disabledAction]} onPress={onStartBattleEvent} disabled={!marker.battle_event_id && !marker.enemy_id && !marker.npc_id}>
              <Text style={styles.primaryText}>Start Battle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Options</Text>
            <Text style={styles.copy}>
              Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
              {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
              {marker.reward_full_heal ? " / Full heal" : ""}
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

const arenaTabs = ["Arena", "Leaderboard", "Holder"] as const;
type ArenaTab = (typeof arenaTabs)[number];

function ArenaScene({ arena, marker, onClaimArena }: { arena: ArenaWithLeaders | null; marker: MapMarker; onClaimArena: () => void }) {
  const [activeTab, setActiveTab] = useState<ArenaTab>("Arena");
  const currentHolder = arena?.currentHolder ?? null;
  const currentSnapshot = currentHolder?.snapshot ?? null;
  const defenses = arena?.mostDefenses ?? [];
  const longestHeld = arena?.longestHeld ?? [];
  const attacks = getSnapshotAttacks(currentSnapshot);
  const canClaim = Boolean(arena?.arena && !currentHolder && !arena.unavailableReason);

  return (
    <View style={styles.arenaScene}>
      <View style={styles.arenaHero}>
        <View style={styles.arenaHeroText}>
          <Text style={styles.markerType}>Arena</Text>
          <Text style={styles.arenaTitle}>{arena?.arena?.name || marker.title}</Text>
          <Text style={styles.copy}>{arena?.arena?.description || marker.description || "Face the current holder and earn your place on the board."}</Text>
        </View>
        <View style={styles.arenaPrizeBox}>
          <Text style={styles.marketPriceLabel}>Prize</Text>
          <Text style={styles.marketBuyPrice}>{arena?.arena?.reward_gold ?? marker.reward_gold ?? 0} gold</Text>
          <Text style={styles.marketSellPrice}>{arena?.arena?.reward_xp ?? marker.reward_xp ?? 0} XP</Text>
        </View>
      </View>

      {arena?.unavailableReason ? <Text style={styles.adminMessage}>{arena.unavailableReason}</Text> : null}

      <View style={styles.arenaTabs}>
        {arenaTabs.map((tab) => (
          <Pressable key={tab} style={[styles.arenaTabButton, activeTab === tab && styles.arenaTabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.arenaTabText, activeTab === tab && styles.arenaTabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "Arena" ? (
        <>
          <ArenaHolderCard currentHolder={currentHolder} currentSnapshot={currentSnapshot} />
          {canClaim ? (
            <Pressable style={styles.primaryButton} onPress={onClaimArena}>
              <Text style={styles.primaryText}>Claim Open Arena</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, styles.disabledAction]} disabled>
              <Text style={styles.primaryText}>{currentHolder ? "Challenge Coming Soon" : "Arena Not Ready"}</Text>
            </Pressable>
          )}
        </>
      ) : null}

      {activeTab === "Leaderboard" ? (
        <>
          <ArenaLeaderboard title="Most Defenses" entries={defenses} metric="defenses" />
          <ArenaLeaderboard title="Longest Held" entries={longestHeld} metric="held" />
        </>
      ) : null}

      {activeTab === "Holder" ? (
        <>
          <ArenaHolderCard currentHolder={currentHolder} currentSnapshot={currentSnapshot} />
          <View style={styles.arenaSection}>
            <Text style={styles.selectedTitle}>Holder Attacks</Text>
            {attacks.length === 0 ? <Text style={styles.copy}>No equipped attacks are recorded for the current holder.</Text> : null}
            {attacks.map((ability, index) => (
              <View key={`${ability.name}-${index}`} style={styles.attackRow}>
                <Text style={styles.attackName}>{ability.name}</Text>
                <Text style={styles.attackMeta}>
                  {ability.damage ? `${ability.damage} damage` : ability.healing ? `${ability.healing} healing` : ability.type || "ability"}
                  {ability.staminaCost ? ` / ${ability.staminaCost} stamina` : ""}
                  {ability.magikaCost ? ` / ${ability.magikaCost} mana` : ""}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function ArenaHolderCard({ currentHolder, currentSnapshot }: { currentHolder: ArenaLeaderboardEntry | null; currentSnapshot: ArenaLeaderboardEntry["snapshot"] }) {
  return (
    <View style={styles.currentHolderCard}>
      <Text style={styles.selectedTitle}>Current Holder</Text>
      {currentHolder && currentSnapshot ? (
        <View style={styles.holderRow}>
          <View style={styles.holderPortrait}>
            {currentSnapshot.portrait_url ? <Image source={{ uri: currentSnapshot.portrait_url }} style={styles.holderImage} /> : <Text style={styles.marketItemFallback}>{currentSnapshot.character_name.slice(0, 1)}</Text>}
          </View>
          <View style={styles.holderBody}>
            <Text style={styles.marketItemName}>{currentSnapshot.character_name}</Text>
            <Text style={styles.marketItemType}>Level {currentSnapshot.level}{currentSnapshot.active_class_key ? ` / ${currentSnapshot.active_class_key}` : ""}</Text>
            <View style={styles.holderStats}>
              <Text style={styles.statPill}>DEF {currentSnapshot.defense}</Text>
              <Text style={styles.statPill}>ATK +{currentSnapshot.attack_bonus}</Text>
              <Text style={styles.statPill}>HP {currentSnapshot.current_health}/{currentSnapshot.max_health}</Text>
            </View>
            <Text style={styles.copy}>Held {formatHeldTime(currentHolder.heldMs)} / {currentHolder.holder.wins_defended} defenses</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.copy}>No player holds this arena yet.</Text>
      )}
    </View>
  );
}

function ArenaLeaderboard({ title, entries, metric }: { title: string; entries: ArenaLeaderboardEntry[]; metric: "defenses" | "held" }) {
  return (
    <View style={styles.arenaSection}>
      <Text style={styles.selectedTitle}>{title}</Text>
      {entries.length === 0 ? <Text style={styles.copy}>No arena history yet.</Text> : null}
      {entries.slice(0, 10).map((entry, index) => (
        <View key={entry.holder.id} style={styles.leaderboardRow}>
          <Text style={styles.rankText}>{index + 1}</Text>
          <View style={styles.leaderboardBody}>
            <Text style={styles.marketItemName}>{entry.snapshot?.character_name ?? "Unknown Holder"}</Text>
            <Text style={styles.marketItemType}>Level {entry.snapshot?.level ?? "?"} / Defense {entry.snapshot?.defense ?? "?"}</Text>
          </View>
          <Text style={styles.leaderboardMetric}>
            {metric === "defenses" ? `${entry.holder.wins_defended}` : formatHeldTime(entry.heldMs)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getSnapshotAttacks(snapshot: ArenaLeaderboardEntry["snapshot"]) {
  const abilities = Array.isArray(snapshot?.equipped_abilities) ? snapshot.equipped_abilities : [];
  return abilities
    .map((ability) => ({
      name: String(ability.name ?? "Ability"),
      type: String(ability.type ?? ""),
      damage: Number(ability.damage) || 0,
      healing: Number(ability.healing) || 0,
      staminaCost: Number(ability.staminaCost) || 0,
      magikaCost: Number(ability.magikaCost) || 0,
    }))
    .filter((ability) => ability.damage > 0 || ability.healing > 0 || ability.type === "attack");
}

function formatHeldTime(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function isDialogueMarkerType(type: string) {
  return ["Quest", "Side Quest", "Story", "Point of Interest", "NPC"].includes(type);
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
  onStartPath: (route: MapRoute, routeLink?: MarkerRouteLink) => void;
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
        const startDirection = link.start_direction ?? "forward";
        const directionLabel = startDirection === "reverse" ? "Reverse: 100% to 0%" : "Forward: 0% to 100%";

        return (
          <View key={link.id} style={[styles.storyCard, locked && styles.lockedCard]}>
            <Text style={styles.markerName}>{linkedRoute.name}</Text>
            <Text style={styles.copy}>Destination: {link.destination_label || linkedRoute.terrain}</Text>
            <Text style={styles.copy}>{directionLabel}</Text>
            <Text style={styles.copy}>{metersToMiles(linkedRoute.distance_required_meters)} mi / Progress {Math.round(progress)}%</Text>
            <Text style={locked ? styles.lockText : styles.unlockText}>{locked ? getRouteLockMessage(linkedRoute) : "Available"}</Text>
            <Pressable style={[styles.primaryButton, locked && styles.disabledAction]} onPress={() => onStartPath(linkedRoute, link)} disabled={locked}>
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
  const [activeMode, setActiveMode] = useState<MarketMode>("Buy");
  const buyableItems = marketItems
    .map((marketItem) => ({ marketItem, item: getItemDefinition(itemDefinitions, marketItem.item_id) }))
    .filter(({ marketItem }) => canMarketItemBeBought(marketItem) && getRemainingMarketStock(marketItem, marketPurchaseCounts) > 0);
  const sellableItems = inventoryItems.filter((entry) => entry.item.sellable && marketItems.some((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item)));

  return (
    <View style={styles.marketScene}>
      <View style={styles.marketHeaderRow}>
        <View>
          <Text style={styles.marketTitle}>Market</Text>
          <Text style={styles.marketSubtitle}>Goods currently available</Text>
        </View>
        <View style={styles.marketGoldPill}>
          <Text style={styles.marketPriceLabel}>Your Gold</Text>
          <Text style={styles.marketBuyPrice}>{characterGold.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.marketCategoryTabs}>
        {marketModes.map((mode) => (
          <Pressable key={mode} style={[styles.marketCategoryButton, activeMode === mode && styles.marketCategoryActive]} onPress={() => setActiveMode(mode)}>
            <Text style={[styles.marketCategoryText, activeMode === mode && styles.marketCategoryTextActive]}>{mode}</Text>
          </Pressable>
        ))}
      </View>

      {activeMode === "Buy" ? (
        <View style={styles.marketList}>
          {buyableItems.length === 0 ? <Text style={styles.copy}>This market has no items for sale.</Text> : null}
          {buyableItems.map(({ marketItem, item }) => (
            <MarketBuyCard
              key={marketItem.id}
              marketItem={marketItem}
              purchasedCount={marketPurchaseCounts[marketItem.id] ?? 0}
              item={item}
              onBuy={() => onBuy(marketItem)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.marketList}>
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
      )}
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
        {item?.description ? <Text style={styles.marketItemDescription} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.marketStockText}>{marketItem.unlimited_stock ? "Unlimited stock" : `${remainingStock} available for you`}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <View style={styles.marketPriceBox}>
          <Text style={styles.marketPriceLabel}>Buy</Text>
          <Text style={styles.marketBuyPrice}>{marketItem.buy_price}</Text>
        </View>
        <Pressable style={[styles.marketActionButton, outOfStock && styles.disabledAction]} onPress={onBuy} disabled={outOfStock}>
          <Text style={styles.marketActionText}>{outOfStock ? "Sold Out" : "Buy"}</Text>
        </Pressable>
      </View>
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
        <Text style={styles.marketItemDescription} numberOfLines={2}>{entry.item.description || "Marketable inventory item"}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <View style={styles.marketPriceBox}>
          <Text style={styles.marketPriceLabel}>Sell</Text>
          <Text style={styles.marketSellPrice}>{sellPrice}</Text>
        </View>
        <Pressable style={styles.marketSellButton} onPress={onSell}>
          <Text style={styles.secondaryText}>Sell One</Text>
        </Pressable>
      </View>
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
    padding: 16,
    gap: 12,
    borderRadius: 14,
    backgroundColor: "rgba(8, 7, 5, 0.92)",
  },
  sceneIntro: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.32)",
    backgroundColor: "rgba(0, 5, 6, 0.62)",
    padding: 14,
    gap: 14,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  markerType: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
    textTransform: "uppercase",
  },
  rewardPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.42)",
    backgroundColor: "rgba(217, 170, 93, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rewardPillText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.38)",
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
  },
  sceneImageWrap: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  portraitSceneWrap: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
    shadowColor: colors.gold,
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  npcPortrait: {
    width: "100%",
    height: "100%",
  },
  adminMessage: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  storyEditor: {
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.24)",
    backgroundColor: "rgba(0,0,0,0.44)",
    padding: 14,
  },
  selectedTitle: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  dialogueText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  primaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.54)",
    backgroundColor: "rgba(2, 5, 5, 0.72)",
    paddingHorizontal: 14,
  },
  primaryText: {
    color: colors.gold,
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
  marketScene: {
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.24)",
    backgroundColor: "rgba(0,0,0,0.48)",
    padding: 12,
  },
  marketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  marketTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  marketSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  marketGoldPill: {
    minWidth: 116,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(218,164,65,0.1)",
    alignItems: "flex-end",
  },
  marketCategoryTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.18)",
    backgroundColor: "rgba(0,0,0,0.32)",
    padding: 5,
  },
  marketCategoryButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.18)",
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  marketCategoryActive: {
    borderColor: colors.border,
    backgroundColor: "rgba(217, 170, 93, 0.24)",
  },
  marketCategoryText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  marketCategoryTextActive: {
    color: colors.gold,
  },
  marketList: {
    gap: 10,
  },
  marketDivider: {
    height: 1,
    backgroundColor: "rgba(217, 170, 93, 0.18)",
  },
  marketSectionLabel: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  marketCard: {
    width: "100%",
    minHeight: 118,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    gap: 12,
    backgroundColor: "rgba(4, 7, 6, 0.82)",
    flexDirection: "row",
    alignItems: "stretch",
  },
  marketImageBox: {
    width: 96,
    minHeight: 96,
    borderRadius: 10,
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
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: "center",
  },
  marketItemName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  marketItemType: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "capitalize",
  },
  marketItemDescription: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  marketPriceLabel: {
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 11,
  },
  marketBuyColumn: {
    width: 94,
    gap: 9,
    justifyContent: "center",
  },
  marketPriceBox: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.22)",
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  marketBuyPrice: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 18,
  },
  marketSellPrice: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 18,
  },
  marketStockText: {
    color: colors.green,
    fontSize: 12,
    lineHeight: 17,
  },
  marketActionButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  marketActionText: {
    color: "#120e08",
    fontWeight: "900",
  },
  marketSellButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,61,86,0.28)",
  },
  arenaScene: {
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.26)",
    backgroundColor: "rgba(0,0,0,0.52)",
    padding: 12,
  },
  arenaHero: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  arenaHeroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  arenaTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
  },
  arenaPrizeBox: {
    width: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(217, 170, 93, 0.1)",
    padding: 10,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  arenaTabs: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.18)",
    backgroundColor: "rgba(0,0,0,0.34)",
    padding: 5,
  },
  arenaTabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.16)",
  },
  arenaTabActive: {
    borderColor: colors.border,
    backgroundColor: "rgba(217, 170, 93, 0.2)",
  },
  arenaTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  arenaTabTextActive: {
    color: colors.gold,
  },
  currentHolderCard: {
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(40, 175, 234, 0.35)",
    backgroundColor: "rgba(0, 23, 31, 0.42)",
    padding: 12,
  },
  holderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  holderPortrait: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  holderImage: {
    width: "100%",
    height: "100%",
  },
  holderBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  holderStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statPill: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.24)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  arenaSection: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(4, 7, 6, 0.7)",
    padding: 12,
  },
  attackRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.18)",
    backgroundColor: "rgba(0,0,0,0.28)",
    padding: 10,
  },
  attackName: {
    color: colors.text,
    fontWeight: "900",
  },
  attackMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  leaderboardRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.16)",
    backgroundColor: "rgba(0,0,0,0.26)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rankText: {
    width: 26,
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  leaderboardBody: {
    flex: 1,
    minWidth: 0,
  },
  leaderboardMetric: {
    color: colors.blue,
    fontWeight: "900",
  },
});
