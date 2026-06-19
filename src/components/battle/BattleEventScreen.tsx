import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AbilityDefinition, CharacterResources } from "../../services/abilityService";
import { CharacterWithDetails } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { InventoryItem, ItemDefinition, isReviveBattleItem } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { BattleActionCard, CombatIndicatorStack, ResourceMeter, type CombatIndicator } from "./BattleDisplay";

type BattleEventScreenProps = {
  character: CharacterWithDetails;
  event: MapEvent;
  playerHp: number;
  stamina: number;
  magicka: number;
  resources: CharacterResources;
  enemyHp: number;
  activeEnemy: EnemyWithLoadout | NpcWithLoadout | null;
  equippedAbilities: Array<AbilityDefinition | null>;
  weapon: ItemDefinition | null;
  battleItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  combatIndicators: CombatIndicator[];
  revivePromptOpen: boolean;
  result: "victory" | "defeat" | null;
  previewMode?: boolean;
  onAction: (ability: AbilityDefinition) => void;
  onWeaponAction: (weapon: ItemDefinition) => void;
  onFlee: () => void;
  onUseItem: (item: InventoryItem) => void;
  onToggleInventory: () => void;
  onDeclineRevive: () => void;
  onReturnToStart: () => void;
  onComplete: () => void;
  onExitPreview?: () => void;
};

export function BattleEventScreen({
  character,
  event,
  playerHp,
  stamina,
  magicka,
  resources,
  enemyHp,
  activeEnemy,
  equippedAbilities,
  battleItems,
  inventoryOpen,
  battleLog,
  combatIndicators,
  revivePromptOpen,
  result,
  previewMode = false,
  onAction,
  onFlee,
  onUseItem,
  onToggleInventory,
  onDeclineRevive,
  onReturnToStart,
  onComplete,
  onExitPreview,
}: BattleEventScreenProps) {
  const [enemyImageFailed, setEnemyImageFailed] = useState(false);
  const [playerImageFailed, setPlayerImageFailed] = useState(false);
  const enemyImageUri = resolveEnemyImageUri(activeEnemy?.image_url ?? event.enemy_image_url);
  const backgroundUri = resolveSceneImageUri(event.background_image_url);
  const enemyMaxHp = Number(activeEnemy?.health ?? event.enemy_hp) || 30;
  const rewardXp = Number(event.reward_xp ?? 0) + Number(activeEnemy?.xp_reward ?? 0);
  const rewardGold = Number(event.reward_gold ?? 0) + Number(activeEnemy?.gold_reward ?? 0);
  const battlePhase = result === "victory" ? "Victory" : result === "defeat" ? "Defeat" : revivePromptOpen ? "Revive Choice" : "Your Turn";
  const playerTurnActive = !result && !revivePromptOpen;
  const enemyIntent = getEnemyIntent(activeEnemy, event);
  const enemyLevel = getBattleEnemyLevel(enemyMaxHp);

  useEffect(() => {
    setEnemyImageFailed(false);
  }, [enemyImageUri]);

  useEffect(() => {
    setPlayerImageFailed(false);
  }, [character.portrait_url]);

  const enemyIndicators = combatIndicators.filter((indicator) => indicator.target === "enemy");
  const playerIndicators = combatIndicators.filter((indicator) => indicator.target === "player");
  const reviveItem = battleItems.find((entry) => isReviveBattleItem(entry.item));

  return (
    <Screen>
      <Frame style={backgroundUri ? [styles.eventScreen, styles.battleScreenFrame, ({ backgroundImage: `url(${backgroundUri})`, backgroundSize: "cover", backgroundPosition: "center" } as never)] : [styles.eventScreen, styles.battleScreenFrame]}>
        <View style={styles.battleBackdrop}>
          {previewMode ? (
            <View style={styles.previewBanner}>
              <Text style={styles.previewText}>Admin Battle Preview - no Health, items, rewards, or route progress will be saved.</Text>
              <Pressable style={styles.previewExitButton} onPress={onExitPreview}>
                <Text style={styles.secondaryText}>Exit Preview</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.battleHeader}>
            <View>
              <Text style={styles.sectionTitle}>{event.title}</Text>
              <Text style={styles.copy}>{event.battle_intro_text || "Battle encounter"}</Text>
            </View>
            <View style={styles.phasePill}>
              <Text style={styles.phaseText}>{battlePhase}</Text>
            </View>
          </View>
          <View style={styles.battleArena}>
            <View style={[styles.enemyPanel, !playerTurnActive && !result && styles.combatantActive]}>
              <View style={styles.combatantInfo}>
                <Text style={styles.combatantName} numberOfLines={1}>{activeEnemy?.name || event.enemy_name || "Enemy"}</Text>
                <Text style={styles.combatantSub} numberOfLines={1}>{activeEnemy?.type || "Enemy"} / Level {enemyLevel}</Text>
                <ResourceMeter label="HP" value={enemyHp} max={enemyMaxHp} color={colors.red} />
                <View style={styles.enemyIntentBox}>
                  <Text style={styles.enemyIntentLabel}>Intent</Text>
                  <Text style={styles.enemyIntentText} numberOfLines={1}>{enemyIntent}</Text>
                </View>
                {enemyImageUri && enemyImageFailed ? <Text style={styles.errorText}>Enemy image failed to load.</Text> : null}
              </View>
              <View style={[styles.combatImageWrap, enemyIndicators.length > 0 && styles.combatImageHit]}>
                {enemyImageUri && !enemyImageFailed ? <Image source={{ uri: enemyImageUri }} style={styles.enemyImage} onError={() => setEnemyImageFailed(true)} /> : <View style={styles.enemyImagePlaceholder}><Text style={styles.copy}>Enemy image missing</Text></View>}
                <CombatIndicatorStack indicators={enemyIndicators} />
              </View>
            </View>
            <View style={[styles.playerPanel, playerTurnActive && styles.combatantActive]}>
              <View style={[styles.combatImageWrap, playerIndicators.length > 0 && styles.combatImageHit]}>
                {character.portrait_url && !playerImageFailed ? <Image source={{ uri: character.portrait_url }} style={styles.battlePortrait} onError={() => setPlayerImageFailed(true)} /> : <Text style={styles.playerInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>}
                <CombatIndicatorStack indicators={playerIndicators} />
              </View>
              <View style={styles.combatantInfo}>
                <Text style={styles.combatantName} numberOfLines={1}>{character.name}</Text>
                <Text style={styles.combatantSub} numberOfLines={1}>{character.origin || "Adventurer"}</Text>
                <ResourceMeter label="HP" value={playerHp} max={resources.maxHp} color={colors.red} />
                <ResourceMeter label="Stamina" value={stamina} max={resources.maxStamina} color={colors.gold} compact />
                <ResourceMeter label="Mana" value={magicka} max={resources.maxMagicka} color={colors.blue} compact />
              </View>
            </View>
          </View>
          <View style={styles.abilityGrid}>
            {equippedAbilities.map((ability, index) => {
              const resourcePool = ability?.resource === "stamina" ? stamina : ability?.resource === "magicka" ? magicka : ability?.resource === "health" ? playerHp : Number.POSITIVE_INFINITY;
              const hasResource = ability ? resourcePool >= ability.cost : false;
              return (
                <BattleActionCard
                  key={`ability-${index}`}
                  ability={ability}
                  slotNumber={index + 1}
                  disabled={!ability || !hasResource || Boolean(result)}
                  unavailableReason={ability && !hasResource ? "Not enough resource" : null}
                  onPress={() => ability ? onAction(ability) : undefined}
                />
              );
            })}
          </View>
          <View style={styles.battleUtilityRow}>
            <Pressable style={styles.inventoryBattleButton} onPress={onToggleInventory}>
              <Text style={styles.secondaryText}>Inventory</Text>
            </Pressable>
            {!result ? (
              <Pressable style={styles.fleeBattleButton} onPress={onFlee}>
                <Text style={styles.dangerText}>Flee</Text>
              </Pressable>
            ) : null}
          </View>
          {revivePromptOpen ? (
            <View style={styles.revivePrompt}>
              <Text style={styles.selectedTitle}>You have fallen</Text>
              <Text style={styles.copy}>
                {reviveItem ? `${reviveItem.item.name} is in your inventory. Use it to continue this battle, or return to the start of the trail.` : "No Revive Scroll found. Return to the start of the trail."}
              </Text>
              <View style={styles.modeRow}>
                {reviveItem ? (
                  <Pressable style={styles.primaryButton} onPress={() => onUseItem(reviveItem)}>
                    <Text style={styles.primaryText}>Use {reviveItem.item.name}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.secondaryButtonFlex} onPress={onDeclineRevive}>
                  <Text style={styles.secondaryText}>Return to Trail Start</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {inventoryOpen ? (
            <View style={styles.battleInventory}>
              {battleItems.length === 0 ? <Text style={styles.copy}>No usable battle items.</Text> : null}
              {battleItems.map((entry) => (
                <Pressable key={entry.id} style={styles.feedItem} onPress={() => onUseItem(entry)}>
                  <Text style={styles.markerName}>{entry.item.name} x{entry.quantity}</Text>
                  <Text style={styles.copy}>{entry.item.type} - restores {entry.item.restore_amount || entry.item.restore_percent || 0} {formatResourceName(entry.item.potion_target ?? "health")}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {result === "victory" ? (
            <View style={styles.battleResultPanel}>
              <Text style={styles.selectedTitle}>Victory Rewards</Text>
              <Text style={styles.copy}>{event.victory_text || "The enemy falls."}</Text>
              <Text style={styles.copy}>XP {rewardXp} / Gold {rewardGold}{event.reward_item_id ? " / Item reward ready" : ""}</Text>
              <Pressable style={styles.primaryButton} onPress={onComplete}>
                <Text style={styles.primaryText}>Claim Rewards</Text>
              </Pressable>
            </View>
          ) : null}
          {result === "defeat" && !revivePromptOpen ? (
            <View style={styles.battleResultPanel}>
              <Text style={styles.selectedTitle}>Defeated</Text>
              <Text style={styles.copy}>Defeat is final for this attempt. Return to the trail start to continue.</Text>
              <Pressable style={styles.primaryButton} onPress={onReturnToStart}>
                <Text style={styles.primaryText}>Return to Trail Start</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.battleLogPanel}>
            <Text style={styles.battleLogTitle}>Battle Log</Text>
            {battleLog.slice(0, 5).map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.battleLogLine}>{line}</Text>
            ))}
          </View>
        </View>
      </Frame>
    </Screen>
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

function formatResourceName(resource: string) {
  if (resource === "magicka" || resource === "magika") {
    return "Mana";
  }
  if (resource === "health") {
    return "Health";
  }
  if (resource === "stamina") {
    return "Stamina";
  }
  return resource;
}

function getEnemyIntent(enemy: EnemyWithLoadout | NpcWithLoadout | null, event: MapEvent) {
  const strongestAbility = enemy?.abilities
    ?.filter((entry) => entry.ability)
    .sort((a, b) => Number(b.use_weight ?? 0) - Number(a.use_weight ?? 0))[0]?.ability;

  if (strongestAbility) {
    return strongestAbility.type === "attack"
      ? `Preparing ${strongestAbility.name}`
      : `May use ${strongestAbility.name}`;
  }

  return event.enemy_attack_damage > 0 ? `Attack for ${event.enemy_attack_damage}` : "Watching your move";
}

function getBattleEnemyLevel(enemyMaxHp: number) {
  return Math.max(1, Math.round(enemyMaxHp / 25));
}

const styles = StyleSheet.create({
  eventScreen: {
    margin: 12,
    padding: 14,
    gap: 12,
  },
  battleScreenFrame: {
    overflow: "hidden",
  },
  battleBackdrop: {
    gap: 10,
    padding: 10,
    paddingTop: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  previewBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.42)",
    padding: 10,
    gap: 8,
  },
  previewText: {
    color: colors.text,
    fontWeight: "800",
    lineHeight: 18,
  },
  previewExitButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  battleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
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
  phasePill: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(7, 16, 22, 0.82)",
  },
  phaseText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  battleArena: {
    minHeight: 340,
    justifyContent: "space-between",
    gap: 18,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  enemyPanel: {
    alignSelf: "flex-end",
    width: "84%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 180, 170, 0.52)",
    padding: 9,
    backgroundColor: "rgba(12, 8, 8, 0.58)",
    shadowColor: "#ff6d63",
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  playerPanel: {
    alignSelf: "flex-start",
    width: "84%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.5)",
    padding: 9,
    backgroundColor: "rgba(6, 16, 24, 0.62)",
    shadowColor: colors.blue,
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  combatantActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.68)",
    shadowColor: colors.blue,
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  combatantInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  combatantName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  combatantSub: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  combatImageWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  combatImageHit: {
    transform: [{ scale: 1.04 }],
    shadowColor: colors.red,
    shadowOpacity: 0.48,
    shadowRadius: 14,
  },
  enemyImage: {
    width: 126,
    height: 126,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffb4aa",
  },
  enemyImagePlaceholder: {
    width: 126,
    height: 126,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffb4aa",
    backgroundColor: "rgba(100, 20, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  battlePortrait: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.blue,
  },
  playerInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  enemyIntentBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  enemyIntentLabel: {
    color: "#ffb4aa",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  enemyIntentText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  errorText: {
    color: colors.red,
    fontWeight: "800",
    fontSize: 11,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  battleUtilityRow: {
    flexDirection: "row",
    gap: 8,
  },
  inventoryBattleButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 23, 34, 0.58)",
  },
  fleeBattleButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 180, 170, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62, 15, 15, 0.4)",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  dangerText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
  revivePrompt: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(62, 15, 15, 0.34)",
  },
  selectedTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  secondaryButtonFlex: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  battleInventory: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  feedItem: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  markerName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 2,
  },
  battleResultPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(9, 15, 13, 0.86)",
  },
  battleLogPanel: {
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.22)",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  battleLogTitle: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  battleLogLine: {
    color: colors.text,
    lineHeight: 18,
    fontSize: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingTop: 6,
  },
});
