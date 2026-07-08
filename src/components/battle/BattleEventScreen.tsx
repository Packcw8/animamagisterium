import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AbilityDefinition, CharacterResources } from "../../services/abilityService";
import { CharacterWithDetails } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { InventoryItem, ItemDefinition, isReviveBattleItem } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { BattleEventCombatant, MarkerBattleCombatant } from "../../services/battlefieldService";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { BattleActionCard, CircularResourceArcs, CombatPortraitFrame, type CombatIndicator } from "./BattleDisplay";
import { type BattleCompanionState, type BattleOpponentState, type BattleTurnPhase } from "./useBattleEncounter";

type BattleEventScreenProps = {
  character: CharacterWithDetails;
  event: MapEvent;
  playerHp: number;
  stamina: number;
  magicka: number;
  resources: CharacterResources;
  enemyHp: number;
  enemyStamina: number;
  enemyMana: number;
  activeEnemy: EnemyWithLoadout | NpcWithLoadout | null;
  opponents?: BattleOpponentState[];
  companions?: BattleCompanionState[];
  layoutCombatants?: Array<BattleEventCombatant | MarkerBattleCombatant>;
  selectedOpponentKey?: string | null;
  equippedAbilities: Array<AbilityDefinition | null>;
  weapon: ItemDefinition | null;
  battleItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  battleTurnPhase: BattleTurnPhase;
  combatIndicators: CombatIndicator[];
  revivePromptOpen: boolean;
  result: "victory" | "defeat" | null;
  previewMode?: boolean;
  defeatTitle?: string;
  defeatBody?: string;
  defeatActionLabel?: string;
  onAction: (ability: AbilityDefinition) => void;
  onSelectOpponent?: (opponentKey: string) => void;
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
  enemyStamina,
  enemyMana,
  activeEnemy,
  opponents = [],
  companions = [],
  layoutCombatants = [],
  selectedOpponentKey = null,
  equippedAbilities,
  battleItems,
  inventoryOpen,
  battleLog,
  battleTurnPhase,
  combatIndicators,
  revivePromptOpen,
  result,
  previewMode = false,
  defeatTitle = "Defeated",
  defeatBody = "Defeat is final for this attempt. Continue from 5% back on the path.",
  defeatActionLabel = "Continue From Setback",
  onAction,
  onSelectOpponent,
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
  const battlePhase = result === "victory" ? "Victory" : result === "defeat" ? "Defeat" : revivePromptOpen ? "Revive Choice" : battleTurnPhase === "enemy" ? "Enemy Turn" : battleTurnPhase === "rolling" ? "Rolling" : "Your Turn";
  const playerTurnActive = !result && !revivePromptOpen && battleTurnPhase === "player";
  const enemyTurnActive = !result && battleTurnPhase === "enemy";
  const enemyIntent = getEnemyIntent(activeEnemy, event);
  const enemyLevel = getBattleEnemyLevel(enemyMaxHp);

  useEffect(() => {
    setEnemyImageFailed(false);
  }, [enemyImageUri]);

  useEffect(() => {
    setPlayerImageFailed(false);
  }, [character.portrait_url]);

  const visibleOpponents = opponents.length > 0 ? opponents : [];
  const enemyIndicators = combatIndicators.filter((indicator) => indicator.target === "enemy");
  const playerIndicators = combatIndicators.filter((indicator) => indicator.target === "player");
  const reviveItem = battleItems.find((entry) => isReviveBattleItem(entry.item));
  const enemyName = activeEnemy?.name || event.enemy_name || "Enemy";
  const enemySubtitle = `${activeEnemy?.type || "Enemy"} / Level ${enemyLevel}`;
  const playerCombatant = layoutCombatants.find((combatant) => combatant.side === "player" && combatant.is_active);
  const fallbackPlayerCombatant = { x_percent: 24, y_percent: 68, size_percent: 22 };
  const playerSizePercent = Number(playerCombatant?.size_percent ?? fallbackPlayerCombatant.size_percent) || fallbackPlayerCombatant.size_percent;
  const playerSize = Math.max(48, Math.min(112, playerSizePercent * 5.6));
  const playerRingSize = Math.max(50, playerSize - 2);
  const playerRingRadius = Math.max(20, playerRingSize / 2 - 7);

  return (
    <Screen>
      <Frame style={[styles.eventScreen, styles.battleScreenFrame]}>
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
            <View style={styles.stageLayer}>
              <View style={styles.stageImageViewport}>
                {backgroundUri ? (
                  <Image source={{ uri: backgroundUri }} style={styles.stageImage} resizeMode="contain" />
                ) : (
                  <View style={styles.emptyStageImage}>
                    <Text style={styles.copy}>No battleground image selected.</Text>
                  </View>
                )}
                <View style={styles.combatantSurface}>
                  {visibleOpponents.length > 0 ? (
                    <>
                      {visibleOpponents.map((opponent) => {
                        const name = opponent.enemy?.name || opponent.combatant?.label || "Enemy";
                        const imageUri = resolveEnemyImageUri(opponent.enemy?.image_url);
                        const maxHp = Number(opponent.enemy?.health ?? event.enemy_hp) || 30;
                        const maxStamina = Number(opponent.enemy?.stamina ?? 0) || 0;
                        const maxMana = Number(opponent.enemy?.magika ?? 0) || 0;
                        const isSelected = opponent.key === selectedOpponentKey;
                        const sizePercent = Number(opponent.combatant?.size_percent ?? 14) || 14;
                        const size = Math.max(48, Math.min(112, sizePercent * 5.6));
                        const ringSize = Math.max(50, size - 2);
                        const ringRadius = Math.max(20, ringSize / 2 - 7);
                        return (
                          <Pressable
                            key={`stage-${opponent.key}`}
                            style={[
                              styles.stagedCombatant,
                              isSelected && styles.stagedCombatantSelected,
                              enemyTurnActive && isSelected && styles.stagedEnemyActive,
                              opponent.hp <= 0 && styles.defeatedCombatant,
                              {
                                left: `${opponent.combatant?.x_percent ?? 72}%`,
                                top: `${opponent.combatant?.y_percent ?? 22}%`,
                                width: size,
                                transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
                              } as object,
                            ]}
                            onPress={() => onSelectOpponent?.(opponent.key)}
                          >
                          <CircularResourceArcs
                            size={ringSize}
                            radius={ringRadius}
                              hpPercent={getPercent(opponent.hp, maxHp)}
                              staminaPercent={getPercent(opponent.stamina, maxStamina)}
                              manaPercent={getPercent(opponent.magika, maxMana)}
                          />
                          {imageUri ? <Image source={{ uri: imageUri }} style={styles.stagedCombatantImage} /> : <Text style={styles.stagedCombatantFallback}>{name.slice(0, 1).toUpperCase()}</Text>}
                          {isSelected ? <CombatIndicatorStackOverlay indicators={enemyIndicators} /> : null}
                        </Pressable>
                        );
                      })}
                    </>
                  ) : (
                    <View style={styles.fallbackEnemyPosition}>
                      <CombatPortraitFrame
                        imageUri={enemyImageUri}
                        imageFailed={enemyImageFailed}
                        onImageError={() => setEnemyImageFailed(true)}
                        fallbackText={enemyName}
                        name={enemyName}
                        subtitle={enemySubtitle}
                        hp={enemyHp}
                        maxHp={enemyMaxHp}
                        stamina={enemyStamina}
                        maxStamina={Number(activeEnemy?.stamina ?? 0) || undefined}
                        mana={enemyMana}
                        maxMana={Number(activeEnemy?.magika ?? 0) || undefined}
                        accent="enemy"
                        compact
                        active={enemyTurnActive}
                        indicators={enemyIndicators}
                      />
                      {enemyImageUri && enemyImageFailed ? <Text style={styles.errorText}>Enemy image failed to load.</Text> : null}
                    </View>
                  )}
                  <View
                    style={[
                      styles.stagedCombatant,
                      styles.stagedPlayer,
                      playerTurnActive && styles.stagedPlayerActive,
                      {
                        left: `${playerCombatant?.x_percent ?? fallbackPlayerCombatant.x_percent}%`,
                        top: `${playerCombatant?.y_percent ?? fallbackPlayerCombatant.y_percent}%`,
                        width: playerSize,
                        transform: [{ translateX: -playerSize / 2 }, { translateY: -playerSize / 2 }],
                      } as object,
                    ]}
                  >
                    <CircularResourceArcs
                      size={playerRingSize}
                      radius={playerRingRadius}
                      hpPercent={getPercent(playerHp, resources.maxHp)}
                      staminaPercent={getPercent(stamina, resources.maxStamina)}
                      manaPercent={getPercent(magicka, resources.maxMagicka)}
                    />
                    {character.portrait_url && !playerImageFailed ? (
                      <Image source={{ uri: character.portrait_url }} style={styles.stagedCombatantImage} onError={() => setPlayerImageFailed(true)} />
                    ) : (
                      <Text style={styles.stagedCombatantFallback}>{character.name.slice(0, 2).toUpperCase()}</Text>
                    )}
                    <CombatIndicatorStackOverlay indicators={playerIndicators} />
                  </View>
                  {companions.map((companion) => {
                    const companionName = companion.ally.name || companion.combatant.label || "Companion";
                    const imageUri = resolveEnemyImageUri(companion.ally.image_url);
                    const maxHp = Number(companion.ally.health ?? 30) || 30;
                    const maxStamina = Number(companion.ally.stamina ?? 0) || 0;
                    const maxMana = Number(companion.ally.magika ?? 0) || 0;
                    const sizePercent = Number(companion.combatant.size_percent ?? 13) || 13;
                    const size = Math.max(38, Math.min(92, sizePercent * 4.8));
                    const ringSize = Math.max(40, size - 2);
                    const ringRadius = Math.max(16, ringSize / 2 - 7);
                    const companionIndicators = combatIndicators.filter((indicator) => indicator.target === "companion" && indicator.targetKey === companion.key);

                    return (
                      <View
                        key={`companion-${companion.key}`}
                        style={[
                          styles.stagedCombatant,
                          styles.stagedCompanion,
                          companion.hp <= 0 && styles.defeatedCombatant,
                          {
                            left: `${companion.combatant.x_percent}%`,
                            top: `${companion.combatant.y_percent}%`,
                            width: size,
                            transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
                          } as object,
                        ]}
                      >
                        <CircularResourceArcs
                          size={ringSize}
                          radius={ringRadius}
                          hpPercent={getPercent(companion.hp, maxHp)}
                          staminaPercent={getPercent(companion.stamina, maxStamina)}
                          manaPercent={getPercent(companion.magika, maxMana)}
                        />
                        {imageUri ? <Image source={{ uri: imageUri }} style={styles.stagedCombatantImage} /> : <Text style={styles.stagedCombatantFallback}>{companionName.slice(0, 1).toUpperCase()}</Text>}
                        <CombatIndicatorStackOverlay indicators={companionIndicators} />
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.enemyIntentBadge}>
                <Text style={styles.enemyIntentLabel}>Intent</Text>
                <Text style={styles.enemyIntentText} numberOfLines={1}>{enemyIntent}</Text>
              </View>
            </View>
            <Text style={styles.stageHint}>{playerTurnActive ? "Choose an ability, then strike the selected target." : enemyTurnActive ? "Enemy action resolving..." : "Battle is resolving."}</Text>
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
                  disabled={!ability || !hasResource || Boolean(result) || !playerTurnActive}
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
          <View style={styles.battleLogPanel}>
            <Text style={styles.battleLogTitle}>Battle Log</Text>
            {battleLog.slice(0, 4).map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.battleLogLine}>{line}</Text>
            ))}
          </View>
          {revivePromptOpen ? (
            <View style={styles.revivePrompt}>
              <Text style={styles.selectedTitle}>You have fallen</Text>
              <Text style={styles.copy}>
                {reviveItem ? `${reviveItem.item.name} is in your inventory. Use it to continue this battle, or accept a 5% path setback.` : "No Revive Scroll found. You will lose 5% progress on this path."}
              </Text>
              <View style={styles.modeRow}>
                {reviveItem ? (
                  <Pressable style={styles.primaryButton} onPress={() => onUseItem(reviveItem)}>
                    <Text style={styles.primaryText}>Use {reviveItem.item.name}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.secondaryButtonFlex} onPress={onDeclineRevive}>
                  <Text style={styles.secondaryText}>Accept 5% Setback</Text>
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
              <Text style={styles.selectedTitle}>{defeatTitle}</Text>
              <Text style={styles.copy}>{defeatBody}</Text>
              <Pressable style={styles.primaryButton} onPress={onReturnToStart}>
                <Text style={styles.primaryText}>{defeatActionLabel}</Text>
              </Pressable>
            </View>
          ) : null}
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

function CombatIndicatorStackOverlay({ indicators }: { indicators: CombatIndicator[] }) {
  return (
    <View style={styles.stageIndicatorStack} pointerEvents="none">
      {indicators.map((indicator, index) => (
        <Text key={indicator.id} style={[styles.stageIndicatorText, { color: indicator.color, top: -20 - index * 20 } as object]}>
          {indicator.text}
        </Text>
      ))}
    </View>
  );
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

function getPercent(value: number, max: number) {
  return Math.max(0, Math.min(100, (Number(value) / Math.max(1, Number(max) || 1)) * 100));
}

const styles = StyleSheet.create({
  eventScreen: {
    margin: 8,
    padding: 8,
    gap: 8,
  },
  battleScreenFrame: {
    overflow: "hidden",
  },
  battleBackdrop: {
    gap: 8,
    padding: 8,
    paddingTop: 8,
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
    gap: 8,
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
    gap: 8,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  stageLayer: {
    position: "relative",
    borderRadius: 14,
    overflow: "visible",
  },
  stageImageViewport: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.24)",
    backgroundColor: "rgba(2,5,5,0.86)",
  },
  stageImage: {
    width: "100%",
    height: "100%",
  },
  emptyStageImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  enemyIntentBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 6,
    maxWidth: 164,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,180,170,0.24)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  stageHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 10,
  },
  combatantSurface: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  stagedPlayer: {
    borderColor: colors.blue,
    backgroundColor: "rgba(5,31,52,0.76)",
    zIndex: 4,
  },
  stagedPlayerActive: {
    borderColor: colors.gold,
    shadowColor: colors.blue,
    shadowOpacity: 0.72,
    shadowRadius: 18,
  },
  stagedCompanion: {
    borderColor: "rgba(66, 215, 125, 0.86)",
    backgroundColor: "rgba(5, 38, 23, 0.72)",
    shadowColor: "#42d77d",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    zIndex: 3,
  },
  fallbackEnemyPosition: {
    position: "absolute",
    right: "8%",
    top: "12%",
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
  stagedCombatant: {
    position: "absolute",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,180,170,0.58)",
    backgroundColor: "rgba(12,5,5,0.72)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff5c5c",
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  stagedCombatantSelected: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.65,
    shadowRadius: 18,
  },
  stagedEnemyActive: {
    borderColor: "#ffb4aa",
    shadowColor: "#ff5c5c",
    shadowOpacity: 0.78,
    shadowRadius: 20,
  },
  defeatedCombatant: {
    opacity: 0.42,
  },
  stagedCombatantImage: {
    width: "76%",
    height: "76%",
    borderRadius: 999,
    zIndex: 4,
  },
  stagedCombatantFallback: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 20,
    zIndex: 4,
  },
  stageIndicatorStack: {
    position: "absolute",
    left: "50%",
    top: 0,
    alignItems: "center",
  },
  stageIndicatorText: {
    position: "absolute",
    minWidth: 96,
    marginLeft: -48,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  battleUtilityRow: {
    flexDirection: "row",
    gap: 7,
  },
  inventoryBattleButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 23, 34, 0.58)",
  },
  fleeBattleButton: {
    flex: 1,
    minHeight: 34,
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
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.22)",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  battleLogTitle: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  battleLogLine: {
    color: colors.text,
    lineHeight: 16,
    fontSize: 11,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingTop: 6,
  },
});
