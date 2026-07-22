import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Hand } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { AbilityDefinition, CharacterResources } from "../../services/abilityService";
import { CharacterWithDetails } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { InventoryItem, ItemDefinition, isOffensiveBattleItem, isReviveBattleItem, resolveInventoryImageUri } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { BattleEventCombatant, MarkerBattleCombatant } from "../../services/battlefieldService";
import { resolveGameAssetUri } from "../../utils/assetResolver";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { BattleActionCard, CircularResourceArcs, CombatEffectBadge, CombatPortraitFrame, type CombatIndicator } from "./BattleDisplay";
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
  abilityCooldowns?: Record<string, number>;
  weapon: ItemDefinition | null;
  battleItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  battleTurnPhase: BattleTurnPhase;
  combatIndicators: CombatIndicator[];
  revivePromptOpen: boolean;
  result: "victory" | "defeat" | "flee" | null;
  previewMode?: boolean;
  defeatTitle?: string;
  defeatBody?: string;
  defeatActionLabel?: string;
  fleeTitle?: string;
  fleeBody?: string;
  fleeActionLabel?: string;
  onAction: (ability: AbilityDefinition) => void;
  onSelectOpponent?: (opponentKey: string) => void;
  onWeaponAction: (weapon: ItemDefinition) => void;
  onFlee: () => void;
  onUseItem: (item: InventoryItem) => void;
  onToggleInventory: () => void;
  onDeclineRevive: () => void;
  onReturnToStart: () => void;
  onCompleteFlee: () => void;
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
  abilityCooldowns = {},
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
  fleeTitle = "Escaped",
  fleeBody = "You escaped the battle. No rewards were granted.",
  fleeActionLabel = "Continue Journey",
  onAction,
  onSelectOpponent,
  onFlee,
  onUseItem,
  onToggleInventory,
  onDeclineRevive,
  onReturnToStart,
  onCompleteFlee,
  onComplete,
  onExitPreview,
}: BattleEventScreenProps) {
  const [enemyImageFailed, setEnemyImageFailed] = useState(false);
  const [playerImageFailed, setPlayerImageFailed] = useState(false);
  const [targetDetailsOpen, setTargetDetailsOpen] = useState(false);
  const [teamDetailsOpen, setTeamDetailsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const enemyImageUri = resolveEnemyImageUri(activeEnemy?.image_url ?? event.enemy_image_url);
  const backgroundUri = resolveSceneImageUri(event.background_image_url);
  const enemyMaxHp = Number(activeEnemy?.health ?? event.enemy_hp) || 30;
  const rewardXp = Number(event.reward_xp ?? 0) + Number(activeEnemy?.xp_reward ?? 0);
  const rewardGold = Number(event.reward_gold ?? 0) + Number(activeEnemy?.gold_reward ?? 0);
  const battlePhase = result === "victory" ? "Victory" : result === "defeat" ? "Defeat" : result === "flee" ? "Escaped" : revivePromptOpen ? "Revive Choice" : battleTurnPhase === "enemy" ? "Enemy Turn" : battleTurnPhase === "rolling" ? "Rolling" : "Your Turn";
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
  const selectedOpponent = visibleOpponents.find((opponent) => opponent.key === selectedOpponentKey) ?? null;
  const targetDetailsEnemy = selectedOpponent?.enemy ?? activeEnemy;
  const targetDetailsHp = selectedOpponent ? selectedOpponent.hp : enemyHp;
  const targetDetailsStamina = selectedOpponent ? selectedOpponent.stamina : enemyStamina;
  const targetDetailsMana = selectedOpponent ? selectedOpponent.magika : enemyMana;
  const targetDetailsImageUri = resolveEnemyImageUri(targetDetailsEnemy?.image_url ?? (!selectedOpponent ? event.enemy_image_url : null));
  const targetDetailsName = targetDetailsEnemy?.name || selectedOpponent?.combatant?.label || enemyName;
  const targetDetailsType = targetDetailsEnemy?.type || "Enemy";
  const targetDetailsKind = targetDetailsEnemy && "can_battle" in targetDetailsEnemy ? "NPC Combatant" : "Enemy";
  const targetCount = Math.max(visibleOpponents.length, activeEnemy ? 1 : 0);
  const activeSheet = targetDetailsOpen ? "target" : teamDetailsOpen ? "team" : inventoryOpen ? "items" : logOpen ? "log" : null;

  function showTargetDetails() {
    setTargetDetailsOpen((open) => !open);
    setTeamDetailsOpen(false);
    setLogOpen(false);
    if (inventoryOpen) {
      onToggleInventory();
    }
  }

  function showTeamDetails() {
    setTeamDetailsOpen((open) => !open);
    setTargetDetailsOpen(false);
    setLogOpen(false);
    if (inventoryOpen) {
      onToggleInventory();
    }
  }

  function showInventoryDetails() {
    setTargetDetailsOpen(false);
    setTeamDetailsOpen(false);
    setLogOpen(false);
    onToggleInventory();
  }

  function showBattleLog() {
    setLogOpen((open) => !open);
    setTargetDetailsOpen(false);
    setTeamDetailsOpen(false);
    if (inventoryOpen) {
      onToggleInventory();
    }
  }

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
          <View style={styles.battleArena}>
            <View style={styles.stageLayer}>
              <View style={styles.sceneTopOverlay}>
                <View style={styles.sceneTitlePlate}>
                  <Text style={styles.sceneTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.sceneSubtitle} numberOfLines={1}>{event.battle_intro_text || "Battle encounter"}</Text>
                </View>
                <View style={styles.phasePill}>
                  <Text style={styles.phaseText}>{battlePhase}</Text>
                </View>
              </View>
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
                        const opponentIndicators = combatIndicators.filter((indicator) => {
                          if (indicator.target !== "enemy") {
                            return false;
                          }
                          if (indicator.targetKey) {
                            return indicator.targetKey === opponent.key;
                          }
                          return opponent.key === selectedOpponentKey;
                        });
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
                          {isSelected ? (
                            <View style={styles.targetReticle} pointerEvents="none">
                              <Text style={styles.targetReticleText}>Target</Text>
                            </View>
                          ) : null}
                          <CombatIndicatorStackOverlay indicators={opponentIndicators} />
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
            <View style={styles.battleCommandRail}>
              <BattleCommandButton label="Target" value={targetDetailsName} active={activeSheet === "target"} onPress={showTargetDetails} />
              <BattleCommandButton label="Allies" value={`${1 + companions.filter((companion) => companion.hp > 0).length}`} active={activeSheet === "team"} onPress={showTeamDetails} />
              <BattleCommandButton label="Items" value={`${battleItems.length}`} active={activeSheet === "items"} onPress={showInventoryDetails} />
              <BattleCommandButton label="Log" value={`${battleLog.length}`} active={activeSheet === "log"} onPress={showBattleLog} />
            </View>
            <Text style={styles.stageHint}>{playerTurnActive ? "Tap a foe to select. Use an ability below." : enemyTurnActive ? "Enemy action resolving..." : "Battle is resolving."}</Text>
          </View>
          {activeSheet === "target" ? (
            <BattleTargetDetailsCard
              onClose={showTargetDetails}
              name={targetDetailsName}
              type={targetDetailsType}
              kind={targetDetailsKind}
              imageUri={targetDetailsImageUri}
              hp={targetDetailsHp}
              maxHp={Number(targetDetailsEnemy?.health ?? event.enemy_hp) || enemyMaxHp}
              stamina={targetDetailsStamina}
              maxStamina={Number(targetDetailsEnemy?.stamina ?? 0) || 0}
              mana={targetDetailsMana}
              maxMana={Number(targetDetailsEnemy?.magika ?? 0) || 0}
              defense={Number(targetDetailsEnemy?.defense ?? 10) || 10}
              armor={Number(targetDetailsEnemy?.armor_rating ?? 0) || 0}
              attackBonus={Number(targetDetailsEnemy?.attack_bonus ?? 0) || 0}
              abilities={targetDetailsEnemy?.abilities?.map((entry) => entry.ability?.name).filter((name): name is string => Boolean(name)) ?? []}
            />
          ) : null}
          {activeSheet === "team" ? (
            <BattleTeamDetailsCard
              onClose={showTeamDetails}
              characterName={character.name}
              characterImageUri={character.portrait_url}
              playerHp={playerHp}
              maxHp={resources.maxHp}
              stamina={stamina}
              maxStamina={resources.maxStamina}
              mana={magicka}
              maxMana={resources.maxMagicka}
              companions={companions}
            />
          ) : null}
          {activeSheet === "items" ? (
            <BattleInventorySheet battleItems={battleItems} onUseItem={onUseItem} />
          ) : null}
          {activeSheet === "log" ? (
            <BattleLogSheet battleLog={battleLog} />
          ) : null}
          <View style={styles.abilityGrid}>
            {equippedAbilities.map((ability, index) => {
              const resourcePool = ability?.resource === "stamina" ? stamina : ability?.resource === "magicka" ? magicka : ability?.resource === "health" ? playerHp : Number.POSITIVE_INFINITY;
              const hasResource = ability ? resourcePool >= ability.cost : false;
              const cooldownTurns = ability ? abilityCooldowns[ability.adminAbility?.id ?? ability.key] ?? 0 : 0;
              const targetCue = getAbilityTargetCue(ability, targetDetailsName, targetCount);
              return (
                <BattleActionCard
                  key={`ability-${index}`}
                  ability={ability}
                  slotNumber={index + 1}
                  disabled={!ability || !hasResource || cooldownTurns > 0 || Boolean(result) || !playerTurnActive}
                  cooldownTurns={cooldownTurns}
                  targetLabel={targetCue?.label ?? null}
                  targetTone={targetCue?.tone ?? "enemy"}
                  unavailableReason={ability && cooldownTurns > 0 ? `${cooldownTurns} turn cooldown` : ability && !hasResource ? "Not enough resource" : null}
                  onPress={() => ability ? onAction(ability) : undefined}
                />
              );
            })}
          </View>
          <View style={styles.battleUtilityRow}>
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
          {result === "flee" ? (
            <View style={styles.battleResultPanel}>
              <Text style={styles.selectedTitle}>{fleeTitle}</Text>
              <Text style={styles.copy}>{fleeBody}</Text>
              <Pressable style={styles.primaryButton} onPress={onCompleteFlee}>
                <Text style={styles.primaryText}>{fleeActionLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Frame>
    </Screen>
  );
}

function resolveSceneImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "scene");
}

function CombatIndicatorStackOverlay({ indicators }: { indicators: CombatIndicator[] }) {
  return (
    <View style={styles.stageIndicatorStack} pointerEvents="none">
      {indicators.map((indicator, index) => (
        <View key={indicator.id} style={[styles.stageIndicatorGroup, { top: -58 - index * 54 } as object]}>
          <CombatEffectBadge indicator={indicator} compact />
          <Text style={[styles.stageIndicatorText, { color: indicator.color } as object]}>
            {indicator.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BattleCommandButton({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.commandButton, active && styles.commandButtonActive]} onPress={onPress}>
      <Text style={[styles.commandLabel, active && styles.commandLabelActive]} numberOfLines={1}>{label}</Text>
      <Text style={styles.commandValue} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

function BattleTargetDetailsCard({
  onClose,
  name,
  type,
  kind,
  imageUri,
  hp,
  maxHp,
  stamina,
  maxStamina,
  mana,
  maxMana,
  defense,
  armor,
  attackBonus,
  abilities,
}: {
  onClose: () => void;
  name: string;
  type: string;
  kind: string;
  imageUri: string | null;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  defense: number;
  armor: number;
  attackBonus: number;
  abilities: string[];
}) {
  return (
    <View style={styles.detailSheet}>
      <View style={styles.targetDetailsHeader}>
        <View style={styles.targetDetailsHeaderText}>
          <Text style={styles.targetDetailsEyebrow}>Selected Target</Text>
          <Text style={styles.targetDetailsName} numberOfLines={1}>{name}</Text>
        </View>
        <Pressable style={styles.sheetCloseButton} onPress={onClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.targetDetailsBody}>
        <View style={styles.targetDetailsPortraitWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.targetDetailsPortrait} resizeMode="cover" />
          ) : (
            <Text style={styles.targetDetailsFallback}>{name.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.targetDetailsContent}>
          <View style={styles.targetDetailsMetaRow}>
            <Text style={styles.targetDetailsMeta}>{kind}</Text>
            <Text style={styles.targetDetailsMeta}>{type}</Text>
          </View>
          <View style={styles.targetResourceStack}>
            <CompactTargetMeter label="HP" value={hp} max={maxHp} color={colors.red} />
            {maxStamina > 0 ? <CompactTargetMeter label="Stamina" value={stamina} max={maxStamina} color={colors.gold} /> : null}
            {maxMana > 0 ? <CompactTargetMeter label="Mana" value={mana} max={maxMana} color={colors.blue} /> : null}
          </View>
          <View style={styles.targetStatGrid}>
            <TargetStat label="Defense" value={defense} />
            <TargetStat label="Armor" value={armor} />
            <TargetStat label="Attack" value={`+${attackBonus}`} />
          </View>
          <View style={styles.targetAbilityList}>
            <Text style={styles.targetAbilityTitle}>Known Abilities</Text>
            <Text style={styles.targetAbilityText}>{abilities.length > 0 ? abilities.slice(0, 4).join(" / ") : "No special abilities known."}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BattleTeamDetailsCard({
  onClose,
  characterName,
  characterImageUri,
  playerHp,
  maxHp,
  stamina,
  maxStamina,
  mana,
  maxMana,
  companions,
}: {
  onClose: () => void;
  characterName: string;
  characterImageUri: string | null;
  playerHp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
  companions: BattleCompanionState[];
}) {
  const livingCompanions = companions.filter((companion) => companion.hp > 0);
  const teamCount = 1 + livingCompanions.length;

  return (
    <View style={styles.detailSheet}>
      <View style={styles.targetDetailsHeader}>
        <View style={styles.targetDetailsHeaderText}>
          <Text style={styles.teamDetailsEyebrow}>Your Side</Text>
          <Text style={styles.targetDetailsName} numberOfLines={1}>{teamCount === 1 ? characterName : `${teamCount} Allies Ready`}</Text>
        </View>
        <Pressable style={styles.sheetCloseButton} onPress={onClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.teamDetailsBody}>
        <TeamMemberRow
          name={characterName}
          role="Player"
          imageUri={characterImageUri}
          hp={playerHp}
          maxHp={maxHp}
          stamina={stamina}
          maxStamina={maxStamina}
          mana={mana}
          maxMana={maxMana}
        />
        {livingCompanions.length > 0 ? livingCompanions.map((companion) => (
          <TeamMemberRow
            key={`team-${companion.key}`}
            name={companion.ally.name || companion.combatant.label || "Companion"}
            role={companion.summoned ? "Summoned Ally" : "Companion"}
            imageUri={resolveEnemyImageUri(companion.ally.image_url)}
            hp={companion.hp}
            maxHp={Number(companion.ally.health ?? 30) || 30}
            stamina={companion.stamina}
            maxStamina={Number(companion.ally.stamina ?? 0) || 0}
            mana={companion.magika}
            maxMana={Number(companion.ally.magika ?? 0) || 0}
          />
        )) : (
          <Text style={styles.teamEmptyText}>No companions are fighting beside you.</Text>
        )}
      </View>
    </View>
  );
}

function BattleInventorySheet({ battleItems, onUseItem }: { battleItems: InventoryItem[]; onUseItem: (item: InventoryItem) => void }) {
  return (
    <View style={styles.detailSheet}>
      <View style={styles.targetDetailsHeader}>
        <View style={styles.targetDetailsHeaderText}>
          <Text style={styles.targetDetailsEyebrow}>Inventory</Text>
          <Text style={styles.targetDetailsName} numberOfLines={1}>{battleItems.length === 0 ? "No Battle Items" : `${battleItems.length} Usable Items`}</Text>
        </View>
      </View>
      <ScrollView style={styles.battleInventoryScroll} contentContainerStyle={styles.battleInventory} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {battleItems.length === 0 ? <Text style={styles.copy}>No usable battle items.</Text> : null}
        {battleItems.map((entry) => (
          <BattleInventoryItem key={entry.id} entry={entry} onUse={() => onUseItem(entry)} />
        ))}
      </ScrollView>
    </View>
  );
}

function BattleInventoryItem({ entry, onUse }: { entry: InventoryItem; onUse: () => void }) {
  const imageUri = resolveInventoryImageUri(entry.item.image_path);
  const isOffensive = isOffensiveBattleItem(entry.item);
  const restoreValue = entry.item.restore_percent ? `${entry.item.restore_percent}%` : `${entry.item.restore_amount || 0}`;
  const target = formatResourceName(entry.item.potion_target ?? "health");
  const damage = Number(entry.item.damage_amount ?? 0) + Number(entry.item.elemental_damage_amount ?? 0);
  const effect = entry.item.on_hit_effect ? ` / ${entry.item.on_hit_effect.replace(" enemy", "")}` : "";

  return (
    <Pressable style={styles.battleItemCard} onPress={onUse}>
      <View style={styles.battleItemImageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.battleItemImage} resizeMode="cover" />
        ) : (
          <Text style={styles.battleItemFallback}>{entry.item.name.slice(0, 2).toUpperCase()}</Text>
        )}
        <View style={styles.battleItemQuantity}>
          <Text style={styles.battleItemQuantityText}>x{entry.quantity}</Text>
        </View>
      </View>
      <View style={styles.battleItemContent}>
        <Text style={styles.battleItemName} numberOfLines={1}>{entry.item.name}</Text>
        <Text style={styles.battleItemMeta} numberOfLines={1}>
          {isOffensive ? `${entry.item.type} / ${damage > 0 ? `${damage} damage` : "effect"}${effect}` : `${entry.item.type} / restores ${restoreValue} ${target}`}
        </Text>
        {entry.item.description ? <Text style={styles.battleItemDescription} numberOfLines={2}>{entry.item.description}</Text> : null}
      </View>
      <View style={styles.battleItemUsePill}>
        <Hand size={14} color="#120e08" strokeWidth={2.6} />
        <Text style={styles.battleItemUseText}>Use</Text>
      </View>
    </Pressable>
  );
}

function BattleLogSheet({ battleLog }: { battleLog: string[] }) {
  return (
    <View style={styles.detailSheet}>
      <View style={styles.targetDetailsHeader}>
        <View style={styles.targetDetailsHeaderText}>
          <Text style={styles.targetDetailsEyebrow}>Battle Log</Text>
          <Text style={styles.targetDetailsName} numberOfLines={1}>Recent Turns</Text>
        </View>
      </View>
      <View style={styles.battleLogPanel}>
        {battleLog.length === 0 ? <Text style={styles.copy}>No battle actions yet.</Text> : null}
        {battleLog.slice(0, 6).map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.battleLogLine}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

function TeamMemberRow({ name, role, imageUri, hp, maxHp, stamina, maxStamina, mana, maxMana }: { name: string; role: string; imageUri: string | null; hp: number; maxHp: number; stamina: number; maxStamina: number; mana: number; maxMana: number }) {
  return (
    <View style={styles.teamMemberRow}>
      <View style={styles.teamPortraitWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.teamPortrait} resizeMode="cover" />
        ) : (
          <Text style={styles.teamFallback}>{name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.teamMemberContent}>
        <View style={styles.teamMemberHeader}>
          <Text style={styles.teamMemberName} numberOfLines={1}>{name}</Text>
          <Text style={styles.teamMemberRole} numberOfLines={1}>{role}</Text>
        </View>
        <View style={styles.teamMeterGrid}>
          <CompactTargetMeter label="HP" value={hp} max={maxHp} color={colors.red} />
          {maxStamina > 0 ? <CompactTargetMeter label="Stamina" value={stamina} max={maxStamina} color={colors.gold} /> : null}
          {maxMana > 0 ? <CompactTargetMeter label="Mana" value={mana} max={maxMana} color={colors.blue} /> : null}
        </View>
      </View>
    </View>
  );
}

function CompactTargetMeter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={styles.compactTargetMeter}>
      <View style={styles.compactTargetMeterHeader}>
        <Text style={styles.compactTargetMeterLabel}>{label}</Text>
        <Text style={styles.compactTargetMeterValue}>{Math.max(0, value)} / {Math.max(1, max)}</Text>
      </View>
      <View style={styles.compactTargetTrack}>
        <View style={[styles.compactTargetFill, { width: `${getPercent(value, max)}%`, backgroundColor: color } as object]} />
      </View>
    </View>
  );
}

function TargetStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.targetStatPill}>
      <Text style={styles.targetStatLabel}>{label}</Text>
      <Text style={styles.targetStatValue}>{value}</Text>
    </View>
  );
}

function getAbilityTargetCue(ability: AbilityDefinition | null, selectedTargetName: string, targetCount: number): { label: string; tone: "enemy" | "self" | "area" | "ally" | "summon" } | null {
  if (!ability) {
    return null;
  }

  const type = ability.adminAbility?.type;
  const mode = ability.adminAbility?.target_mode ?? "single_enemy";

  if (type === "summon" || type === "conjure") {
    return { label: "Summons ally", tone: "summon" };
  }
  if (type === "heal" && mode === "all_allies") {
    return { label: "Heals allies", tone: "ally" };
  }
  if (type === "heal") {
    return { label: "Heals self", tone: "self" };
  }
  if (mode === "self") {
    return { label: "Targets self", tone: "self" };
  }
  if (mode === "all_allies") {
    return { label: "Affects allies", tone: "ally" };
  }
  if (mode === "all_enemies") {
    return { label: targetCount > 1 ? `Hits ${targetCount} foes` : "Hits all foes", tone: "area" };
  }
  if (mode === "random_enemy") {
    return { label: "Random foe", tone: "area" };
  }

  return { label: `Hits ${selectedTargetName}`, tone: "enemy" };
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
    margin: 0,
    padding: 0,
    gap: 0,
  },
  battleScreenFrame: {
    overflow: "hidden",
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "rgba(1,6,6,0.96)",
  },
  battleBackdrop: {
    gap: 7,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 28,
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
    gap: 7,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  stageLayer: {
    position: "relative",
    borderRadius: 14,
    overflow: "visible",
  },
  sceneTopOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    zIndex: 12,
    elevation: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  sceneTitlePlate: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.28)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  sceneTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 15,
    textTransform: "uppercase",
  },
  sceneSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  stageImageViewport: {
    position: "relative",
    width: "100%",
    aspectRatio: 0.78,
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
    top: 68,
    zIndex: 6,
    maxWidth: 148,
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
  battleCommandRail: {
    flexDirection: "row",
    gap: 6,
  },
  commandButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.2)",
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  commandButtonActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(232,181,94,0.12)",
  },
  commandLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  commandLabelActive: {
    color: colors.gold,
  },
  commandValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  detailSheet: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(54,171,224,0.22)",
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  targetDetailsHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  targetDetailsHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  targetDetailsEyebrow: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  teamDetailsEyebrow: {
    color: "#42d77d",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  targetDetailsName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  sheetCloseButton: {
    minWidth: 66,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 23, 34, 0.58)",
  },
  sheetCloseText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  targetDetailsBody: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  targetDetailsPortraitWrap: {
    width: 86,
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(4,7,8,0.72)",
  },
  targetDetailsPortrait: {
    width: "100%",
    height: "100%",
  },
  targetDetailsFallback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    fontWeight: "900",
  },
  targetDetailsContent: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  targetDetailsMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  targetDetailsMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  targetResourceStack: {
    gap: 5,
  },
  compactTargetMeter: {
    gap: 3,
  },
  compactTargetMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  compactTargetMeterLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  compactTargetMeterValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  compactTargetTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  compactTargetFill: {
    height: "100%",
    borderRadius: 999,
  },
  targetStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  targetStatPill: {
    minWidth: 66,
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  targetStatLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  targetStatValue: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
  },
  targetAbilityList: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 6,
  },
  targetAbilityTitle: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  targetAbilityText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  teamDetailsBody: {
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  teamMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  teamPortraitWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(66,215,125,0.48)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(3,18,12,0.72)",
  },
  teamPortrait: {
    width: "100%",
    height: "100%",
  },
  teamFallback: {
    color: "#42d77d",
    fontSize: 15,
    fontWeight: "900",
  },
  teamMemberContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  teamMemberHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamMemberName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  teamMemberRole: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  teamMeterGrid: {
    gap: 5,
  },
  teamEmptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
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
  targetReticle: {
    position: "absolute",
    left: "50%",
    bottom: -18,
    minWidth: 64,
    marginLeft: -32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    zIndex: 8,
    elevation: 8,
  },
  targetReticleText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  stageIndicatorStack: {
    position: "absolute",
    left: "50%",
    top: 0,
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  stageIndicatorGroup: {
    position: "absolute",
    minWidth: 96,
    marginLeft: -48,
    alignItems: "center",
  },
  stageIndicatorText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  battleUtilityRow: {
    flexDirection: "row",
    gap: 7,
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
  battleInventoryScroll: {
    maxHeight: 252,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  battleInventory: {
    gap: 8,
    padding: 8,
  },
  battleItemCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  battleItemImageWrap: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.36)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 12, 12, 0.86)",
  },
  battleItemImage: {
    width: "100%",
    height: "100%",
  },
  battleItemFallback: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
  },
  battleItemQuantity: {
    position: "absolute",
    right: 3,
    bottom: 3,
    minWidth: 24,
    minHeight: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.42)",
  },
  battleItemQuantityText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 10,
  },
  battleItemContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  battleItemName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  battleItemMeta: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
  },
  battleItemDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  battleItemUsePill: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.gold,
  },
  battleItemUseText: {
    color: "#120e08",
    fontSize: 11,
    fontWeight: "900",
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
  battleLogLine: {
    color: colors.text,
    lineHeight: 16,
    fontSize: 11,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingTop: 6,
  },
});
