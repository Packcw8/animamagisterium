import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Anvil, Banknote, Beaker, Boxes, ChefHat, Coins, Gem, Hammer, Landmark, Minus, Package, Pickaxe, Plus, ScrollText, Shirt, Sparkles, Store, Swords, type LucideIcon } from "lucide-react-native";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { CachedGameImage } from "../ui/CachedGameImage";
import { canUseItemInContext, type InventoryItem, type ItemDefinition, resolveInventoryImageUri, resolveInventoryThumbnailUri } from "../../services/inventoryService";
import { normalizeMountMultiplier, resolveMountImageUri, resolveMountThumbnailUri, type MountDefinition } from "../../services/mountService";
import { craftingCategories, craftingStationTypes, getCraftingItemName, getCraftingStatus, getMaxCraftableCount, type CraftingRecipeWithIngredients } from "../../services/craftingService";
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
import { resolveGameAssetUri } from "../../utils/assetResolver";
import { getRouteLockLabel, getRouteLockMessage, isRouteUnavailable } from "../../utils/mapProgress";
import type { ArenaLeaderboardEntry, ArenaWithLeaders } from "../../services/arenaService";
import type { BankItem } from "../../services/bankService";
import type { HydratedPlayerMarketListing, PlayerMarketSpot } from "../../services/playerMarketService";

const marketModes = ["Buy", "Sell"] as const;
type MarketMode = (typeof marketModes)[number];
const bankModes = ["Deposit", "Withdraw"] as const;
type BankMode = (typeof bankModes)[number];
const playerMarketModes = ["Shop", "My Stall"] as const;
type PlayerMarketMode = (typeof playerMarketModes)[number];
type SelectedMarketItem =
  | { mode: "Buy"; marketItem: MarkerMarketItem; item: ItemDefinition | null; mount: MountDefinition | null; purchasedCount: number }
  | { mode: "Sell"; entry: InventoryItem; marketItem: MarkerMarketItem | undefined };

export function MarkerSceneScreen({
  marker,
  characterId,
  characterGold,
  bankGoldBalance,
  bankItems,
  playerMarketSpots,
  playerMarketListings,
  myPlayerMarketSpot,
  marketItems,
  craftingRecipes,
  marketPurchaseCounts,
  routeLinks,
  routes,
  routeProgressRows,
  inventoryItems,
  itemDefinitions,
  mountDefinitions,
  markerHasDialogue,
  arena,
  message,
  onExit,
  onBuy,
  onSell,
  onDepositGold,
  onWithdrawGold,
  onDepositBankItem,
  onWithdrawBankItem,
  onClaimPlayerMarketSpot,
  onListPlayerMarketItem,
  onCancelPlayerMarketListing,
  onBuyPlayerMarketListing,
  onCraft,
  onClaimReward,
  onAcceptQuest,
  onStartPath,
  onUseExit,
  onEnterArea,
  onOpenDialogueEvent,
  onStartBattleEvent,
  onClaimArena,
  onChallengeArena,
}: {
  marker: MapMarker;
  characterId: string;
  characterGold: number;
  bankGoldBalance: number;
  bankItems: BankItem[];
  playerMarketSpots: PlayerMarketSpot[];
  playerMarketListings: HydratedPlayerMarketListing[];
  myPlayerMarketSpot: PlayerMarketSpot | null;
  marketItems: MarkerMarketItem[];
  craftingRecipes: CraftingRecipeWithIngredients[];
  marketPurchaseCounts: Record<string, number>;
  routeLinks: MarkerRouteLink[];
  routes: MapRoute[];
  routeProgressRows: Array<{ route_id: string; progress_percent: number; is_current?: boolean }>;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  mountDefinitions: MountDefinition[];
  markerHasDialogue: boolean;
  arena: ArenaWithLeaders | null;
  message: string | null;
  onExit: () => void;
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
  onDepositGold: (amount: number) => void;
  onWithdrawGold: (amount: number) => void;
  onDepositBankItem: (item: InventoryItem, quantity: number) => void;
  onWithdrawBankItem: (item: BankItem, quantity: number) => void;
  onClaimPlayerMarketSpot: (stallName: string) => void;
  onListPlayerMarketItem: (item: InventoryItem, quantity: number, pricePerItem: number) => void;
  onCancelPlayerMarketListing: (listing: HydratedPlayerMarketListing) => void;
  onBuyPlayerMarketListing: (listing: HydratedPlayerMarketListing, quantity: number) => void;
  onCraft: (recipe: CraftingRecipeWithIngredients, quantity?: number) => void | Promise<void>;
  onClaimReward: () => void;
  onAcceptQuest: () => void;
  onStartPath: (route: MapRoute, routeLink?: MarkerRouteLink) => void;
  onUseExit: () => void;
  onEnterArea: () => void;
  onOpenDialogueEvent: () => void;
  onStartBattleEvent: () => void;
  onClaimArena: () => void;
  onChallengeArena: () => void;
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
  const nextStoryRouteLocked = nextStoryRoute ? isRouteUnavailable(nextStoryRoute, inventoryItems, itemDefinitions) : false;
  const storyRoutesComplete = storyLinkedRoutes.length > 0 && !firstIncompleteStoryRoute;

  return (
    <Screen>
      <Frame style={backgroundUri ? [styles.eventScreen, ({ backgroundImage: `url(${backgroundUri})`, backgroundSize: "cover", backgroundPosition: "center" } as never)] : styles.eventScreen}>
        {backgroundUri ? <CachedGameImage uri={backgroundUri} style={styles.sceneBackgroundImage} /> : null}
        <View style={styles.sceneIntro}>
          <View style={styles.panelHeader}>
            <View style={styles.titleBlock}>
              <Text style={styles.markerType}>{getMarkerTypeLabel(marker.type)}</Text>
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
              <CachedGameImage uri={npcUri} style={marker.type === "Market" ? styles.eventImage : styles.npcPortrait} />
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
            inventoryItems={inventoryItems}
            itemDefinitions={itemDefinitions}
            onStartPath={onStartPath}
          />
        ) : marker.type === "NPC" ? (
          <View style={styles.storyEditor}>
            {markerHasDialogue ? (
              <Pressable style={styles.primaryButton} onPress={onOpenDialogueEvent}>
                <Text style={styles.primaryText}>Talk</Text>
              </Pressable>
            ) : (
              <Text style={styles.copy}>They have nothing more to say right now.</Text>
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
                    {complete ? "Completed" : locked ? "Locked until earlier story paths are completed" : nextStoryRouteLocked ? getRouteLockMessage(route, inventoryItems, itemDefinitions) : "Next path"}
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
            mountDefinitions={mountDefinitions}
            onBuy={onBuy}
            onSell={onSell}
          />
        ) : marker.type === "Player Market" ? (
          <PlayerMarketScene
            marker={marker}
            characterId={characterId}
            characterGold={characterGold}
            spots={playerMarketSpots}
            listings={playerMarketListings}
            mySpot={myPlayerMarketSpot}
            inventoryItems={inventoryItems}
            onClaimSpot={onClaimPlayerMarketSpot}
            onListItem={onListPlayerMarketItem}
            onCancelListing={onCancelPlayerMarketListing}
            onBuyListing={onBuyPlayerMarketListing}
          />
        ) : marker.type === "Bank" ? (
          <BankScene
            characterGold={characterGold}
            bankGoldBalance={bankGoldBalance}
            bankItems={bankItems}
            inventoryItems={inventoryItems}
            onDepositGold={onDepositGold}
            onWithdrawGold={onWithdrawGold}
            onDepositBankItem={onDepositBankItem}
            onWithdrawBankItem={onWithdrawBankItem}
          />
        ) : marker.type === "Crafting" ? (
          <CraftingScene
            recipes={craftingRecipes}
            inventoryItems={inventoryItems}
            itemDefinitions={itemDefinitions}
            onCraft={onCraft}
          />
        ) : marker.type === "Arena" ? (
          <ArenaScene arena={arena} marker={marker} onClaimArena={onClaimArena} onChallengeArena={onChallengeArena} />
        ) : isBattleMarkerType(marker.type) ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Battle</Text>
            <Text style={styles.copy}>{marker.battle_event_id || marker.enemy_id || marker.npc_id ? "This marker starts a standalone battle without changing trail progress." : "Start this battle marker. If no battle board enemy is placed yet, the marker will tell you what is missing."}</Text>
            <Pressable style={styles.primaryButton} onPress={onStartBattleEvent}>
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

function ArenaScene({ arena, marker, onClaimArena, onChallengeArena }: { arena: ArenaWithLeaders | null; marker: MapMarker; onClaimArena: () => void; onChallengeArena: () => void }) {
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
          ) : currentHolder ? (
            <Pressable style={styles.primaryButton} onPress={onChallengeArena}>
              <Text style={styles.primaryText}>Challenge Holder</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, styles.disabledAction]} disabled>
              <Text style={styles.primaryText}>Arena Not Ready</Text>
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
            {currentSnapshot.portrait_url ? <CachedGameImage uri={currentSnapshot.portrait_url} style={styles.holderImage} /> : <Text style={styles.marketItemFallback}>{currentSnapshot.character_name.slice(0, 1)}</Text>}
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

function getMarkerTypeLabel(type: string) {
  return type === "Sign Post" ? "Travel Hub" : type;
}

function SignPostScene({
  routeLinks,
  routes,
  routeProgressRows,
  inventoryItems,
  itemDefinitions,
  onStartPath,
}: {
  routeLinks: MarkerRouteLink[];
  routes: MapRoute[];
  routeProgressRows: Array<{ route_id: string; progress_percent: number; is_current?: boolean }>;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  onStartPath: (route: MapRoute, routeLink?: MarkerRouteLink) => void;
}) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Choose Your Path</Text>
      {routeLinks.length === 0 ? <Text style={styles.copy}>No walking paths are linked to this Travel Hub yet.</Text> : null}
      {routeLinks.map((link) => {
        const linkedRoute = routes.find((item) => item.id === link.route_id);
        const progress = routeProgressRows.find((row) => row.route_id === link.route_id)?.progress_percent ?? 0;

        if (!linkedRoute) {
          return null;
        }
        const locked = isRouteUnavailable(linkedRoute, inventoryItems, itemDefinitions);
        const startDirection = link.start_direction ?? "forward";
        const directionLabel = startDirection === "reverse" ? "Reverse: 100% to 0%" : "Forward: 0% to 100%";

        return (
          <View key={link.id} style={[styles.storyCard, locked && styles.lockedCard]}>
            <Text style={styles.markerName}>{linkedRoute.name}</Text>
            <Text style={styles.copy}>Destination: {link.destination_label || linkedRoute.terrain}</Text>
            <Text style={styles.copy}>{directionLabel}</Text>
            <Text style={styles.copy}>{metersToMiles(linkedRoute.distance_required_meters)} mi / Progress {Math.round(progress)}%</Text>
            <Text style={locked ? styles.lockText : styles.unlockText}>{locked ? getRouteLockMessage(linkedRoute, inventoryItems, itemDefinitions) : "Available"}</Text>
            <Pressable style={[styles.primaryButton, locked && styles.disabledAction]} onPress={() => onStartPath(linkedRoute, link)} disabled={locked}>
              <Text style={styles.primaryText}>{locked ? getRouteLockLabel(linkedRoute) : "Start Path"}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function PlayerMarketScene({
  marker,
  characterId,
  characterGold,
  spots,
  listings,
  mySpot,
  inventoryItems,
  onClaimSpot,
  onListItem,
  onCancelListing,
  onBuyListing,
}: {
  marker: MapMarker;
  characterId: string;
  characterGold: number;
  spots: PlayerMarketSpot[];
  listings: HydratedPlayerMarketListing[];
  mySpot: PlayerMarketSpot | null;
  inventoryItems: InventoryItem[];
  onClaimSpot: (stallName: string) => void;
  onListItem: (item: InventoryItem, quantity: number, pricePerItem: number) => void;
  onCancelListing: (listing: HydratedPlayerMarketListing) => void;
  onBuyListing: (listing: HydratedPlayerMarketListing, quantity: number) => void;
}) {
  const [activeMode, setActiveMode] = useState<PlayerMarketMode>("Shop");
  const [stallName, setStallName] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [listQuantity, setListQuantity] = useState("1");
  const [listPrice, setListPrice] = useState("1");
  const ownedListings = useMemo(() => listings.filter((listing) => listing.seller_character_id === characterId), [characterId, listings]);
  const shopListings = useMemo(() => listings.filter((listing) => listing.spot && listing.seller_character_id !== characterId), [characterId, listings]);
  const depositableItems = useMemo(() => inventoryItems.filter((entry) => !entry.equippedSlot && entry.quantity > 0 && entry.item.sellable), [inventoryItems]);
  const selectedInventoryItem = depositableItems.find((entry) => entry.id === selectedInventoryId) ?? depositableItems[0] ?? null;
  const slotCount = Math.max(1, Number(marker.player_market_slot_count ?? 3) || 3);
  const availableSlots = Math.max(0, slotCount - spots.length);
  const rentGold = Math.max(0, Number(marker.player_market_rent_gold ?? 0) || 0);
  const durationDays = Math.max(1, Number(marker.player_market_duration_days ?? 7) || 7);
  const safeListQuantity = Math.min(Math.max(1, Math.floor(Number(listQuantity) || 1)), Math.max(1, selectedInventoryItem?.quantity ?? 1));
  const safePrice = Math.max(0, Math.floor(Number(listPrice) || 0));

  useEffect(() => {
    if (!selectedInventoryId && selectedInventoryItem) {
      setSelectedInventoryId(selectedInventoryItem.id);
    }
  }, [selectedInventoryId, selectedInventoryItem]);

  return (
    <View style={styles.marketScene}>
      <View style={styles.marketHeaderRow}>
        <View style={styles.bankTitleRow}>
          <View style={styles.bankIconBadge}>
            <Store size={24} color={colors.gold} strokeWidth={2.2} />
          </View>
          <View style={styles.marketHeaderCopy}>
            <Text style={styles.marketTitle}>Player Market</Text>
            <Text style={styles.marketSubtitle}>{availableSlots} of {slotCount} spots open / {durationDays} day rental</Text>
          </View>
        </View>
        <View style={styles.marketGoldPill}>
          <Text style={styles.marketPriceLabel}>Gold</Text>
          <Text style={styles.marketBuyPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{characterGold.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.marketCategoryTabs}>
        {playerMarketModes.map((mode) => (
          <Pressable key={mode} style={[styles.marketCategoryButton, activeMode === mode && styles.marketCategoryActive]} onPress={() => setActiveMode(mode)}>
            <Text style={[styles.marketCategoryText, activeMode === mode && styles.marketCategoryTextActive]}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      {activeMode === "Shop" ? (
        <ScrollView style={styles.marketListScroller} contentContainerStyle={styles.marketListContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={styles.marketList}>
            {shopListings.length === 0 ? <Text style={styles.copy}>No player listings are available yet.</Text> : null}
            {shopListings.map((listing) => (
              <PlayerMarketListingCard
                key={listing.id}
                listing={listing}
                owned={false}
                onBuy={() => onBuyListing(listing, 1)}
                onCancel={() => undefined}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.marketListScroller} contentContainerStyle={styles.marketListContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={styles.marketList}>
            {mySpot ? (
              <View style={styles.marketDetailPanel}>
                <Text style={styles.selectedTitle}>{mySpot.stall_name}</Text>
                <Text style={styles.copy}>Slot {mySpot.slot_number} / expires {formatDate(mySpot.rented_until)}</Text>
              </View>
            ) : (
              <View style={styles.marketDetailPanel}>
                <Text style={styles.selectedTitle}>Rent a Market Spot</Text>
                <Text style={styles.copy}>{availableSlots > 0 ? `Rent costs ${rentGold} gold and lasts ${durationDays} days.` : "All spots are currently rented."}</Text>
                <TextInput value={stallName} onChangeText={setStallName} placeholder="Stall name" placeholderTextColor={colors.muted} style={styles.bankGoldInput} />
                <Pressable style={[styles.marketActionButton, availableSlots <= 0 && styles.disabledAction]} onPress={() => onClaimSpot(stallName)} disabled={availableSlots <= 0}>
                  <Text style={styles.marketActionText}>{availableSlots > 0 ? "Rent Spot" : "No Spots Open"}</Text>
                </Pressable>
              </View>
            )}
            {mySpot ? (
              <View style={styles.marketDetailPanel}>
                <Text style={styles.selectedTitle}>Create Listing</Text>
                {depositableItems.length === 0 ? <Text style={styles.copy}>No unequipped sellable items are available to list.</Text> : null}
                {depositableItems.length > 0 ? (
                  <>
                    <View style={styles.marketCategoryTabs}>
                      {depositableItems.slice(0, 8).map((entry) => (
                        <Pressable key={entry.id} style={[styles.marketCategoryButton, selectedInventoryItem?.id === entry.id && styles.marketCategoryActive]} onPress={() => setSelectedInventoryId(entry.id)}>
                          <Text style={[styles.marketCategoryText, selectedInventoryItem?.id === entry.id && styles.marketCategoryTextActive]} numberOfLines={1}>{entry.item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={styles.bankGoldRow}>
                      <TextInput value={listQuantity} onChangeText={setListQuantity} keyboardType="numeric" placeholder="Qty" placeholderTextColor={colors.muted} style={styles.bankGoldInput} />
                      <TextInput value={listPrice} onChangeText={setListPrice} keyboardType="numeric" placeholder="Price each" placeholderTextColor={colors.muted} style={styles.bankGoldInput} />
                    </View>
                    <Pressable style={styles.marketActionButton} onPress={() => selectedInventoryItem ? onListItem(selectedInventoryItem, safeListQuantity, safePrice) : undefined}>
                      <Text style={styles.marketActionText}>List Item</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.selectedTitle}>Your Listings</Text>
            {ownedListings.length === 0 ? <Text style={styles.copy}>You do not have any active listings at this marker.</Text> : null}
            {ownedListings.map((listing) => (
              <PlayerMarketListingCard
                key={listing.id}
                listing={listing}
                owned
                onBuy={() => undefined}
                onCancel={() => onCancelListing(listing)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PlayerMarketListingCard({ listing, owned, onBuy, onCancel }: { listing: HydratedPlayerMarketListing; owned: boolean; onBuy: () => void; onCancel: () => void }) {
  const imageUri = resolveInventoryThumbnailUri(listing.item);
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketImageBox}>
        {imageUri ? <CachedGameImage uri={imageUri} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{listing.item.name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{listing.item.name}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{listing.spot?.stall_name ?? (owned ? "Expired Stall" : "Player Stall")}</Text>
        <Text style={styles.marketItemDescription} numberOfLines={2}>{listing.item.description || `${listing.item.type} / ${listing.item.rarity}`}</Text>
        <Text style={styles.marketStockText}>Stock x{listing.quantity_available}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <View style={styles.marketPriceBox}>
          <Text style={styles.marketPriceLabel}>Each</Text>
          <Text style={styles.marketBuyPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{listing.price_per_item}</Text>
        </View>
        <Pressable style={owned ? styles.marketCloseButton : styles.marketActionButton} onPress={owned ? onCancel : onBuy}>
          <Text style={owned ? styles.secondaryText : styles.marketActionText}>{owned ? "Cancel" : "Buy 1"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BankScene({
  characterGold,
  bankGoldBalance,
  bankItems,
  inventoryItems,
  onDepositGold,
  onWithdrawGold,
  onDepositBankItem,
  onWithdrawBankItem,
}: {
  characterGold: number;
  bankGoldBalance: number;
  bankItems: BankItem[];
  inventoryItems: InventoryItem[];
  onDepositGold: (amount: number) => void;
  onWithdrawGold: (amount: number) => void;
  onDepositBankItem: (item: InventoryItem, quantity: number) => void;
  onWithdrawBankItem: (item: BankItem, quantity: number) => void;
}) {
  const [activeMode, setActiveMode] = useState<BankMode>("Deposit");
  const [goldAmount, setGoldAmount] = useState("");
  const safeGoldAmount = Math.max(1, Math.floor(Number(goldAmount) || 1));
  const depositableItems = useMemo(() => inventoryItems.filter((entry) => !entry.equippedSlot && entry.quantity > 0), [inventoryItems]);

  return (
    <View style={styles.marketScene}>
      <View style={styles.marketHeaderRow}>
        <View style={styles.bankTitleRow}>
          <View style={styles.bankIconBadge}>
            <Landmark size={24} color={colors.gold} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.marketTitle}>Bank</Text>
            <Text style={styles.marketSubtitle}>Character storage</Text>
          </View>
        </View>
      </View>
      <View style={styles.bankSummaryGrid}>
        <View style={styles.bankSummaryCard}>
          <Coins size={18} color={colors.gold} strokeWidth={2.2} />
          <Text style={styles.marketPriceLabel}>Carried Gold</Text>
          <Text style={styles.marketBuyPrice}>{characterGold.toLocaleString()}</Text>
        </View>
        <View style={styles.bankSummaryCard}>
          <Banknote size={18} color={colors.blue} strokeWidth={2.2} />
          <Text style={styles.marketPriceLabel}>Banked Gold</Text>
          <Text style={styles.marketBuyPrice}>{bankGoldBalance.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.marketCategoryTabs}>
        {bankModes.map((mode) => (
          <Pressable key={mode} style={[styles.marketCategoryButton, activeMode === mode && styles.marketCategoryActive]} onPress={() => setActiveMode(mode)}>
            <Text style={[styles.marketCategoryText, activeMode === mode && styles.marketCategoryTextActive]}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.bankGoldPanel}>
        <Text style={styles.selectedTitle}>{activeMode} Gold</Text>
        <View style={styles.bankGoldRow}>
          <TextInput
            value={goldAmount}
            onChangeText={setGoldAmount}
            keyboardType="numeric"
            placeholder="Amount"
            placeholderTextColor={colors.muted}
            style={styles.bankGoldInput}
          />
          <Pressable
            style={styles.marketActionButton}
            onPress={() => activeMode === "Deposit" ? onDepositGold(Math.min(safeGoldAmount, characterGold)) : onWithdrawGold(Math.min(safeGoldAmount, bankGoldBalance))}
          >
            <Text style={styles.marketActionText}>{activeMode}</Text>
          </Pressable>
        </View>
        <View style={styles.bankQuickRow}>
          {[10, 50, 100].map((amount) => (
            <Pressable key={amount} style={styles.marketCloseButton} onPress={() => setGoldAmount(String(amount))}>
              <Text style={styles.secondaryText}>{amount}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.marketCloseButton} onPress={() => setGoldAmount(String(activeMode === "Deposit" ? characterGold : bankGoldBalance))}>
            <Text style={styles.secondaryText}>All</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.marketListScroller} contentContainerStyle={styles.marketListContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {activeMode === "Deposit" ? (
          <View style={styles.marketList}>
            {depositableItems.length === 0 ? <Text style={styles.copy}>No unequipped items are available to deposit.</Text> : null}
            {depositableItems.map((entry) => (
              <BankInventoryRow
                key={entry.id}
                name={entry.item.name}
                meta={`${entry.item.type} / owned x${entry.quantity}`}
                imageUri={resolveInventoryThumbnailUri(entry.item)}
                quantity={entry.quantity}
                actionLabel="Deposit"
                onMoveOne={() => onDepositBankItem(entry, 1)}
                onMoveAll={() => onDepositBankItem(entry, entry.quantity)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.marketList}>
            {bankItems.length === 0 ? <Text style={styles.copy}>No items are stored in this bank yet.</Text> : null}
            {bankItems.map((entry) => (
              <BankInventoryRow
                key={entry.id}
                name={entry.item.name}
                meta={`${entry.item.type} / stored x${entry.quantity}`}
                imageUri={resolveInventoryThumbnailUri(entry.item)}
                quantity={entry.quantity}
                actionLabel="Withdraw"
                onMoveOne={() => onWithdrawBankItem(entry, 1)}
                onMoveAll={() => onWithdrawBankItem(entry, entry.quantity)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BankInventoryRow({ name, meta, imageUri, quantity, actionLabel, onMoveOne, onMoveAll }: { name: string; meta: string; imageUri: string | null; quantity: number; actionLabel: string; onMoveOne: () => void; onMoveAll: () => void }) {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketImageBox}>
        {imageUri ? <CachedGameImage uri={imageUri} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{name}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <Pressable style={styles.marketActionButton} onPress={onMoveOne}>
          <Text style={styles.marketActionText}>{actionLabel} 1</Text>
        </Pressable>
        {quantity > 1 ? (
          <Pressable style={styles.marketCloseButton} onPress={onMoveAll}>
            <Text style={styles.secondaryText}>All</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CraftingScene({
  recipes,
  inventoryItems,
  itemDefinitions,
  onCraft,
}: {
  recipes: CraftingRecipeWithIngredients[];
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  onCraft: (recipe: CraftingRecipeWithIngredients, quantity?: number) => void | Promise<void>;
}) {
  const [stationFilter, setStationFilter] = useState<(typeof craftingStationTypes)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<"can_craft" | "all" | "missing" | "locked">("can_craft");
  const [categoryFilter, setCategoryFilter] = useState<(typeof craftingCategories)[number] | "all">("all");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(recipes[0]?.id ?? null);
  const [craftQuantity, setCraftQuantity] = useState(1);
  const [craftingNow, setCraftingNow] = useState(false);
  const filteredRecipes = useMemo(
    () => recipes
      .filter((recipe) => stationFilter === "all" || !recipe.station_type || recipe.station_type === stationFilter)
      .filter((recipe) => categoryFilter === "all" || (recipe.category ?? "misc") === categoryFilter)
      .filter((recipe) => {
        const status = getCraftingStatus(recipe, inventoryItems);
        if (statusFilter === "can_craft") {
          return status.canCraft;
        }
        if (statusFilter === "missing") {
          return status.hasBlueprint && !status.canCraft;
        }
        if (statusFilter === "locked") {
          return !status.hasBlueprint;
        }
        return true;
      })
      .sort((left, right) => {
        const leftStatus = getCraftingStatus(left, inventoryItems);
        const rightStatus = getCraftingStatus(right, inventoryItems);
        return Number(rightStatus.canCraft) - Number(leftStatus.canCraft)
          || Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
          || left.name.localeCompare(right.name);
      }),
    [categoryFilter, inventoryItems, recipes, stationFilter, statusFilter],
  );
  const selectedRecipe = filteredRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? filteredRecipes[0] ?? null;
  const selectedStatus = selectedRecipe ? getCraftingStatus(selectedRecipe, inventoryItems) : null;
  const maxCraftableCount = selectedRecipe ? getMaxCraftableCount(selectedRecipe, inventoryItems) : 0;
  const safeCraftQuantity = selectedStatus?.canCraft ? Math.min(craftQuantity, Math.max(1, maxCraftableCount)) : 1;
  const selectedOutputItem = selectedRecipe ? itemDefinitions.find((item) => item.id === selectedRecipe.output_item_id) ?? null : null;
  const selectedOutputImageUri = resolveInventoryThumbnailUri(selectedOutputItem);
  const getOwnedQuantity = (itemId: string) => inventoryItems.find((entry) => entry.item_id === itemId)?.quantity ?? 0;
  const getItemDefinition = (itemId: string) => itemDefinitions.find((item) => item.id === itemId) ?? null;

  useEffect(() => {
    if (!selectedRecipe || selectedRecipe.id !== selectedRecipeId) {
      setSelectedRecipeId(selectedRecipe?.id ?? null);
    }
  }, [selectedRecipe, selectedRecipeId]);

  useEffect(() => {
    setCraftQuantity(1);
  }, [selectedRecipeId]);

  useEffect(() => {
    if (maxCraftableCount > 0 && craftQuantity > maxCraftableCount) {
      setCraftQuantity(maxCraftableCount);
    }
  }, [craftQuantity, maxCraftableCount]);

  async function craftSelectedRecipe(recipe: CraftingRecipeWithIngredients) {
    if (!selectedStatus?.canCraft || craftingNow) {
      return;
    }

    setCraftingNow(true);
    try {
      await onCraft(recipe, safeCraftQuantity);
      setCraftQuantity(1);
    } finally {
      setCraftingNow(false);
    }
  }

  return (
    <View style={styles.craftingShell}>
      <Text style={styles.selectedTitle}>Crafting</Text>
      <Text style={styles.copy}>Create items from materials you have collected.</Text>

      <View style={styles.craftingFilterBlock}>
        <CraftingChipRow
          label="Station"
          options={craftingStationTypes}
          value={stationFilter}
          labels={{ all: "All", forge: "Forge", cooking: "Cooking", alchemy: "Alchemy", workbench: "Workbench", enchanting: "Enchanting" }}
          icons={craftingStationLucideIcons}
          onSelect={setStationFilter}
        />
        <CraftingChipRow
          label="Status"
          options={["can_craft", "all", "missing", "locked"] as const}
          value={statusFilter}
          labels={{ can_craft: "Ready", all: "All", missing: "Missing", locked: "Locked" }}
          onSelect={setStatusFilter}
        />
        <CraftingChipRow
          label="Category"
          options={["all", ...craftingCategories] as const}
          value={categoryFilter}
          labels={{ all: "All", materials: "Materials", weapons: "Weapons", armor: "Armor", consumables: "Consumables", tools: "Tools", quest: "Quest", misc: "Misc" }}
          icons={craftingCategoryLucideIcons}
          onSelect={setCategoryFilter}
        />
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyCraftingCard}>
          <Text style={styles.markerName}>No recipes available</Text>
          <Text style={styles.copy}>No recipes are available here yet.</Text>
        </View>
      ) : null}

      {recipes.length > 0 && filteredRecipes.length === 0 ? (
        <View style={styles.emptyCraftingCard}>
          <Text style={styles.markerName}>No matching recipes</Text>
          <Text style={styles.copy}>Try All, Missing, or another station/category filter.</Text>
        </View>
      ) : null}

      {filteredRecipes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.craftingRecipeStrip}>
          {filteredRecipes.map((recipe) => {
            const outputItem = itemDefinitions.find((item) => item.id === recipe.output_item_id) ?? null;
            const imageUri = resolveInventoryThumbnailUri(outputItem);
            const badgeIconUri = getCraftingRecipeSymbolUri(recipe);
            const isSelected = selectedRecipe?.id === recipe.id;
            const status = getCraftingStatus(recipe, inventoryItems);

            return (
              <Pressable key={recipe.id} style={[styles.craftingRecipeChip, isSelected && styles.craftingRecipeChipActive]} onPress={() => setSelectedRecipeId(recipe.id)}>
                {badgeIconUri ? (
                  <View style={styles.craftingRecipeBadge}>
                    <CachedGameImage uri={badgeIconUri} style={styles.craftingRecipeBadgeIcon} resizeMode="cover" />
                  </View>
                ) : null}
                <View style={styles.craftingRecipeThumb}>
                  {imageUri ? (
                    <CachedGameImage uri={imageUri} style={styles.craftingRecipeImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.marketItemFallback}>{recipe.name.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.craftingRecipeName} numberOfLines={2}>{recipe.name}</Text>
                <Text style={status.canCraft ? styles.craftingReadyMini : styles.craftingMissingMini}>{status.canCraft ? "Ready" : status.hasBlueprint ? "Missing" : "Locked"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {selectedRecipe && selectedStatus ? (
        <View style={styles.craftingDetailCard}>
          <View style={styles.craftingDetailBanner}>
            {getCraftingRecipeSymbolUri(selectedRecipe) ? (
              <View style={styles.craftingDetailSymbol}>
                <CachedGameImage uri={getCraftingRecipeSymbolUri(selectedRecipe)} style={styles.craftingDetailSymbolImage} resizeMode="cover" />
              </View>
            ) : null}
            <View style={styles.craftingBannerCopy}>
              <Text style={styles.craftingBannerEyebrow}>{getCraftingRecipeStationLabel(selectedRecipe)}</Text>
              <Text style={styles.craftingBannerTitle}>{getCraftingRecipeCategoryLabel(selectedRecipe)}</Text>
            </View>
            <Text style={selectedStatus.canCraft ? styles.craftingReadyPill : selectedStatus.hasBlueprint ? styles.craftingMissingPill : styles.craftingLockedPill}>
              {selectedStatus.canCraft ? "Ready" : selectedStatus.hasBlueprint ? "Missing" : "Locked"}
            </Text>
          </View>
          <View style={styles.craftingDetailHeader}>
            <View style={styles.craftingOutputImageBox}>
              {selectedOutputImageUri ? (
                <CachedGameImage uri={selectedOutputImageUri} style={styles.craftingOutputImage} resizeMode="contain" />
              ) : (
                <Text style={styles.marketItemFallback}>{selectedRecipe.name.slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.craftingInfo}>
              <Text style={styles.craftingOutputName}>{selectedRecipe.name}</Text>
              <Text style={styles.craftingDetailCopy}>
                Creates {selectedRecipe.output_quantity} {getCraftingItemName(itemDefinitions, selectedRecipe.output_item_id)}
              </Text>
              {selectedRecipe.station_type ? <Text style={styles.craftingStationPill}>{selectedRecipe.station_type}</Text> : null}
              {selectedRecipe.category ? <Text style={styles.craftingCategoryPill}>{selectedRecipe.category}</Text> : null}
              {selectedRecipe.description ? <Text style={styles.craftingDetailCopy}>{selectedRecipe.description}</Text> : null}
              {selectedStatus.missingBlueprint ? (
                <Text style={styles.lockText}>
                  Requires blueprint: {getCraftingItemName(itemDefinitions, selectedStatus.missingBlueprint.itemId)} {selectedStatus.missingBlueprint.owned} / {selectedStatus.missingBlueprint.needed}
                </Text>
              ) : selectedRecipe.required_blueprint_item_id ? (
                <Text style={styles.craftingReadyText}>Blueprint known.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.craftingMaterialList}>
            <Text style={styles.craftingSectionLabel}>Materials</Text>
            {selectedRecipe.ingredients.length === 0 ? <Text style={styles.lockText}>Recipe needs ingredients before players can craft it.</Text> : null}
            {selectedRecipe.ingredients.map((ingredient) => {
                const owned = getOwnedQuantity(ingredient.item_id);
                const ready = owned >= ingredient.quantity;
                const item = getItemDefinition(ingredient.item_id);
                const materialImageUri = resolveInventoryThumbnailUri(item);

                return (
                  <View key={ingredient.id} style={styles.craftingMaterialRow}>
                    <View style={styles.craftingMaterialImageBox}>
                      {materialImageUri ? (
                        <CachedGameImage uri={materialImageUri} style={styles.craftingMaterialImage} resizeMode="contain" />
                      ) : (
                        <Text style={styles.marketItemFallback}>{getCraftingItemName(itemDefinitions, ingredient.item_id).slice(0, 1).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.craftingMaterialCopy}>
                      <Text style={styles.craftingMaterialName} numberOfLines={1}>{getCraftingItemName(itemDefinitions, ingredient.item_id)}</Text>
                      <Text style={styles.craftingMaterialMeta}>{ready ? "Ready" : "Needed"}</Text>
                    </View>
                    <Text style={ready ? styles.craftingReadyText : styles.craftingMissingText}>{owned} / {ingredient.quantity}</Text>
                  </View>
                );
              })}
          </View>

          {selectedStatus.missingBlueprint ? <Text style={styles.lockText}>This recipe needs its blueprint before it can be crafted.</Text> : null}
          {!selectedStatus.missingBlueprint && selectedStatus.missing.length > 0 ? <Text style={styles.lockText}>Missing materials.</Text> : null}
          {selectedStatus.canCraft ? (
            <View style={styles.craftingBatchPanel}>
              <Text style={styles.craftingSectionLabel}>Craft Quantity</Text>
              <View style={styles.craftingBatchRow}>
                <Pressable style={styles.craftingQuantityButton} onPress={() => setCraftQuantity((current) => Math.max(1, current - 1))}>
                  <Minus size={18} color={colors.gold} strokeWidth={2.7} />
                </Pressable>
                <View style={styles.craftingQuantityValue}>
                  <Text style={styles.craftingQuantityNumber}>{safeCraftQuantity}</Text>
                  <Text style={styles.craftingMaterialMeta}>Max {maxCraftableCount}</Text>
                </View>
                <Pressable style={styles.craftingQuantityButton} onPress={() => setCraftQuantity((current) => Math.min(maxCraftableCount, current + 1))}>
                  <Plus size={18} color={colors.gold} strokeWidth={2.7} />
                </Pressable>
                <Pressable style={styles.craftingMaxButton} onPress={() => setCraftQuantity(maxCraftableCount)}>
                  <Text style={styles.craftingMaxText}>Max</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <Pressable style={[styles.primaryButton, (!selectedStatus.canCraft || craftingNow) && styles.disabledAction]} onPress={() => void craftSelectedRecipe(selectedRecipe)} disabled={!selectedStatus.canCraft || craftingNow}>
            <Text style={styles.primaryText}>{craftingNow ? "Crafting..." : selectedStatus.canCraft ? `Craft x${safeCraftQuantity}` : selectedStatus.missingBlueprint ? "Need Blueprint" : "Need Materials"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const craftingStationIconPaths: Partial<Record<(typeof craftingStationTypes)[number], string>> = {
  all: "assets/Reusable/Icons/MarketIcon.jpg",
  forge: "assets/Reusable/Icons/WeaponsIcon.jpg",
  cooking: "assets/Reusable/Icons/RestIcon.jpg",
  alchemy: "assets/Reusable/Icons/AlchemyIcon.jpg",
  workbench: "assets/Reusable/Items/Mining/MiningPick.jpg",
  enchanting: "assets/Reusable/Icons/Jeweryicon.jpg",
};

const craftingCategoryIconPaths: Partial<Record<(typeof craftingCategories)[number] | "all", string>> = {
  all: "assets/Reusable/Icons/MarketIcon.jpg",
  materials: "assets/Reusable/Items/Mining/IronOre.jpg",
  weapons: "assets/Reusable/Icons/WeaponsIcon.jpg",
  armor: "assets/Reusable/Icons/WearsIcon.jpg",
  consumables: "assets/Reusable/Icons/AlchemyIcon.jpg",
  tools: "assets/Reusable/Items/Mining/MiningPick.jpg",
  quest: "assets/Reusable/Icons/StoryIcon.jpg",
  misc: "assets/Reusable/Icons/TravelHubIcon.jpg",
};

const craftingStationLucideIcons: Partial<Record<(typeof craftingStationTypes)[number], LucideIcon>> = {
  all: Package,
  forge: Anvil,
  cooking: ChefHat,
  alchemy: Beaker,
  workbench: Hammer,
  enchanting: Sparkles,
};

const craftingCategoryLucideIcons: Partial<Record<(typeof craftingCategories)[number] | "all", LucideIcon>> = {
  all: Boxes,
  materials: Pickaxe,
  weapons: Swords,
  armor: Shirt,
  consumables: Beaker,
  tools: Hammer,
  quest: ScrollText,
  misc: Gem,
};

function getCraftingRecipeSymbolUri(recipe: CraftingRecipeWithIngredients) {
  const stationIcon = recipe.station_type ? craftingStationIconPaths[recipe.station_type as (typeof craftingStationTypes)[number]] : null;
  const categoryIcon = recipe.category ? craftingCategoryIconPaths[recipe.category as (typeof craftingCategories)[number]] : null;
  return resolveGameAssetUri(stationIcon ?? categoryIcon ?? "assets/Reusable/Icons/MarketIcon.jpg", "icon");
}

function getCraftingRecipeStationLabel(recipe: CraftingRecipeWithIngredients) {
  return recipe.station_type ? recipe.station_type.replace(/_/g, " ") : "Any Station";
}

function getCraftingRecipeCategoryLabel(recipe: CraftingRecipeWithIngredients) {
  return recipe.category ? recipe.category.replace(/_/g, " ") : "misc";
}

function CraftingChipRow<T extends string>({ label, options, value, labels, icons, onSelect }: { label: string; options: readonly T[]; value: T; labels: Partial<Record<T, string>>; icons?: Partial<Record<T, LucideIcon>>; onSelect: (value: T) => void }) {
  return (
    <View style={styles.craftingChipGroup}>
      <Text style={styles.craftingChipLabel}>{label}</Text>
      <View style={styles.craftingChipScroll}>
        {options.map((option) => {
          const Icon = icons?.[option] as LucideIcon | undefined;
          return (
            <Pressable key={option} style={[styles.craftingFilterChip, value === option && styles.craftingFilterChipActive]} onPress={() => onSelect(option)}>
              {Icon ? (
                <View style={styles.craftingFilterIconBox}>
                  <Icon size={14} color={value === option ? colors.blue : colors.goldSoft} strokeWidth={2.4} />
                </View>
              ) : null}
              <Text style={[styles.craftingFilterChipText, value === option && styles.craftingFilterChipTextActive]}>{labels[option] ?? option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MarketScene({
  characterGold,
  marketItems,
  marketPurchaseCounts,
  inventoryItems,
  itemDefinitions,
  mountDefinitions,
  onBuy,
  onSell,
}: {
  characterGold: number;
  marketItems: MarkerMarketItem[];
  marketPurchaseCounts: Record<string, number>;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  mountDefinitions: MountDefinition[];
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
}) {
  const [activeMode, setActiveMode] = useState<MarketMode>("Buy");
  const [selectedMarketItem, setSelectedMarketItem] = useState<SelectedMarketItem | null>(null);
  const itemById = useMemo(() => new Map(itemDefinitions.map((item) => [item.id, item])), [itemDefinitions]);
  const mountById = useMemo(() => new Map(mountDefinitions.map((mount) => [mount.id, mount])), [mountDefinitions]);
  const marketItemByItemId = useMemo(() => new Map(marketItems.filter((marketItem) => marketItem.item_id).map((marketItem) => [marketItem.item_id as string, marketItem])), [marketItems]);
  const sellableMarketItemIds = useMemo(() => new Set(marketItems.filter(canMarketItemBeSoldTo).map((marketItem) => marketItem.item_id).filter((itemId): itemId is string => Boolean(itemId))), [marketItems]);
  const buyableItems = useMemo(
    () => marketItems
      .filter((marketItem) => canMarketItemBeBought(marketItem) && getRemainingMarketStock(marketItem, marketPurchaseCounts) > 0)
      .map((marketItem) => ({
        marketItem,
        item: marketItem.purchase_type === "mount" ? null : itemById.get(marketItem.item_id ?? "") ?? null,
        mount: marketItem.purchase_type === "mount" ? mountById.get(marketItem.mount_id ?? "") ?? null : null,
      })),
    [itemById, marketItems, marketPurchaseCounts, mountById],
  );
  const sellableItems = useMemo(
    () => inventoryItems.filter((entry) => entry.item.sellable && sellableMarketItemIds.has(entry.item_id)),
    [inventoryItems, sellableMarketItemIds],
  );

  return (
    <View style={styles.marketScene}>
      <View style={styles.marketHeaderRow}>
        <View style={styles.marketHeaderCopy}>
          <Text style={styles.marketTitle}>Market</Text>
          <Text style={styles.marketSubtitle}>Goods currently available</Text>
        </View>
        <View style={styles.marketGoldPill}>
          <Text style={styles.marketPriceLabel}>Your Gold</Text>
          <Text style={styles.marketBuyPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{characterGold.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.marketCategoryTabs}>
        {marketModes.map((mode) => (
          <Pressable key={mode} style={[styles.marketCategoryButton, activeMode === mode && styles.marketCategoryActive]} onPress={() => {
            setActiveMode(mode);
            setSelectedMarketItem(null);
          }}>
            <Text style={[styles.marketCategoryText, activeMode === mode && styles.marketCategoryTextActive]}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      {selectedMarketItem ? (
        <MarketItemDetail
          selected={selectedMarketItem}
          onClose={() => setSelectedMarketItem(null)}
          onBuy={() => {
            if (selectedMarketItem.mode === "Buy") {
              onBuy(selectedMarketItem.marketItem);
            }
          }}
          onSell={() => {
            if (selectedMarketItem.mode === "Sell") {
              onSell(selectedMarketItem.entry);
            }
          }}
        />
      ) : null}

      <ScrollView
        style={styles.marketListScroller}
        contentContainerStyle={styles.marketListContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {activeMode === "Buy" ? (
          <View style={styles.marketList}>
            {buyableItems.length === 0 ? <Text style={styles.copy}>This market has no items for sale.</Text> : null}
            {buyableItems.map(({ marketItem, item, mount }) => (
              <MarketBuyCard
                key={marketItem.id}
                marketItem={marketItem}
                purchasedCount={marketPurchaseCounts[marketItem.id] ?? 0}
                item={item}
                mount={mount}
                onBuy={() => onBuy(marketItem)}
                onInspect={() => setSelectedMarketItem({ mode: "Buy", marketItem, item, mount, purchasedCount: marketPurchaseCounts[marketItem.id] ?? 0 })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.marketList}>
            {sellableItems.length === 0 ? <Text style={styles.copy}>This market is not buying anything in your inventory.</Text> : null}
            {sellableItems.map((entry) => {
              const marketItem = marketItemByItemId.get(entry.item_id);
              return (
                <MarketSellCard
                  key={entry.id}
                  entry={entry}
                  sellPrice={marketItem?.sell_price ?? 0}
                  onSell={() => onSell(entry)}
                  onInspect={() => setSelectedMarketItem({ mode: "Sell", entry, marketItem })}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MarketBuyCard({ marketItem, purchasedCount, item, mount, onBuy, onInspect }: { marketItem: MarkerMarketItem; purchasedCount: number; item: ItemDefinition | null; mount: MountDefinition | null; onBuy: () => void; onInspect: () => void }) {
  const isMount = marketItem.purchase_type === "mount";
  const imageUri = isMount ? resolveMountThumbnailUri(mount) : resolveInventoryThumbnailUri(item);
  const remainingStock = getRemainingMarketStock(marketItem, { [marketItem.id]: purchasedCount });
  const outOfStock = remainingStock <= 0;
  const name = isMount ? mount?.name ?? "Unknown Mount" : item?.name ?? "Unknown Item";
  const typeLabel = isMount ? `${mount?.breed || "Mount"} / ${mount?.rarity || "common"}` : `${item?.type ?? "item"} / ${item?.rarity ?? "common"}`;
  const description = isMount ? mount?.description : item?.description;

  return (
    <Pressable style={[styles.marketCard, outOfStock && styles.lockedCard]} onPress={onInspect}>
      <View style={styles.marketImageBox}>
        {imageUri ? <CachedGameImage uri={imageUri} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{name}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{typeLabel}</Text>
        {description ? <Text style={styles.marketItemDescription} numberOfLines={2}>{description}</Text> : null}
        {isMount ? <Text style={styles.marketStockText}>Trail progress x{normalizeMountMultiplier(mount?.progress_multiplier).toFixed(2)}</Text> : null}
        <Text style={styles.marketStockText}>{marketItem.unlimited_stock ? "Unlimited stock" : `${remainingStock} available for you`}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <View style={styles.marketPriceBox}>
          <Text style={styles.marketPriceLabel}>Buy</Text>
          <Text style={styles.marketBuyPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{marketItem.buy_price}</Text>
        </View>
        <Pressable style={[styles.marketActionButton, outOfStock && styles.disabledAction]} onPress={(event) => {
          event.stopPropagation();
          onBuy();
        }} disabled={outOfStock}>
          <Text style={styles.marketActionText}>{outOfStock ? "Sold Out" : "Buy"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function MarketSellCard({ entry, sellPrice, onSell, onInspect }: { entry: InventoryItem; sellPrice: number; onSell: () => void; onInspect: () => void }) {
  const imageUri = resolveInventoryThumbnailUri(entry.item);

  return (
    <Pressable style={styles.marketCard} onPress={onInspect}>
      <View style={styles.marketImageBox}>
        {imageUri ? <CachedGameImage uri={imageUri} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{entry.item.name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.marketCardBody}>
        <Text style={styles.marketItemName} numberOfLines={1}>{entry.item.name}</Text>
        <Text style={styles.marketItemType} numberOfLines={1}>{entry.item.type} / owned x{entry.quantity}</Text>
        <Text style={styles.marketItemDescription} numberOfLines={2}>{entry.item.description || "Marketable inventory item"}</Text>
      </View>
      <View style={styles.marketBuyColumn}>
        <View style={styles.marketPriceBox}>
          <Text style={styles.marketPriceLabel}>You Get</Text>
          <Text style={styles.marketSellPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{sellPrice}</Text>
          <Text style={styles.marketPriceUnit}>gold each</Text>
        </View>
        <Pressable style={styles.marketSellButton} onPress={(event) => {
          event.stopPropagation();
          onSell();
        }}>
          <Text style={styles.secondaryText}>Sell 1 Item</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function MarketItemDetail({
  selected,
  onClose,
  onBuy,
  onSell,
}: {
  selected: SelectedMarketItem;
  onClose: () => void;
  onBuy: () => void;
  onSell: () => void;
}) {
  const isMount = selected.mode === "Buy" && selected.marketItem.purchase_type === "mount";
  const item = selected.mode === "Buy" ? selected.item : selected.entry.item;
  const mount = selected.mode === "Buy" ? selected.mount : null;
  const displayName = isMount ? mount?.name ?? "Unknown Mount" : item?.name ?? "Unknown Item";
  const displayType = isMount ? `${mount?.breed || "Mount"} / ${mount?.rarity || "common"}` : `${item?.type ?? "item"} / ${item?.rarity ?? "common"}`;
  const displayDescription = isMount ? mount?.description : item?.description;
  const imageUri = isMount ? resolveMountImageUri(mount?.image_url) : resolveInventoryImageUri(item?.image_path);
  const remainingStock = selected.mode === "Buy"
    ? getRemainingMarketStock(selected.marketItem, { [selected.marketItem.id]: selected.purchasedCount })
    : Number(selected.entry.quantity) || 0;
  const price = selected.mode === "Buy" ? selected.marketItem.buy_price : selected.marketItem?.sell_price ?? 0;

  return (
    <View style={styles.marketDetailPanel}>
      <View style={styles.marketDetailHeader}>
        <View style={styles.marketDetailImageBox}>
          {imageUri ? <CachedGameImage uri={imageUri} style={styles.marketItemImage} /> : <Text style={styles.marketItemFallback}>{displayName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.marketDetailBody}>
          <Text style={styles.marketItemName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.marketItemType}>{displayType}</Text>
          <Text style={styles.marketItemDescription}>{displayDescription || "No details available yet."}</Text>
        </View>
      </View>
      <View style={styles.marketDetailStats}>
        <Text style={styles.statPill}>{selected.mode}</Text>
        <Text style={styles.statPill}>{selected.mode === "Buy" ? `${price} gold` : `${price} gold each`}</Text>
        <Text style={styles.statPill}>{selected.mode === "Buy" ? selected.marketItem.unlimited_stock ? "Unlimited" : `${remainingStock} left` : `Owned x${remainingStock}`}</Text>
        {item?.damage_amount ? <Text style={styles.statPill}>DMG {item.damage_amount}</Text> : null}
        {item?.armor_value ? <Text style={styles.statPill}>Armor {item.armor_value}</Text> : null}
        {item?.restore_amount ? <Text style={styles.statPill}>Restore {item.restore_amount}</Text> : null}
        {item?.weight ? <Text style={styles.statPill}>{Number(item.weight).toFixed(1)} wt</Text> : null}
        {isMount ? <Text style={styles.statPill}>Trail x{normalizeMountMultiplier(mount?.progress_multiplier).toFixed(2)}</Text> : null}
      </View>
      <View style={styles.marketDetailActions}>
        <Pressable
          style={selected.mode === "Buy" ? styles.marketActionButton : styles.marketSellButton}
          onPress={() => {
            if (selected.mode === "Sell") {
              onClose();
              onSell();
              return;
            }
            onBuy();
          }}
        >
          <Text style={selected.mode === "Buy" ? styles.marketActionText : styles.secondaryText}>{selected.mode === "Buy" ? isMount ? "Buy Mount" : "Buy Item" : "Sell 1 Item"}</Text>
        </Pressable>
        <Pressable style={styles.marketCloseButton} onPress={onClose}>
          <Text style={styles.secondaryText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function resolveSceneImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "scene");
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "soon";
  }
  return new Date(value).toLocaleDateString();
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
    overflow: "hidden",
  },
  sceneBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
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
  craftingShell: {
    gap: 12,
  },
  craftingFilterBlock: {
    borderColor: "rgba(218, 164, 65, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  craftingChipGroup: {
    gap: 5,
  },
  craftingChipLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  craftingChipScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingRight: 6,
  },
  craftingFilterChip: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    justifyContent: "center",
    paddingLeft: 6,
    paddingRight: 10,
  },
  craftingFilterChipActive: {
    backgroundColor: "rgba(24, 178, 242, 0.15)",
    borderColor: colors.blue,
  },
  craftingFilterChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  craftingFilterChipTextActive: {
    color: colors.blue,
  },
  craftingBatchPanel: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  craftingBatchRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  craftingQuantityButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 44,
  },
  craftingQuantityValue: {
    alignItems: "center",
    borderColor: "rgba(24, 178, 242, 0.45)",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  craftingQuantityNumber: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  craftingMaxButton: {
    alignItems: "center",
    borderColor: colors.blue,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  craftingMaxText: {
    color: colors.blue,
    fontWeight: "900",
  },
  craftingFilterIcon: {
    height: "100%",
    width: "100%",
  },
  craftingFilterIconBox: {
    alignItems: "center",
    borderColor: "rgba(218, 164, 65, 0.45)",
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    overflow: "hidden",
    width: 22,
  },
  emptyCraftingCard: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  craftingRecipeStrip: {
    gap: 10,
    paddingRight: 4,
  },
  craftingRecipeChip: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minHeight: 106,
    padding: 8,
    position: "relative",
    width: 88,
  },
  craftingRecipeChipActive: {
    backgroundColor: "rgba(217, 170, 93, 0.16)",
    borderColor: colors.gold,
  },
  craftingRecipeBadge: {
    backgroundColor: "#050403",
    borderColor: colors.gold,
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    overflow: "hidden",
    position: "absolute",
    right: 4,
    top: 4,
    width: 26,
    zIndex: 2,
  },
  craftingRecipeBadgeIcon: {
    height: "100%",
    width: "100%",
  },
  craftingRecipeThumb: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    borderColor: "rgba(217, 170, 93, 0.28)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    width: 56,
  },
  craftingRecipeImage: {
    height: "86%",
    width: "86%",
  },
  craftingRecipeName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center",
  },
  craftingReadyMini: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  craftingMissingMini: {
    color: "#f0a0a0",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  craftingDetailCard: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  craftingDetailBanner: {
    alignItems: "center",
    backgroundColor: "rgba(2, 172, 231, 0.08)",
    borderColor: "rgba(218, 164, 65, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    padding: 8,
  },
  craftingDetailSymbol: {
    borderColor: colors.gold,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    overflow: "hidden",
    width: 42,
  },
  craftingDetailSymbolImage: {
    height: "100%",
    width: "100%",
  },
  craftingBannerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  craftingBannerEyebrow: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  craftingBannerTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "capitalize",
  },
  craftingReadyPill: {
    borderColor: "rgba(81, 214, 139, 0.45)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.green,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  craftingMissingPill: {
    borderColor: "rgba(240, 160, 160, 0.45)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#f0a0a0",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  craftingLockedPill: {
    borderColor: "rgba(218, 164, 65, 0.45)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  craftingDetailHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  craftingOutputImageBox: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    width: 92,
  },
  craftingOutputImage: {
    height: "88%",
    width: "88%",
  },
  craftingOutputName: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  craftingDetailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  craftingStationPill: {
    alignSelf: "flex-start",
    borderColor: "rgba(28, 181, 246, 0.38)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  craftingCategoryPill: {
    alignSelf: "flex-start",
    borderColor: "rgba(218, 164, 65, 0.38)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  craftingMaterialList: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  craftingSectionLabel: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  craftingMaterialRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
  },
  craftingMaterialImageBox: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    borderColor: "rgba(217, 170, 93, 0.24)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    width: 38,
  },
  craftingMaterialImage: {
    height: "84%",
    width: "84%",
  },
  craftingMaterialCopy: {
    flex: 1,
    minWidth: 0,
  },
  craftingMaterialName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  craftingMaterialMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  craftingReadyText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "900",
  },
  craftingMissingText: {
    color: "#f0a0a0",
    fontSize: 13,
    fontWeight: "900",
  },
  craftingCard: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  craftingHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  craftingImageBox: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    width: 74,
  },
  craftingImage: {
    height: "100%",
    width: "100%",
  },
  craftingInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  craftingRequirements: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  craftingRequirementRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
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
    minHeight: 360,
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
  marketHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  bankTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bankIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217, 170, 93, 0.12)",
  },
  bankSummaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  bankSummaryCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.22)",
    padding: 10,
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  bankGoldPanel: {
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  bankGoldRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  bankGoldInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  bankQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  marketTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    flexShrink: 1,
  },
  marketSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  marketGoldPill: {
    minWidth: 88,
    maxWidth: 132,
    flexShrink: 1,
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
  marketListScroller: {
    maxHeight: 560,
  },
  marketListContent: {
    paddingBottom: 18,
  },
  marketDetailPanel: {
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.5)",
    backgroundColor: "rgba(6, 20, 28, 0.78)",
    padding: 10,
  },
  marketDetailHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  marketDetailImageBox: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(218,164,65,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  marketDetailBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  marketDetailStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  marketDetailActions: {
    flexDirection: "row",
    gap: 8,
  },
  marketCloseButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 9,
    gap: 10,
    backgroundColor: "rgba(4, 7, 6, 0.82)",
    flexDirection: "row",
    alignItems: "center",
  },
  marketImageBox: {
    width: 88,
    height: 88,
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
    borderRadius: 9,
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
    width: 88,
    gap: 8,
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
    overflow: "hidden",
  },
  marketBuyPrice: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 18,
    maxWidth: "100%",
    textAlign: "center",
  },
  marketSellPrice: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 18,
    maxWidth: "100%",
    textAlign: "center",
  },
  marketPriceUnit: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  marketStockText: {
    color: colors.green,
    fontSize: 12,
    lineHeight: 17,
  },
  marketActionButton: {
    flex: 1,
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
    flex: 1,
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
