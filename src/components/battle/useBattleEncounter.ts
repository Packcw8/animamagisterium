import { Dispatch, SetStateAction, useState } from "react";
import { AbilityDefinition, CharacterResources, clampHealth, getCharacterResources } from "../../services/abilityService";
import { CharacterWithDetails, updateCharacterHealth } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, getEnemyLoadout, getNpcLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { BattleEventCombatant, MarkerBattleCombatant, getBattleEventCombatants, getMarkerBattleCombatants } from "../../services/battlefieldService";
import { InventoryItem, ItemDefinition, consumeInventoryItem, getInventoryResourceBonuses, isReviveBattleItem } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { chooseWeightedEnemyAbility, getD20StatBonus, rollD20Attack } from "../../utils/combatMath";
import { type CombatIndicator } from "./BattleDisplay";

type PreviewMode = "story" | "battle" | null;

type StartBattleOptions = {
  preview?: boolean;
  currentHealth: number;
  combatResources: CharacterResources;
  syntheticOpponent?: EnemyWithLoadout | NpcWithLoadout | null;
  syntheticOpponentCombatant?: BattleEventCombatant | MarkerBattleCombatant | null;
  syntheticLayout?: Array<BattleEventCombatant | MarkerBattleCombatant>;
  skipStagedLayout?: boolean;
  suppressCompanions?: boolean;
  setActiveEvent: Dispatch<SetStateAction<MapEvent | null>>;
  setAdminPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  setAdminMessage: Dispatch<SetStateAction<string | null>>;
};

type StartBattleResult = {
  ok: boolean;
  message?: string;
};

type BattleActionContext = {
  previewMode: boolean;
  battleMode?: "normal" | "arena";
  equippedItems: Record<string, ItemDefinition | null>;
  inventoryItems: InventoryItem[];
  closePreview: () => void;
  resetRouteAfterDefeat: () => Promise<void>;
  reduceRouteProgress: (percent: number) => Promise<void>;
  setGpsMessage: (message: string) => void;
  loadInventory: () => Promise<void>;
};

export type BattleOpponentState = {
  key: string;
  combatant: BattleEventCombatant | MarkerBattleCombatant | null;
  enemy: EnemyWithLoadout | NpcWithLoadout | null;
  hp: number;
  stamina: number;
  magika: number;
};

export type BattleCompanionState = {
  key: string;
  combatant: BattleEventCombatant | MarkerBattleCombatant;
  ally: EnemyWithLoadout | NpcWithLoadout;
  hp: number;
  stamina: number;
  magika: number;
};

export type BattleTurnPhase = "rolling" | "player" | "enemy" | "finished";

export function useBattleEncounter(character: CharacterWithDetails, onCharacterUpdated: (character: CharacterWithDetails) => void) {
  const [activeBattle, setActiveBattle] = useState<MapEvent | null>(null);
  const [battlePlayerHp, setBattlePlayerHp] = useState(100);
  const [battleStamina, setBattleStamina] = useState(0);
  const [battleMagicka, setBattleMagicka] = useState(0);
  const [battleEnemyHp, setBattleEnemyHp] = useState(0);
  const [battleEnemyStamina, setBattleEnemyStamina] = useState(0);
  const [battleEnemyMagika, setBattleEnemyMagika] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleFinished, setBattleFinished] = useState<"victory" | "defeat" | null>(null);
  const [battleTurnPhase, setBattleTurnPhase] = useState<BattleTurnPhase>("player");
  const [openingEnemyTurnQueued, setOpeningEnemyTurnQueued] = useState(false);
  const [revivePromptOpen, setRevivePromptOpen] = useState(false);
  const [activeEnemy, setActiveEnemy] = useState<EnemyWithLoadout | NpcWithLoadout | null>(null);
  const [battleOpponents, setBattleOpponents] = useState<BattleOpponentState[]>([]);
  const [battleCompanions, setBattleCompanions] = useState<BattleCompanionState[]>([]);
  const [battleLayoutCombatants, setBattleLayoutCombatants] = useState<Array<BattleEventCombatant | MarkerBattleCombatant>>([]);
  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string | null>(null);
  const [combatIndicators, setCombatIndicators] = useState<CombatIndicator[]>([]);
  const [combatResources, setCombatResources] = useState<CharacterResources>(() => getCharacterResources(character));
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [battleInventoryOpen, setBattleInventoryOpen] = useState(false);

  function resetBattleState() {
    setActiveBattle(null);
    setActiveEnemy(null);
    setBattleOpponents([]);
    setBattleCompanions([]);
    setBattleLayoutCombatants([]);
    setSelectedOpponentKey(null);
    setBattleFinished(null);
    setBattleTurnPhase("player");
    setOpeningEnemyTurnQueued(false);
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setBattleLog([]);
    setCombatIndicators([]);
  }

  async function startBattle(event: MapEvent, options: StartBattleOptions): Promise<StartBattleResult> {
    const { preview = false, currentHealth, combatResources: nextCombatResources, syntheticOpponent = null, syntheticOpponentCombatant = null, syntheticLayout = null, skipStagedLayout = false, suppressCompanions = false, setActiveEvent, setAdminPreviewMode, setAdminMessage } = options;

    try {
      const enemy = event.enemy_id ? await getEnemyLoadout(event.enemy_id) : null;
      const npcEnemy = !enemy && event.npc_id ? await getNpcLoadout(event.npc_id) : null;
      const opponent = syntheticOpponent ?? enemy ?? npcEnemy;

      if (event.enemy_id && !enemy) {
        const message = "Battle enemy could not be loaded from Enemy Admin. Check that the selected enemy is active and readable by players.";
        setAdminMessage(message);
        setBattleLog([message]);
        return { ok: false, message };
      }

      if (event.npc_id && !npcEnemy) {
        const message = "Battle NPC could not be loaded from NPC Admin. Check that the selected NPC is active, battle-enabled, and readable by players.";
        setAdminMessage(message);
        setBattleLog([message]);
        return { ok: false, message };
      }

      const stagedLayout = syntheticLayout ?? (skipStagedLayout ? [] : await loadStagedLayout(event));
      const stagedOpponents = await loadStagedOpponents(event, stagedLayout);
      const stagedCompanions = suppressCompanions ? [] : await loadStagedCompanions(event, stagedLayout);
      const fallbackOpponent = stagedOpponents.length === 0
        ? [{
          key: "primary",
          combatant: syntheticOpponentCombatant,
          enemy: opponent,
          hp: Number(opponent?.health ?? event.enemy_hp) || 30,
          stamina: Number(opponent?.stamina ?? 0) || 0,
          magika: Number(opponent?.magika ?? 0) || 0,
        }]
        : stagedOpponents;
      const firstOpponent = fallbackOpponent[0];
      const selectedEnemy = firstOpponent?.enemy ?? opponent;
      const enemyImage = resolveEnemyImageUri(selectedEnemy?.image_url ?? event.enemy_image_url);
      const playerInitiative = rollInitiative(character.attributes?.agility ?? 0);
      const companionInitiatives = stagedCompanions
        .map((entry) => ({
          name: entry.ally.name || entry.combatant.label || "Companion",
          initiative: rollInitiative(Number(entry.ally.agility ?? 0)),
        }))
        .sort((a, b) => b.initiative.total - a.initiative.total);
      const leadAllyInitiative = [playerInitiative, ...companionInitiatives.map((entry) => entry.initiative)]
        .sort((a, b) => b.total - a.total)[0] ?? playerInitiative;
      const enemyInitiatives = fallbackOpponent
        .filter((entry) => entry.enemy)
        .map((entry) => ({
          name: entry.enemy?.name || "Enemy",
          initiative: rollInitiative(Number(entry.enemy?.agility ?? 0)),
        }))
        .sort((a, b) => b.initiative.total - a.initiative.total);
      const leadEnemyInitiative = enemyInitiatives[0]?.initiative ?? rollInitiative(0);
      const enemyStarts = leadEnemyInitiative.total > leadAllyInitiative.total;
      setActiveEvent(null);
      setActiveBattle(event);
      setAdminPreviewMode(preview ? "battle" : null);
      setActiveEnemy(selectedEnemy);
      setBattleLayoutCombatants(stagedLayout);
      setBattleOpponents(fallbackOpponent);
      setBattleCompanions(stagedCompanions);
      setSelectedOpponentKey(firstOpponent?.key ?? null);
      setCombatIndicators([]);
      setBattlePlayerHp(currentHealth);
      setBattleStamina(nextCombatResources.maxStamina);
      setBattleMagicka(nextCombatResources.maxMagicka);
      setBattleEnemyHp(firstOpponent?.hp ?? (Number(opponent?.health ?? event.enemy_hp) || 30));
      setBattleEnemyStamina(firstOpponent?.stamina ?? (Number(opponent?.stamina ?? 0) || 0));
      setBattleEnemyMagika(firstOpponent?.magika ?? (Number(opponent?.magika ?? 0) || 0));
      setBattleFinished(null);
      setBattleTurnPhase(enemyStarts ? "enemy" : "player");
      setOpeningEnemyTurnQueued(enemyStarts);
      setRevivePromptOpen(false);
      setBattleInventoryOpen(false);
      setBattleLog([
        `Initiative: you rolled ${playerInitiative.roll} + ${playerInitiative.bonus} = ${playerInitiative.total}. Fastest enemy: ${enemyInitiatives[0]?.name || "Enemy"} ${leadEnemyInitiative.roll} + ${leadEnemyInitiative.bonus} = ${leadEnemyInitiative.total}.`,
        suppressCompanions ? "Arena rules: no party members or companions may join." : companionInitiatives.length > 0 ? `Companions joined: ${stagedCompanions.map((entry) => entry.ally.name || entry.combatant.label || "Ally").join(", ")}.` : "No companions joined this fight.",
        enemyStarts ? "The enemies act first." : "Your side acts first.",
        event.battle_intro_text || `${selectedEnemy?.name || event.enemy_name || "An enemy"} blocks the trail.`,
        stagedOpponents.length > 0
          ? `Loaded ${stagedOpponents.length} staged combatant${stagedOpponents.length === 1 ? "" : "s"} from Battlefield Layout.`
          : selectedEnemy?.id ? `Loaded ${selectedEnemy.abilities.length} abilities and ${selectedEnemy.drops.length} drop entries from Admin.` : "Using manual battle enemy data.",
        enemyImage ? "Enemy image ready." : "Enemy image missing. A placeholder will be shown.",
      ]);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load battle enemy data.";
      setAdminMessage(message);
      setBattleLog([message]);
      return { ok: false, message };
    }
  }

  async function loadStagedLayout(event: MapEvent) {
    try {
      const eventStaged = await getBattleEventCombatants(event.id);
      const markerStaged = eventStaged.length > 0 ? [] : await getMarkerBattleCombatants(event.id);
      return (eventStaged.length > 0 ? eventStaged : markerStaged).filter((combatant) => combatant.is_active);
    } catch {
      return [];
    }
  }

  async function loadStagedOpponents(event: MapEvent, staged: Array<BattleEventCombatant | MarkerBattleCombatant>): Promise<BattleOpponentState[]> {
    try {
      const activeStaged = staged.filter((combatant) => combatant.is_active && combatant.side === "enemy" && (combatant.enemy_id || combatant.npc_id));
      const loaded = await Promise.all(activeStaged.map(async (combatant) => {
        const enemy = combatant.enemy_id ? await getEnemyLoadout(combatant.enemy_id) : null;
        const npc = !enemy && combatant.npc_id ? await getNpcLoadout(combatant.npc_id) : null;
        const opponent = enemy ?? npc;

        if (!opponent) {
          return null;
        }

        return {
          key: combatant.id,
          combatant,
          enemy: opponent,
          hp: Number(opponent.health ?? event.enemy_hp) || 30,
          stamina: Number(opponent.stamina ?? 0) || 0,
          magika: Number(opponent.magika ?? 0) || 0,
        } satisfies BattleOpponentState;
      }));

      return loaded.filter(Boolean) as BattleOpponentState[];
    } catch {
      return [];
    }
  }

  async function loadStagedCompanions(event: MapEvent, staged: Array<BattleEventCombatant | MarkerBattleCombatant>): Promise<BattleCompanionState[]> {
    try {
      const activeStaged = staged.filter((combatant) => combatant.is_active && combatant.side === "companion" && (combatant.enemy_id || combatant.npc_id));
      const loaded = await Promise.all(activeStaged.map(async (combatant) => {
        const enemy = combatant.enemy_id ? await getEnemyLoadout(combatant.enemy_id) : null;
        const npc = !enemy && combatant.npc_id ? await getNpcLoadout(combatant.npc_id) : null;
        const ally = enemy ?? npc;

        if (!ally) {
          return null;
        }

        return {
          key: combatant.id,
          combatant,
          ally,
          hp: Number(ally.health ?? event.enemy_hp) || 30,
          stamina: Number(ally.stamina ?? 0) || 0,
          magika: Number(ally.magika ?? 0) || 0,
        } satisfies BattleCompanionState;
      }));

      return loaded.filter(Boolean) as BattleCompanionState[];
    } catch {
      return [];
    }
  }

  function selectBattleTarget(key: string) {
    const opponent = battleOpponents.find((entry) => entry.key === key);

    if (!opponent || opponent.hp <= 0 || battleFinished) {
      return;
    }

    setSelectedOpponentKey(key);
    setActiveEnemy(opponent.enemy);
    setBattleEnemyHp(opponent.hp);
    setBattleEnemyStamina(opponent.stamina);
    setBattleEnemyMagika(opponent.magika);
  }

  function updateSelectedOpponent(values: Partial<Pick<BattleOpponentState, "hp" | "stamina" | "magika">>) {
    const selectedKey = selectedOpponentKey;

    if (!selectedKey) {
      return;
    }

    setBattleOpponents((current) => current.map((opponent) => opponent.key === selectedKey ? { ...opponent, ...values } : opponent));
  }

  function updateOpponent(key: string, values: Partial<Pick<BattleOpponentState, "hp" | "stamina" | "magika">>) {
    setBattleOpponents((current) => current.map((opponent) => opponent.key === key ? { ...opponent, ...values } : opponent));

    if (key === selectedOpponentKey) {
      if (values.hp !== undefined) {
        setBattleEnemyHp(values.hp);
      }
      if (values.stamina !== undefined) {
        setBattleEnemyStamina(values.stamina);
      }
      if (values.magika !== undefined) {
        setBattleEnemyMagika(values.magika);
      }
    }
  }

  function updateCompanion(key: string, values: Partial<Pick<BattleCompanionState, "hp" | "stamina" | "magika">>) {
    setBattleCompanions((current) => current.map((companion) => companion.key === key ? { ...companion, ...values } : companion));
  }

  function chooseNextLivingOpponent(opponents: BattleOpponentState[], currentKey: string | null, currentHp: number) {
    return opponents
      .map((opponent) => opponent.key === currentKey ? { ...opponent, hp: currentHp } : opponent)
      .find((opponent) => opponent.hp > 0);
  }

  function allOpponentsDefeated(nextSelectedHp: number) {
    if (battleOpponents.length <= 1) {
      return nextSelectedHp <= 0;
    }

    return battleOpponents.every((opponent) => opponent.key === selectedOpponentKey ? nextSelectedHp <= 0 : opponent.hp <= 0);
  }

  function markSelectedOpponentHp(nextHp: number) {
    setBattleEnemyHp(nextHp);
    updateSelectedOpponent({ hp: nextHp });
  }

  function getOpponentDefense(opponent: BattleOpponentState | null) {
    return Number(opponent?.enemy?.defense ?? activeEnemy?.defense ?? 10) + Number(opponent?.enemy?.armor_rating ?? activeEnemy?.armor_rating ?? 0);
  }

  function getOpponentArmorReduction(opponent: BattleOpponentState | null) {
    return Math.floor(Number(opponent?.enemy?.armor_rating ?? activeEnemy?.armor_rating ?? 0) / 2);
  }

  function getSelectedOpponentSnapshot(selectedNextHp?: number) {
    const selected = battleOpponents.find((opponent) => opponent.key === selectedOpponentKey) ?? null;

    if (!selected) {
      return activeEnemy
        ? {
          key: selectedOpponentKey ?? "primary",
          combatant: null,
          enemy: activeEnemy,
          hp: selectedNextHp ?? battleEnemyHp,
          stamina: battleEnemyStamina,
          magika: battleEnemyMagika,
        } satisfies BattleOpponentState
        : null;
    }

    return {
      ...selected,
      hp: selectedNextHp ?? selected.hp,
    };
  }

  function setSelectedOpponentSnapshotHp(opponent: BattleOpponentState, nextHp: number) {
    if (opponent.key === selectedOpponentKey || opponent.key === "primary") {
      markSelectedOpponentHp(nextHp);
      return;
    }

    updateOpponent(opponent.key, { hp: nextHp });
  }

  async function resolveCompanionRound(selectedNextHp: number | undefined, context: BattleActionContext) {
    const livingCompanions = battleCompanions.filter((companion) => companion.hp > 0);
    const log: string[] = [];
    let selectedHp = selectedNextHp ?? battleEnemyHp;

    if (livingCompanions.length === 0 || battleFinished) {
      return { selectedHp, log };
    }

    log.push(`Companion turn: ${livingCompanions.length} ally${livingCompanions.length === 1 ? "" : "ies"} act.`);

    for (const companion of livingCompanions) {
      const target = getSelectedOpponentSnapshot(selectedHp);

      if (!target || target.hp <= 0) {
        const nextTarget = chooseNextLivingOpponent(battleOpponents, selectedOpponentKey, selectedHp);
        if (!nextTarget) {
          break;
        }
        selectBattleTarget(nextTarget.key);
        selectedHp = nextTarget.hp;
      }

      const activeTarget = getSelectedOpponentSnapshot(selectedHp);
      if (!activeTarget || activeTarget.hp <= 0) {
        break;
      }

      await delayEnemyTurn(320);
      const companionName = companion.ally.name || companion.combatant.label || "Companion";
      const ability = chooseWeightedEnemyAbility(companion.ally, companion.stamina, companion.magika, companion.hp);
      const attackBonus = ability
        ? getEnemyStatAttackBonus(companion.ally, ability.required_attribute) + Number(ability.attack_bonus ?? 0) + getEnemyAttackBonus(companion.ally)
        : getEnemyStatAttackBonus(companion.ally, "strength") + getEnemyAttackBonus(companion.ally);
      const roll = rollD20Attack(attackBonus, 0, getOpponentDefense(activeTarget), ability?.critical_chance ?? 0, ability?.critical_multiplier ?? 2);
      const actionName = ability?.name || "Strike";

      if (!roll.hit) {
        pushCombatIndicator("enemy", "MISS", "#9ca3af");
        log.push(`${companionName} uses ${actionName} and misses. d20 ${roll.roll} + bonuses = ${roll.total}.`);
        continue;
      }

      if (ability?.stamina_cost) {
        updateCompanion(companion.key, { stamina: Math.max(0, companion.stamina - ability.stamina_cost) });
      }
      if (ability?.magika_cost) {
        updateCompanion(companion.key, { magika: Math.max(0, companion.magika - ability.magika_cost) });
      }

      const baseDamage = Math.max(1, Number(ability?.damage ?? companion.ally.attack_bonus ?? 3) || 3);
      const reducedDamage = Math.max(1, baseDamage + getEnemyStatAttackBonus(companion.ally, ability?.required_attribute ?? "strength") - getOpponentArmorReduction(activeTarget));
      const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability?.critical_multiplier || 2)) : reducedDamage;
      selectedHp = Math.max(0, selectedHp - damage);
      setSelectedOpponentSnapshotHp(activeTarget, selectedHp);
      pushCombatIndicator("enemy", roll.critical ? `CRITICAL -${damage}` : `-${damage}`, roll.critical ? "#f6d365" : "#ff5c5c");
      log.push(`${companionName} uses ${actionName} for ${roll.critical ? "Critical " : ""}${damage}.`);

      if (selectedHp <= 0) {
        log.push(`${activeTarget.enemy?.name || "Target"} falls.`);
        if (allOpponentsDefeated(selectedHp)) {
          break;
        }
      }
    }

    return { selectedHp, log };
  }

  function getEnemyRoundOpponents(selectedNextHp?: number) {
    const opponents = battleOpponents.length > 0
      ? battleOpponents
      : [{
        key: "primary",
        combatant: null,
        enemy: activeEnemy,
        hp: battleEnemyHp,
        stamina: battleEnemyStamina,
        magika: battleEnemyMagika,
      }];

    return opponents
      .map((opponent) => opponent.key === selectedOpponentKey && selectedNextHp !== undefined ? { ...opponent, hp: selectedNextHp } : opponent)
      .filter((opponent) => opponent.enemy && opponent.hp > 0)
      .map((opponent) => ({ opponent, initiative: rollInitiative(Number(opponent.enemy?.agility ?? 0)) }))
      .sort((a, b) => b.initiative.total - a.initiative.total)
      .map((entry) => entry.opponent);
  }

  function pushCombatIndicator(target: CombatIndicator["target"], text: string, color: string, targetKey?: string | null) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCombatIndicators((current) => [...current, { id, target, targetKey, text, color }].slice(-8));
    setTimeout(() => {
      setCombatIndicators((current) => current.filter((indicator) => indicator.id !== id));
    }, 1150);
  }

  async function savePlayerHealth(nextHealth: number, previewMode = false) {
    const safeHealth = clampHealth(nextHealth, combatResources.maxHp);
    setBattlePlayerHp(safeHealth);
    if (previewMode) {
      return safeHealth;
    }

    await updateCharacterHealth(character.id, safeHealth);
    onCharacterUpdated({ ...character, current_health: safeHealth });
    return safeHealth;
  }

  async function handleBattleAction(ability: AbilityDefinition, context: BattleActionContext) {
    if (!activeBattle || battleFinished || battleTurnPhase !== "player") {
      return;
    }

    if (ability.sourceWeapon) {
      await handleWeaponAction(ability.sourceWeapon, context);
      return;
    }

    const currentResource = ability.resource === "stamina" ? battleStamina : ability.resource === "magicka" ? battleMagicka : ability.resource === "health" ? battlePlayerHp : Number.POSITIVE_INFINITY;

    if (currentResource < ability.cost) {
      setBattleLog((current) => [`Not enough ${ability.resource === "magicka" ? "Mana" : ability.resource === "none" ? "power" : ability.resource} for ${ability.name}.`, ...current].slice(0, 8));
      return;
    }

    if (ability.resource === "stamina") {
      setBattleStamina((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "magicka") {
      setBattleMagicka((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "health") {
      await savePlayerHealth(Math.max(1, battlePlayerHp - ability.cost), context.previewMode);
    }

    const healthRestore = Math.max(0, Number(ability.adminAbility?.healing ?? 0));
    const staminaRestore = Math.max(0, Number(ability.adminAbility?.stamina_restore ?? 0));
    const magikaRestore = Math.max(0, Number(ability.adminAbility?.magika_restore ?? 0));
    const isPureRestoreAbility = ability.adminAbility && ability.adminAbility.type === "heal" && Number(ability.adminAbility.damage ?? 0) <= 0;

    if (isPureRestoreAbility) {
      const nextLog: string[] = [];
      if (healthRestore > 0) {
        pushCombatIndicator("player", `+${healthRestore}`, "#42d77d");
        nextLog.push(`${ability.name} restores ${healthRestore} Health.`);
      }
      if (staminaRestore > 0) {
        pushCombatIndicator("player", `+${staminaRestore} Stamina`, "#3b82f6");
        setBattleStamina((current) => Math.min(combatResources.maxStamina, current + staminaRestore));
        nextLog.push(`${ability.name} restores ${staminaRestore} Stamina.`);
      }
      if (magikaRestore > 0) {
        pushCombatIndicator("player", `+${magikaRestore} Mana`, "#7dd3fc");
        setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + magikaRestore));
        nextLog.push(`${ability.name} restores ${magikaRestore} Mana.`);
      }
      if (nextLog.length === 0) {
        nextLog.push(`${ability.name} has no restore amount configured.`);
      }
      setBattleTurnPhase("enemy");
      await delayEnemyTurn();
      const allies = await resolveCompanionRound(battleEnemyHp, context);
      nextLog.push(...allies.log);
      if (allOpponentsDefeated(allies.selectedHp)) {
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }
      const counter = await resolveEnemyRound(context);
      const nextPlayerHp = Math.max(0, Math.min(combatResources.maxHp, battlePlayerHp + healthRestore) - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        setBattleTurnPhase("player");
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const enemyDefense = getEnemyDefense();
    const attackRoll = rollD20Attack(getPlayerAbilityAttackBonus(ability), getAbilityAttackBonus(ability), enemyDefense, ability.adminAbility?.critical_chance ?? 0, ability.adminAbility?.critical_multiplier ?? 2);
    const nextLog = [`${ability.name}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${ability.name} misses.`);
      setBattleTurnPhase("enemy");
      await delayEnemyTurn();
      const allies = await resolveCompanionRound(battleEnemyHp, context);
      nextLog.push(...allies.log);
      if (allOpponentsDefeated(allies.selectedHp)) {
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }
      const counter = await resolveEnemyRound(context, allies.selectedHp);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        setBattleTurnPhase("player");
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const rawDamage = getAbilityBaseDamage(ability) + getAbilityAttributeLevel(ability, "player") + getEquipmentDamageBonus(context.equippedItems);
    const reducedDamage = Math.max(1, rawDamage - getEnemyArmorReduction());
    const totalDamage = attackRoll.critical ? Math.ceil(reducedDamage * Number(attackRoll.criticalMultiplier || 2)) : reducedDamage;
    const nextEnemyHp = Math.max(0, battleEnemyHp - totalDamage);
    pushCombatIndicator("enemy", attackRoll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, attackRoll.critical ? "#f6d365" : "#ff5c5c");
    nextLog.push(`${ability.name} hits for ${attackRoll.critical ? "Critical " : ""}${totalDamage} ${ability.kind} damage.`);
    applyAbilityStatusToTarget(ability, "enemy", nextLog);
    let postAbilityPlayerHp = battlePlayerHp;
    if (healthRestore > 0) {
      postAbilityPlayerHp = Math.min(combatResources.maxHp, battlePlayerHp + healthRestore);
      pushCombatIndicator("player", `+${healthRestore}`, "#42d77d");
      nextLog.push(`${ability.name} restores ${healthRestore} Health.`);
    }
    if (staminaRestore > 0) {
      pushCombatIndicator("player", `+${staminaRestore} Stamina`, "#3b82f6");
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + staminaRestore));
      nextLog.push(`${ability.name} restores ${staminaRestore} Stamina.`);
    }
    if (magikaRestore > 0) {
      pushCombatIndicator("player", `+${magikaRestore} Mana`, "#7dd3fc");
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + magikaRestore));
      nextLog.push(`${ability.name} restores ${magikaRestore} Mana.`);
    }

    if (nextEnemyHp <= 0) {
      if (healthRestore > 0) {
        await savePlayerHealth(postAbilityPlayerHp, context.previewMode);
      }
      markSelectedOpponentHp(0);
      if (allOpponentsDefeated(nextEnemyHp)) {
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }
      const nextTarget = chooseNextLivingOpponent(battleOpponents, selectedOpponentKey, nextEnemyHp);
      if (nextTarget) {
        selectBattleTarget(nextTarget.key);
        nextLog.push(`${activeEnemy?.name || "Target"} falls. Choose the next target.`);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    setBattleTurnPhase("enemy");
    await delayEnemyTurn();
    const allies = await resolveCompanionRound(nextEnemyHp, context);
    nextLog.push(...allies.log);
    if (allOpponentsDefeated(allies.selectedHp)) {
      setBattleFinished("victory");
      setBattleTurnPhase("finished");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }
    const counter = await resolveEnemyRound(context, allies.selectedHp);
    const nextPlayerHp = Math.max(0, postAbilityPlayerHp - counter.damage);
    nextLog.push(...counter.log);

    markSelectedOpponentHp(allies.selectedHp);
    await savePlayerHealth(nextPlayerHp, context.previewMode);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog, context);
    } else {
      setBattleTurnPhase("player");
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  async function handleWeaponAction(weapon: ItemDefinition, context: BattleActionContext) {
    if (!activeBattle || battleFinished || battleTurnPhase !== "player") {
      return;
    }

    const costType = weapon.ability_cost_type;
    const cost = weapon.ability_cost_amount;

    if (costType === "health" && battlePlayerHp <= cost) {
      setBattleLog((current) => [`Not enough Health for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }
    if (costType === "stamina" && battleStamina < cost) {
      setBattleLog((current) => [`Not enough Stamina for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }
    if (costType === "magika" && battleMagicka < cost) {
      setBattleLog((current) => [`Not enough Mana for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }

    if (costType === "health") {
      await savePlayerHealth(Math.max(1, battlePlayerHp - cost), context.previewMode);
    } else if (costType === "stamina") {
      setBattleStamina((current) => Math.max(0, current - cost));
    } else if (costType === "magika") {
      setBattleMagicka((current) => Math.max(0, current - cost));
    }

    const bonuses = getInventoryResourceBonuses(context.equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    const enemyDefense = getEnemyDefense();
    const attackRoll = rollD20Attack(getStrengthAttackBonus(character.attributes?.strength ?? 0), bonuses.damage, enemyDefense, 0, 2);
    const actionName = weapon.ability_name || weapon.name;
    const nextLog = [`${actionName}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${actionName} misses.`);
      setBattleTurnPhase("enemy");
      await delayEnemyTurn();
      const allies = await resolveCompanionRound(battleEnemyHp, context);
      nextLog.push(...allies.log);
      if (allOpponentsDefeated(allies.selectedHp)) {
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }
      const counter = await resolveEnemyRound(context, allies.selectedHp);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        setBattleTurnPhase("player");
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const weaponDamage = Number(weapon.damage_amount ?? 0) + Number(weapon.elemental_damage_amount ?? 0) + bonuses.damage + getStrengthAttackBonus(character.attributes?.strength ?? 0);
    const totalDamage = attackRoll.critical ? Math.ceil(Math.max(1, weaponDamage - getEnemyArmorReduction()) * 2) : Math.max(1, weaponDamage - getEnemyArmorReduction());
    const nextEnemyHp = Math.max(0, battleEnemyHp - totalDamage);
    pushCombatIndicator("enemy", attackRoll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, attackRoll.critical ? "#f6d365" : "#ff5c5c");
    nextLog.push(`${actionName} hits for ${attackRoll.critical ? "Critical " : ""}${totalDamage} damage${weapon.elemental_damage_type !== "none" ? ` with ${weapon.elemental_damage_type}` : ""}.`);

    if (weapon.on_hit_effect === "restore health per hit") {
      await savePlayerHealth(Math.min(combatResources.maxHp, battlePlayerHp + Math.max(1, weapon.buff_amount || 2)), context.previewMode);
      nextLog.push("On-hit effect restores Health.");
    } else if (weapon.on_hit_effect === "restore stamina per hit") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Stamina.");
    } else if (weapon.on_hit_effect === "restore magika per hit") {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Mana.");
    } else if (weapon.on_hit_effect) {
      nextLog.push(`On-hit effect: ${weapon.on_hit_effect}.`);
    }

    if (nextEnemyHp <= 0) {
      markSelectedOpponentHp(0);
      if (allOpponentsDefeated(nextEnemyHp)) {
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }
      const nextTarget = chooseNextLivingOpponent(battleOpponents, selectedOpponentKey, nextEnemyHp);
      if (nextTarget) {
        selectBattleTarget(nextTarget.key);
        nextLog.push(`${activeEnemy?.name || "Target"} falls. Choose the next target.`);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    setBattleTurnPhase("enemy");
    await delayEnemyTurn();
    const allies = await resolveCompanionRound(nextEnemyHp, context);
    nextLog.push(...allies.log);
    if (allOpponentsDefeated(allies.selectedHp)) {
      setBattleFinished("victory");
      setBattleTurnPhase("finished");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }
    const counter = await resolveEnemyRound(context, allies.selectedHp);
    const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
    nextLog.push(...counter.log);
    markSelectedOpponentHp(allies.selectedHp);
    await savePlayerHealth(nextPlayerHp, context.previewMode);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog, context);
    } else {
      setBattleTurnPhase("player");
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  async function fleeBattle(context: BattleActionContext) {
    if (!activeBattle || battleFinished) {
      return;
    }

    if (context.previewMode) {
      setBattleLog((current) => ["Preview flee. Battle ended and no rewards were granted.", ...current].slice(0, 8));
      context.closePreview();
      return;
    }
    setBattleLog((current) => ["You escaped. No rewards were granted.", ...current].slice(0, 8));
    resetBattleState();
    context.setGpsMessage("You escaped. No rewards were granted.");
  }

  async function resolveEnemyRound(context: BattleActionContext, selectedNextHp?: number, extraPlayerDefense = 0) {
    const livingOpponents = getEnemyRoundOpponents(selectedNextHp);
    const log: string[] = [];
    let totalDamage = 0;

    if (livingOpponents.length === 0) {
      return { damage: 0, log };
    }

    log.push(`Enemy turn: ${livingOpponents.length} foe${livingOpponents.length === 1 ? "" : "s"} act.`);

    for (const opponent of livingOpponents) {
      await delayEnemyTurn(livingOpponents.length > 1 ? 360 : 0);
      const result = resolveSingleEnemyAction(opponent, context, extraPlayerDefense);
      totalDamage += result.damage;
      log.push(...result.log);
    }

    return { damage: totalDamage, log };
  }

  function resolveSingleEnemyAction(opponent: BattleOpponentState, context: BattleActionContext, extraPlayerDefense = 0) {
    const enemy = opponent.enemy;
    const enemyName = enemy?.name || activeBattle?.enemy_name || "Enemy";
    const ability = chooseWeightedEnemyAbility(enemy, opponent.stamina, opponent.magika, opponent.hp);
    const target = chooseEnemyTarget(context.equippedItems, extraPlayerDefense);
    const targetDefense = target.kind === "player" ? getPlayerDefense(context.equippedItems, extraPlayerDefense) : getCompanionDefense(target.companion);
    const targetName = target.kind === "player" ? "you" : (target.companion.ally.name || target.companion.combatant.label || "companion");

    if (!enemy) {
      return { damage: 0, log: [] };
    }

    if (!ability) {
      const roll = rollD20Attack(getEnemyStatAttackBonus(enemy, "strength"), getEnemyAttackBonus(enemy), targetDefense, 0, 2);
      if (!roll.hit) {
        pushCombatIndicator(target.kind === "player" ? "player" : "companion", "MISS", "#9ca3af", target.kind === "companion" ? target.companion.key : null);
        return { damage: 0, log: [`${enemyName} attacks ${targetName} and misses. d20 ${roll.roll} + bonuses = ${roll.total} vs Defense ${targetDefense}.`] };
      }
      const damage = Math.max(1, (Number(activeBattle?.enemy_attack_damage) || 5) - extraPlayerDefense);
      const totalDamage = roll.critical ? Math.ceil(damage * 2) : damage;
      applyEnemyDamageToTarget(target, totalDamage, roll.critical);
      return { damage: target.kind === "player" ? totalDamage : 0, log: [`${enemyName} hits ${targetName} for ${roll.critical ? "Critical " : ""}${totalDamage}.`] };
    }

    if (ability.stamina_cost > 0) {
      updateOpponent(opponent.key, { stamina: Math.max(0, opponent.stamina - ability.stamina_cost) });
    }
    if (ability.magika_cost > 0) {
      updateOpponent(opponent.key, { magika: Math.max(0, opponent.magika - ability.magika_cost) });
    }

    if (ability.type === "heal") {
      const logs: string[] = [];
      const healing = Math.max(0, Number(ability.healing) || 0);
      const staminaRestore = Math.max(0, Number(ability.stamina_restore) || 0);
      const magikaRestore = Math.max(0, Number(ability.magika_restore) || 0);
      if (healing > 0) {
        const nextHp = Math.min(Number(enemy.health ?? activeBattle?.enemy_hp ?? 30), opponent.hp + healing);
        updateOpponent(opponent.key, { hp: nextHp });
        if (opponent.key === selectedOpponentKey) {
          pushCombatIndicator("enemy", `+${healing}`, "#42d77d");
        }
        logs.push(`${enemyName} heals ${healing}.`);
      }
      if (staminaRestore > 0) {
        const nextStamina = Math.min(Number(enemy.stamina ?? 0), opponent.stamina + staminaRestore);
        updateOpponent(opponent.key, { stamina: nextStamina });
        logs.push(`${enemyName} restores ${staminaRestore} Stamina.`);
      }
      if (magikaRestore > 0) {
        const nextMagika = Math.min(Number(enemy.magika ?? 0), opponent.magika + magikaRestore);
        updateOpponent(opponent.key, { magika: nextMagika });
        logs.push(`${enemyName} restores ${magikaRestore} Mana.`);
      }
      return { damage: 0, log: [`${enemyName} uses ${ability.name}.`, ...(logs.length > 0 ? logs : ["No restore amount is configured."])] };
    }

    if (ability.type === "defense" || ability.type === "buff" || ability.type === "passive") {
      return { damage: 0, log: [`${enemyName} uses ${ability.name}. ${ability.status_effect !== "none" ? `Status: ${ability.status_effect}.` : "It braces for the next exchange."}`] };
    }

    const statBonus = getEnemyStatAttackBonus(enemy, ability.required_attribute);
    const roll = rollD20Attack(statBonus, Number(ability.attack_bonus ?? 0) + getEnemyAttackBonus(enemy), targetDefense, ability.critical_chance, ability.critical_multiplier);
    if (!roll.hit) {
      pushCombatIndicator(target.kind === "player" ? "player" : "companion", "MISS", "#9ca3af", target.kind === "companion" ? target.companion.key : null);
      return { damage: 0, log: [`${enemyName} uses ${ability.name} on ${targetName} and misses. d20 ${roll.roll} + bonuses = ${roll.total} vs Defense ${targetDefense}.`] };
    }

    const baseDamage = Math.max(1, Number(ability.damage) || 1);
    const reducedDamage = Math.max(1, baseDamage - extraPlayerDefense);
    const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability.critical_multiplier || 2)) : reducedDamage;
    const statusText = ability.status_effect !== "none" ? ` ${ability.status_effect} may linger.` : "";
    applyEnemyDamageToTarget(target, damage, roll.critical);
    pushStatusIndicator(target.kind === "player" ? "player" : "companion", ability.status_effect, ability.effect_amount, target.kind === "companion" ? target.companion.key : null);
    return { damage: target.kind === "player" ? damage : 0, log: [`${enemyName} uses ${ability.name} on ${targetName} for ${roll.critical ? "Critical " : ""}${damage}.${statusText}`] };
  }

  function chooseEnemyTarget(equippedItems: Record<string, ItemDefinition | null>, extraDefense = 0): { kind: "player"; defense: number } | { kind: "companion"; companion: BattleCompanionState; defense: number } {
    const livingCompanions = battleCompanions.filter((companion) => companion.hp > 0);
    const pool = [
      { kind: "player" as const, defense: getPlayerDefense(equippedItems, extraDefense) },
      ...livingCompanions.map((companion) => ({ kind: "companion" as const, companion, defense: getCompanionDefense(companion) })),
    ];

    return pool[Math.floor(Math.random() * pool.length)] ?? { kind: "player", defense: getPlayerDefense(equippedItems, extraDefense) };
  }

  function getCompanionDefense(companion: BattleCompanionState) {
    return Number(companion.ally.defense ?? 10) + Number(companion.ally.armor_rating ?? 0);
  }

  function applyEnemyDamageToTarget(target: ReturnType<typeof chooseEnemyTarget>, damage: number, critical: boolean) {
    const text = critical ? `CRITICAL -${damage}` : `-${damage}`;
    const color = critical ? "#f6d365" : "#ff5c5c";

    if (target.kind === "companion") {
      updateCompanion(target.companion.key, { hp: Math.max(0, target.companion.hp - damage) });
      pushCombatIndicator("companion", text, color, target.companion.key);
      return;
    }

    pushCombatIndicator("player", text, color);
  }

  function getPlayerDefense(equippedItems: Record<string, ItemDefinition | null>, extraDefense = 0) {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return 10 + bonuses.defense + extraDefense;
  }

  function getEnemyDefense() {
    return Number(activeEnemy?.defense ?? 10) + Number(activeEnemy?.armor_rating ?? 0);
  }

  function getEnemyAttackBonus(enemy: EnemyWithLoadout | NpcWithLoadout | null = activeEnemy) {
    return Number(enemy?.attack_bonus ?? 0);
  }

  function getEnemyArmorReduction() {
    return Math.floor(Number(activeEnemy?.armor_rating ?? 0) / 2);
  }

  function getEquipmentDamageBonus(equippedItems: Record<string, ItemDefinition | null>) {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return bonuses.damage;
  }

  function getAbilityAttackBonus(ability: AbilityDefinition) {
    return Number(ability.adminAbility?.attack_bonus ?? 0);
  }

  function getAbilityBaseDamage(ability: AbilityDefinition) {
    return Math.max(1, Number(ability.adminAbility?.damage ?? ability.baseDamage) || 1);
  }

  function getAbilityAttributeLevel(ability: AbilityDefinition, side: "player" | "enemy") {
    const key = ability.attribute ?? ability.adminAbility?.required_attribute ?? (ability.adminAbility?.linked_stat && ability.adminAbility.linked_stat !== "none" && ability.adminAbility.linked_stat !== "weapon" && ability.adminAbility.linked_stat !== "item" ? ability.adminAbility.linked_stat : null);

    if (!key) {
      return 0;
    }

    if (side === "enemy") {
      return Number(activeEnemy?.[key] ?? 0);
    }

    return Number(character.attributes?.[key] ?? 0);
  }

  function getStrengthAttackBonus(strengthLevel: number) {
    return Math.max(0, Math.floor(Number(strengthLevel) || 0));
  }

  function getPlayerAbilityAttackBonus(ability: AbilityDefinition) {
    const key = ability.attribute ?? ability.adminAbility?.required_attribute ?? (ability.adminAbility?.linked_stat && ability.adminAbility.linked_stat !== "none" && ability.adminAbility.linked_stat !== "weapon" && ability.adminAbility.linked_stat !== "item" ? ability.adminAbility.linked_stat : null);
    const attributeLevel = getAbilityAttributeLevel(ability, "player");
    return key === "strength" ? getStrengthAttackBonus(attributeLevel) : getD20StatBonus(attributeLevel);
  }

  function getEnemyStatAttackBonus(enemy: EnemyWithLoadout | NpcWithLoadout | null, key: string | null | undefined) {
    if (!enemy || !key || key === "none" || key === "weapon" || key === "item") {
      return 0;
    }
    return getD20StatBonus(Number(enemy[key as keyof typeof enemy] ?? 0));
  }

  function applyAbilityStatusToTarget(ability: AbilityDefinition, target: CombatIndicator["target"], log: string[]) {
    const status = ability.adminAbility?.status_effect;

    if (!status || status === "none") {
      return;
    }

    const amount = Number(ability.adminAbility?.effect_amount ?? 0);
    const duration = Number(ability.adminAbility?.effect_duration ?? 0);
    pushStatusIndicator(target, status, amount);
    log.push(`${status} applied${duration ? ` for ${duration} turns` : ""}.`);
  }

  function pushStatusIndicator(target: CombatIndicator["target"], status: string | null | undefined, amount: number, targetKey?: string | null) {
    if (!status || status === "none" || amount <= 0) {
      return;
    }

    if (status === "poison") {
      pushCombatIndicator(target, `Poison -${amount}`, "#b55cff", targetKey);
    } else if (status === "burn") {
      pushCombatIndicator(target, `Burn -${amount}`, "#ff8a2a", targetKey);
    } else if (status === "regen") {
      pushCombatIndicator(target, `+${amount}`, "#42d77d", targetKey);
    }
  }

  async function resolvePlayerDefeat(log: string[], context: BattleActionContext) {
    setBattleFinished("defeat");
    setBattleTurnPhase("finished");
    await savePlayerHealth(1, context.previewMode);
    log.push(activeBattle?.defeat_text || "Defeat.");

    if (context.previewMode) {
      setRevivePromptOpen(false);
      log.push("Preview defeat. No route progress or Health was changed.");
      return;
    }

    if (context.battleMode === "arena") {
      setRevivePromptOpen(false);
      log.push("Arena challenge lost. No trail progress was changed.");
      return;
    }

    const reviveItem = context.inventoryItems.find((entry) => entry.quantity > 0 && isReviveBattleItem(entry.item));

    if (reviveItem) {
      setRevivePromptOpen(true);
      setBattleInventoryOpen(false);
      log.push(`${reviveItem.item.name} is available. Use it now or return to the trail start.`);
      return;
    }

    setRevivePromptOpen(false);
    log.push("No Revive Scroll found. Returning to the start of this trail.");
    await context.resetRouteAfterDefeat();
  }

  async function declineReviveAfterDefeat(context: BattleActionContext) {
    setRevivePromptOpen(false);
    if (context.previewMode) {
      setBattleLog((current) => ["Preview ended after defeat.", ...current].slice(0, 8));
      context.closePreview();
      return;
    }
    if (context.battleMode === "arena") {
      setBattleLog((current) => ["Arena challenge ended. No trail progress was changed.", ...current].slice(0, 8));
      return;
    }
    setBattleLog((current) => ["No revive used. Returning to the start of this trail.", ...current].slice(0, 8));
    await context.resetRouteAfterDefeat();
  }

  async function useBattleItem(entry: InventoryItem, context: BattleActionContext) {
    const item = entry.item;
    const defeated = battlePlayerHp <= 0 || battleFinished === "defeat";

    if (defeated && !isReviveBattleItem(item)) {
      setBattleLog((current) => ["Only Revive Scrolls can be used after defeat.", ...current].slice(0, 8));
      return;
    }

    if (item.type !== "potion" && !isReviveBattleItem(item)) {
      setBattleLog((current) => [`${item.name} has no battle use yet.`, ...current].slice(0, 8));
      return;
    }

    const target = defeated ? "health" : item.potion_target ?? "health";
    const restoreFromPercent = item.restore_percent ? Math.ceil((target === "health" ? combatResources.maxHp : target === "stamina" ? combatResources.maxStamina : combatResources.maxMagicka) * (item.restore_percent / 100)) : 0;
    const amount = Math.max(item.restore_amount, restoreFromPercent, defeated ? Math.ceil(combatResources.maxHp * 0.5) : 0);

    if (target === "health") {
      await savePlayerHealth(Math.min(combatResources.maxHp, battlePlayerHp + amount), context.previewMode);
      pushCombatIndicator("player", `+${amount}`, "#42d77d");
      if (defeated) {
        setBattleFinished(null);
        setBattleTurnPhase("player");
        setRevivePromptOpen(false);
      }
    } else if (target === "stamina") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + amount));
      pushCombatIndicator("player", `+${amount}`, "#2f80ed");
    } else {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + amount));
      pushCombatIndicator("player", `+${amount}`, "#7fdcff");
    }

    if (!context.previewMode) {
      await consumeInventoryItem(entry, 1);
      await context.loadInventory();
    }
    setBattleInventoryOpen(false);
    setBattleLog((current) => [`Used ${item.name}. Restored ${amount} ${target}.`, ...current].slice(0, 8));
  }

  async function resolveOpeningEnemyTurn(context: BattleActionContext) {
    if (!openingEnemyTurnQueued || !activeBattle || battleFinished) {
      return;
    }

    setOpeningEnemyTurnQueued(false);
    setBattleTurnPhase("enemy");
    await delayEnemyTurn(950);
    const counter = await resolveEnemyRound(context);
    const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
    const nextLog = [...counter.log];
    await savePlayerHealth(nextPlayerHp, context.previewMode);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog, context);
    } else {
      setBattleTurnPhase("player");
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  return {
    activeBattle,
    setActiveBattle,
    battlePlayerHp,
    setBattlePlayerHp,
    battleStamina,
    setBattleStamina,
    battleMagicka,
    setBattleMagicka,
    battleEnemyHp,
    setBattleEnemyHp,
    battleEnemyStamina,
    setBattleEnemyStamina,
    battleEnemyMagika,
    setBattleEnemyMagika,
    battleOpponents,
    battleCompanions,
    battleLayoutCombatants,
    selectedOpponentKey,
    battleLog,
    setBattleLog,
    battleFinished,
    setBattleFinished,
    battleTurnPhase,
    openingEnemyTurnQueued,
    revivePromptOpen,
    setRevivePromptOpen,
    activeEnemy,
    setActiveEnemy,
    combatIndicators,
    setCombatIndicators,
    combatResources,
    setCombatResources,
    equippedAbilities,
    setEquippedAbilities,
    battleInventoryOpen,
    setBattleInventoryOpen,
    resetBattleState,
    startBattle,
    selectBattleTarget,
    pushCombatIndicator,
    savePlayerHealth,
    handleBattleAction,
    handleWeaponAction,
    resolveOpeningEnemyTurn,
    fleeBattle,
    declineReviveAfterDefeat,
    useBattleItem,
  };
}

function rollInitiative(attributeLevel: number) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const bonus = Math.max(0, Math.floor(Number(attributeLevel || 0) / 2));

  return {
    roll,
    bonus,
    total: roll + bonus,
  };
}

function delayEnemyTurn(ms = 750) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
