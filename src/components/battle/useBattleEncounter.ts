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
  summoned?: boolean;
  remainingTurns?: number;
};

export type BattleTurnPhase = "rolling" | "player" | "enemy" | "finished";

type BattleTimedEffect = {
  status: "poison" | "burn" | "regen" | "shield" | "weakness" | "slow" | "stun";
  amount: number;
  turns: number;
  source: string;
};

export function useBattleEncounter(character: CharacterWithDetails, onCharacterUpdated: (character: CharacterWithDetails) => void) {
  const [activeBattle, setActiveBattle] = useState<MapEvent | null>(null);
  const [battlePlayerHp, setBattlePlayerHp] = useState(100);
  const [battleStamina, setBattleStamina] = useState(0);
  const [battleMagicka, setBattleMagicka] = useState(0);
  const [battleEnemyHp, setBattleEnemyHp] = useState(0);
  const [battleEnemyStamina, setBattleEnemyStamina] = useState(0);
  const [battleEnemyMagika, setBattleEnemyMagika] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleFinished, setBattleFinished] = useState<"victory" | "defeat" | "flee" | null>(null);
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
  const [battleAbilityCooldowns, setBattleAbilityCooldowns] = useState<Record<string, number>>({});
  const [playerTimedEffects, setPlayerTimedEffects] = useState<BattleTimedEffect[]>([]);
  const [enemyTimedEffects, setEnemyTimedEffects] = useState<Record<string, BattleTimedEffect[]>>({});

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
    setBattleAbilityCooldowns({});
    setPlayerTimedEffects([]);
    setEnemyTimedEffects({});
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

  function tickSummonDurations() {
    setBattleCompanions((current) => current
      .map((companion) => companion.summoned && companion.remainingTurns !== undefined ? { ...companion, remainingTurns: companion.remainingTurns - 1 } : companion)
      .filter((companion) => !companion.summoned || (companion.remainingTurns ?? 1) > 0));
  }

  function getSummonAnchor(side: "player_summon" | "enemy_summon", index: number, fallback: { x: number; y: number; size: number; sortOrder: number }) {
    const anchors = battleLayoutCombatants
      .filter((combatant) => combatant.is_active && combatant.side === side)
      .sort((left, right) => left.sort_order - right.sort_order);
    const anchor = anchors[index] ?? anchors[anchors.length - 1];

    if (!anchor) {
      return {
        xPercent: fallback.x,
        yPercent: fallback.y,
        sizePercent: fallback.size,
        sortOrder: fallback.sortOrder,
      };
    }

    return {
      xPercent: Number(anchor.x_percent ?? fallback.x) || fallback.x,
      yPercent: Number(anchor.y_percent ?? fallback.y) || fallback.y,
      sizePercent: Number(anchor.size_percent ?? fallback.size) || fallback.size,
      sortOrder: Number(anchor.sort_order ?? fallback.sortOrder) || fallback.sortOrder,
    };
  }

  async function summonBattleCompanions(ability: AbilityDefinition) {
    const adminAbility = ability.adminAbility;
    if (!adminAbility) {
      return { summoned: 0, log: [`${ability.name} has no summon data configured.`] };
    }

    const summon = adminAbility.summon_kind === "npc" && adminAbility.summon_npc_id
      ? await getNpcLoadout(adminAbility.summon_npc_id)
      : adminAbility.summon_kind === "enemy" && adminAbility.summon_enemy_id
        ? await getEnemyLoadout(adminAbility.summon_enemy_id)
        : null;

    if (!summon) {
      return { summoned: 0, log: [`${ability.name} has no valid summoned Enemy or NPC selected in Ability Admin.`] };
    }

    const count = Math.max(1, Math.min(4, Number(adminAbility.summon_count ?? 1) || 1));
    const duration = Math.max(1, Number(adminAbility.summon_duration_turns ?? adminAbility.duration_turns ?? 3) || 3);
    const createdAt = Date.now();
    const newCompanions = Array.from({ length: count }).map((_, index) => {
      const spread = count === 1 ? 0 : (index - (count - 1) / 2) * 7;
      const anchor = getSummonAnchor("player_summon", index, {
        x: Math.max(12, Math.min(88, 32 + spread)),
        y: Math.max(12, Math.min(88, 58 + index * 4)),
        size: 12,
        sortOrder: battleCompanions.length + index + 1,
      });
      const combatant = {
        id: `summon-${adminAbility.id}-${createdAt}-${index}`,
        event_id: activeBattle?.id ?? "",
        marker_id: null,
        side: "companion",
        enemy_id: adminAbility.summon_kind === "enemy" ? adminAbility.summon_enemy_id : null,
        npc_id: adminAbility.summon_kind === "npc" ? adminAbility.summon_npc_id : null,
        label: summon.name,
        x_percent: anchor.xPercent,
        y_percent: anchor.yPercent,
        size_percent: anchor.sizePercent,
        sort_order: anchor.sortOrder,
        is_boss: false,
        is_active: true,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BattleEventCombatant | MarkerBattleCombatant;

      return {
        key: combatant.id,
        combatant,
        ally: summon,
        hp: Number(summon.health ?? 20) || 20,
        stamina: Number(summon.stamina ?? 0) || 0,
        magika: Number(summon.magika ?? 0) || 0,
        summoned: true,
        remainingTurns: duration,
      } satisfies BattleCompanionState;
    });

    setBattleCompanions((current) => [...current, ...newCompanions]);
    return {
      summoned: newCompanions.length,
      log: [`${ability.name} summons ${newCompanions.length} ${summon.name}${newCompanions.length === 1 ? "" : "s"} for ${duration} turn${duration === 1 ? "" : "s"}.`],
    };
  }

  function chooseNextLivingOpponent(opponents: BattleOpponentState[], currentKey: string | null, currentHp: number) {
    return opponents
      .map((opponent) => opponent.key === currentKey ? { ...opponent, hp: currentHp } : opponent)
      .find((opponent) => opponent.hp > 0);
  }

  function getPlayerAbilityTargets(targetMode: "all_enemies" | "random_enemy") {
    const living = battleOpponents.length > 0
      ? battleOpponents.filter((opponent) => opponent.enemy && opponent.hp > 0)
      : activeEnemy
        ? [{
            key: selectedOpponentKey ?? "single-enemy",
            combatant: null,
            enemy: activeEnemy,
            hp: battleEnemyHp,
            stamina: battleEnemyStamina,
            magika: battleEnemyMagika,
          } satisfies BattleOpponentState]
        : [];

    if (targetMode === "random_enemy") {
      const target = living[Math.floor(Math.random() * living.length)];
      return target ? [target] : [];
    }

    return living;
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

    if (consumePlayerStun()) {
      const nextLog = ["You are stunned and lose your action."];
      setBattleTurnPhase("enemy");
      await delayEnemyTurn();
      const counter = await resolveEnemyRound(context);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        finishEnemyExchange();
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const abilityKey = getBattleAbilityKey(ability);
    const cooldownTurns = battleAbilityCooldowns[abilityKey] ?? 0;
    if (cooldownTurns > 0) {
      setBattleLog((current) => [`${ability.name} is on cooldown for ${cooldownTurns} turn${cooldownTurns === 1 ? "" : "s"}.`, ...current].slice(0, 8));
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
    const abilityType = ability.adminAbility?.type ?? "attack";
    const targetMode = ability.adminAbility?.target_mode ?? "single_enemy";
    const isPureRestoreAbility = ability.adminAbility && abilityType === "heal" && Number(ability.adminAbility.damage ?? 0) <= 0;

    setAbilityCooldownAfterUse(ability);

    if (ability.adminAbility && (abilityType === "summon" || abilityType === "conjure")) {
      const summonResult = await summonBattleCompanions(ability);
      const nextLog: string[] = summonResult.log;

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
        finishEnemyExchange();
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    if (ability.adminAbility && (abilityType === "defense" || abilityType === "buff") && Number(ability.adminAbility.damage ?? 0) <= 0) {
      const nextLog: string[] = [`${ability.name} is active.`];
      const immediateDefense = applySelfStatusOrDefense(ability, nextLog);
      if (healthRestore > 0) {
        pushCombatIndicator("player", `+${healthRestore}`, "#42d77d");
        nextLog.push(`${ability.name} restores ${healthRestore} Health.`);
        if (targetMode === "all_allies") {
          battleCompanions.filter((companion) => companion.hp > 0).forEach((companion) => {
            const maxHp = Number(companion.ally.health ?? 30) || 30;
            updateCompanion(companion.key, { hp: Math.min(maxHp, companion.hp + healthRestore) });
            pushCombatIndicator("companion", `+${healthRestore}`, "#42d77d", companion.key);
          });
          if (battleCompanions.some((companion) => companion.hp > 0)) {
            nextLog.push(`${ability.name} also restores nearby allies.`);
          }
        }
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
      const postAbilityPlayerHp = Math.min(combatResources.maxHp, battlePlayerHp + healthRestore);
      const counter = await resolveEnemyRound(context, allies.selectedHp, immediateDefense);
      const nextPlayerHp = Math.max(0, postAbilityPlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        finishEnemyExchange();
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

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
        finishEnemyExchange();
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    let postAbilityPlayerHp = battlePlayerHp;
    if (targetMode === "all_enemies" || targetMode === "random_enemy") {
      const targets = getPlayerAbilityTargets(targetMode);
      const nextLog = [`${ability.name} targets ${targetMode === "all_enemies" ? "all enemies" : "a random enemy"}.`];
      const nextHpByKey = new Map<string, number>();

      if (targets.length === 0) {
        setBattleLog((current) => [`${ability.name} has no valid target.`, ...current].slice(0, 8));
        return;
      }

      for (const target of targets) {
        const enemyDefense = getOpponentDefense(target);
        const attackRoll = rollD20Attack(getPlayerAbilityAttackBonus(ability), getAbilityAttackBonus(ability), enemyDefense, ability.adminAbility?.critical_chance ?? 0, ability.adminAbility?.critical_multiplier ?? 2);
        const targetName = target.enemy?.name || target.combatant?.label || "Enemy";
        nextLog.push(`${targetName}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`);

        if (!attackRoll.hit) {
          pushCombatIndicator("enemy", "MISS", "#9ca3af", target.key);
          nextLog.push(attackRoll.roll === 1 ? `${targetName}: natural 1. Automatic miss.` : `${ability.name} misses ${targetName}.`);
          nextHpByKey.set(target.key, target.hp);
          continue;
        }

        const rawDamage = getAbilityBaseDamage(ability) + getAbilityAttributeLevel(ability, "player") + getEquipmentDamageBonus(context.equippedItems);
        const reducedDamage = Math.max(1, rawDamage - getOpponentArmorReduction(target));
        const totalDamage = attackRoll.critical ? Math.ceil(reducedDamage * Number(attackRoll.criticalMultiplier || 2)) : reducedDamage;
        const nextHp = Math.max(0, target.hp - totalDamage);
        nextHpByKey.set(target.key, nextHp);
        updateOpponent(target.key, { hp: nextHp });
        pushCombatIndicator("enemy", attackRoll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, attackRoll.critical ? "#f6d365" : "#ff5c5c", target.key);
        nextLog.push(`${ability.name} hits ${targetName} for ${attackRoll.critical ? "Critical " : ""}${totalDamage} ${ability.kind} damage.`);
        applyAbilityStatusToTarget(ability, "enemy", nextLog, target.key);
      }

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

      const selectedHpAfterAbility = selectedOpponentKey ? nextHpByKey.get(selectedOpponentKey) ?? battleEnemyHp : battleEnemyHp;
      const allDefeated = battleOpponents.length > 0
        ? battleOpponents.every((opponent) => (nextHpByKey.get(opponent.key) ?? opponent.hp) <= 0)
        : selectedHpAfterAbility <= 0;

      if (allDefeated) {
        setBattleEnemyHp(0);
        setBattleFinished("victory");
        setBattleTurnPhase("finished");
        setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
        return;
      }

      if (selectedOpponentKey && selectedHpAfterAbility <= 0) {
        const nextTarget = battleOpponents.find((opponent) => (nextHpByKey.get(opponent.key) ?? opponent.hp) > 0);
        if (nextTarget) {
          selectBattleTarget(nextTarget.key);
          nextLog.push(`${activeEnemy?.name || "Target"} falls. Choose the next target.`);
        }
      }

      setBattleTurnPhase("enemy");
      await delayEnemyTurn();
      const allies = await resolveCompanionRound(selectedHpAfterAbility, context);
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
      await savePlayerHealth(nextPlayerHp, context.previewMode);

      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      } else {
        finishEnemyExchange();
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
        finishEnemyExchange();
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
    applyAbilityStatusToTarget(ability, "enemy", nextLog, selectedOpponentKey);
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
      finishEnemyExchange();
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
        finishEnemyExchange();
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
      finishEnemyExchange();
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
    setBattleFinished("flee");
    setBattleTurnPhase("finished");
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setBattleLog((current) => ["You escaped. No rewards were granted.", ...current].slice(0, 8));
    context.setGpsMessage("You escaped. No rewards were granted.");
  }

  async function resolveEnemyRound(context: BattleActionContext, selectedNextHp?: number, extraPlayerDefense = 0) {
    const livingOpponents = getEnemyRoundOpponents(selectedNextHp);
    const log: string[] = [];
    let totalDamage = 0;
    let nextEnemyEffects = { ...enemyTimedEffects };

    if (livingOpponents.length === 0) {
      return { damage: 0, log };
    }

    const playerStartEffects = tickPlayerTimedEffects(log);
    const effectivePlayerDefense = extraPlayerDefense + playerStartEffects.defenseBonus;

    log.push(`Enemy turn: ${livingOpponents.length} foe${livingOpponents.length === 1 ? "" : "s"} act.`);

    for (const opponent of livingOpponents) {
      await delayEnemyTurn(livingOpponents.length > 1 ? 360 : 0);
      const tick = tickEnemyTimedEffects(opponent, nextEnemyEffects, log);
      nextEnemyEffects = tick.effects;
      if (tick.nextHp <= 0) {
        continue;
      }
      if (tick.skipTurn) {
        log.push(`${opponent.enemy?.name || "Enemy"} is stunned and loses its turn.`);
        continue;
      }
      const readyOpponent = { ...opponent, hp: tick.nextHp };
      const result = resolveSingleEnemyAction(readyOpponent, context, effectivePlayerDefense, playerStartEffects.attackPenalty + tick.attackPenalty, (targetKey, effect) => {
        nextEnemyEffects = {
          ...nextEnemyEffects,
          [targetKey]: mergeTimedEffects(nextEnemyEffects[targetKey] ?? [], effect),
        };
      });
      totalDamage += result.damage;
      log.push(...result.log);
    }

    setEnemyTimedEffects(nextEnemyEffects);
    return { damage: totalDamage - playerStartEffects.healing, log };
  }

  function resolveSingleEnemyAction(
    opponent: BattleOpponentState,
    context: BattleActionContext,
    extraPlayerDefense = 0,
    attackPenalty = 0,
    queueEnemyEffect?: (targetKey: string, effect: BattleTimedEffect) => void,
  ) {
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
      const roll = rollD20Attack(getEnemyStatAttackBonus(enemy, "strength"), getEnemyAttackBonus(enemy) - attackPenalty, targetDefense, 0, 2);
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
      const defenseAmount = Math.max(0, Number(ability.defense_amount ?? 0));
      const duration = Math.max(1, Number(ability.duration_turns ?? ability.effect_duration ?? 1) || 1);
      if (defenseAmount > 0) {
        queueEnemyEffect?.(opponent.key, { status: "shield", amount: defenseAmount, turns: duration, source: ability.name });
      }
      if (ability.status_effect === "regen" || ability.status_effect === "shield") {
        queueEnemyEffect?.(opponent.key, {
          status: ability.status_effect,
          amount: Math.max(ability.status_effect === "shield" ? defenseAmount : 0, Number(ability.effect_amount ?? 0)),
          turns: Math.max(1, Number(ability.effect_duration ?? ability.duration_turns ?? 1) || 1),
          source: ability.name,
        });
      }
      return { damage: 0, log: [`${enemyName} uses ${ability.name}. ${ability.status_effect !== "none" ? `Status: ${ability.status_effect}.` : "It braces for the next exchange."}`] };
    }

    if (ability.target_mode === "all_allies") {
      const targets = getEnemySideTargets(context.equippedItems, extraPlayerDefense);
      const logs: string[] = [`${enemyName} uses ${ability.name} on the group.`];
      let playerDamage = 0;
      for (const groupTarget of targets) {
        const groupTargetName = groupTarget.kind === "player" ? "you" : (groupTarget.companion.ally.name || groupTarget.companion.combatant.label || "companion");
        const statBonus = getEnemyStatAttackBonus(enemy, ability.required_attribute);
        const roll = rollD20Attack(statBonus, Number(ability.attack_bonus ?? 0) + getEnemyAttackBonus(enemy) - attackPenalty, groupTarget.defense, ability.critical_chance, ability.critical_multiplier);
        if (!roll.hit) {
          pushCombatIndicator(groupTarget.kind === "player" ? "player" : "companion", "MISS", "#9ca3af", groupTarget.kind === "companion" ? groupTarget.companion.key : null);
          logs.push(`${enemyName} misses ${groupTargetName}. d20 ${roll.roll} + bonuses = ${roll.total} vs Defense ${groupTarget.defense}.`);
          continue;
        }
        const baseDamage = Math.max(1, Number(ability.damage) || 1);
        const reducedDamage = Math.max(1, baseDamage - extraPlayerDefense);
        const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability.critical_multiplier || 2)) : reducedDamage;
        applyEnemyDamageToTarget(groupTarget, damage, roll.critical);
        pushStatusIndicator(groupTarget.kind === "player" ? "player" : "companion", ability.status_effect, ability.effect_amount, groupTarget.kind === "companion" ? groupTarget.companion.key : null);
        applyEnemyAbilityStatusToTarget(ability, groupTarget);
        if (groupTarget.kind === "player") {
          playerDamage += damage;
        }
        logs.push(`${enemyName} hits ${groupTargetName} for ${roll.critical ? "Critical " : ""}${damage}.`);
      }
      return { damage: playerDamage, log: logs };
    }

    const statBonus = getEnemyStatAttackBonus(enemy, ability.required_attribute);
    const roll = rollD20Attack(statBonus, Number(ability.attack_bonus ?? 0) + getEnemyAttackBonus(enemy) - attackPenalty, targetDefense, ability.critical_chance, ability.critical_multiplier);
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
    applyEnemyAbilityStatusToTarget(ability, target);
    return { damage: target.kind === "player" ? damage : 0, log: [`${enemyName} uses ${ability.name} on ${targetName} for ${roll.critical ? "Critical " : ""}${damage}.${statusText}`] };
  }

  function chooseEnemyTarget(equippedItems: Record<string, ItemDefinition | null>, extraDefense = 0): { kind: "player"; defense: number } | { kind: "companion"; companion: BattleCompanionState; defense: number } {
    const pool = getEnemySideTargets(equippedItems, extraDefense);
    return pool[Math.floor(Math.random() * pool.length)] ?? { kind: "player", defense: getPlayerDefense(equippedItems, extraDefense) };
  }

  function getEnemySideTargets(equippedItems: Record<string, ItemDefinition | null>, extraDefense = 0): Array<{ kind: "player"; defense: number } | { kind: "companion"; companion: BattleCompanionState; defense: number }> {
    const livingCompanions = battleCompanions.filter((companion) => companion.hp > 0);
    return [
      { kind: "player" as const, defense: getPlayerDefense(equippedItems, extraDefense) },
      ...livingCompanions.map((companion) => ({ kind: "companion" as const, companion, defense: getCompanionDefense(companion) })),
    ];
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
    return Number(activeEnemy?.defense ?? 10) + Number(activeEnemy?.armor_rating ?? 0) + getEnemyDefenseEffectBonus(selectedOpponentKey);
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

  function getEnemyDefenseEffectBonus(targetKey: string | null | undefined) {
    if (!targetKey) {
      return 0;
    }
    return (enemyTimedEffects[targetKey] ?? []).reduce((sum, effect) => effect.status === "shield" ? sum + effect.amount : sum, 0);
  }

  function consumePlayerStun() {
    const stun = playerTimedEffects.find((effect) => effect.status === "stun" && effect.turns > 0);
    if (!stun) {
      return false;
    }
    setPlayerTimedEffects((current) => current
      .map((effect) => effect.status === "stun" ? { ...effect, turns: effect.turns - 1 } : effect)
      .filter((effect) => effect.turns > 0));
    pushCombatIndicator("player", "STUNNED", "#9ca3af");
    return true;
  }

  function applyEnemyAbilityStatusToTarget(ability: NonNullable<EnemyWithLoadout["abilities"][number]["ability"]>, target: ReturnType<typeof chooseEnemyTarget>) {
    const status = ability.status_effect;
    if (!status || status === "none") {
      return;
    }

    const effect: BattleTimedEffect = {
      status,
      amount: status === "stun" ? Math.max(1, Number(ability.effect_amount ?? 1) || 1) : Math.max(1, Number(ability.effect_amount ?? 0) || 1),
      turns: Math.max(1, Number(ability.effect_duration ?? ability.duration_turns ?? 1) || 1),
      source: ability.name,
    };

    if (target.kind === "player") {
      addPlayerTimedEffect(effect);
    }
  }

  function getBattleAbilityKey(ability: AbilityDefinition) {
    return ability.adminAbility?.id ?? ability.key;
  }

  function setAbilityCooldownAfterUse(ability: AbilityDefinition) {
    const cooldown = Math.max(0, Number(ability.adminAbility?.cooldown_turns ?? 0));
    if (cooldown <= 0) {
      return;
    }
    setBattleAbilityCooldowns((current) => ({ ...current, [getBattleAbilityKey(ability)]: cooldown }));
  }

  function finishEnemyExchange() {
    setBattleTurnPhase("player");
    tickSummonDurations();
    setBattleAbilityCooldowns((current) => {
      const entries = Object.entries(current)
        .map(([key, turns]) => [key, Math.max(0, Number(turns) - 1)] as const)
        .filter(([, turns]) => turns > 0);
      return Object.fromEntries(entries);
    });
  }

  function addPlayerTimedEffect(effect: BattleTimedEffect) {
    setPlayerTimedEffects((current) => mergeTimedEffects(current, effect));
  }

  function addEnemyTimedEffect(targetKey: string | null | undefined, effect: BattleTimedEffect) {
    if (!targetKey) {
      return;
    }
    setEnemyTimedEffects((current) => ({
      ...current,
      [targetKey]: mergeTimedEffects(current[targetKey] ?? [], effect),
    }));
  }

  function mergeTimedEffects(current: BattleTimedEffect[], incoming: BattleTimedEffect[]) : BattleTimedEffect[];
  function mergeTimedEffects(current: BattleTimedEffect[], incoming: BattleTimedEffect) : BattleTimedEffect[];
  function mergeTimedEffects(current: BattleTimedEffect[], incoming: BattleTimedEffect | BattleTimedEffect[]) {
    const incomingItems = Array.isArray(incoming) ? incoming : [incoming];
    const next = [...current];
    for (const effect of incomingItems) {
      const existingIndex = next.findIndex((item) => item.status === effect.status && item.source === effect.source);
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          amount: Math.max(next[existingIndex].amount, effect.amount),
          turns: Math.max(next[existingIndex].turns, effect.turns),
        };
      } else {
        next.push(effect);
      }
    }
    return next.filter((effect) => effect.turns > 0);
  }

  function buildTimedEffect(ability: AbilityDefinition): BattleTimedEffect | null {
    const status = ability.adminAbility?.status_effect;

    if (!status || status === "none") {
      return null;
    }

    const amount = Number(ability.adminAbility?.effect_amount ?? 0);
    const duration = Math.max(1, Number(ability.adminAbility?.effect_duration ?? ability.adminAbility?.duration_turns ?? 1) || 1);
    if (amount <= 0 && status !== "stun") {
      return null;
    }
    return {
      status,
      amount: status === "stun" && amount <= 0 ? 1 : amount,
      turns: duration,
      source: ability.name,
    };
  }

  function applySelfStatusOrDefense(ability: AbilityDefinition, log: string[]) {
    let immediateDefense = 0;
    const defenseAmount = Math.max(0, Number(ability.adminAbility?.defense_amount ?? 0));
    const duration = Math.max(1, Number(ability.adminAbility?.duration_turns ?? ability.adminAbility?.effect_duration ?? 1) || 1);
    if (defenseAmount > 0) {
      immediateDefense += defenseAmount;
      if (duration > 1) {
        addPlayerTimedEffect({ status: "shield", amount: defenseAmount, turns: duration - 1, source: ability.name });
      }
      pushCombatIndicator("player", `Shield +${defenseAmount}`, "#7dd3fc");
      log.push(`${ability.name} adds +${defenseAmount} Defense for ${duration} turn${duration === 1 ? "" : "s"}.`);
    }

    const effect = buildTimedEffect(ability);
    if (!effect) {
      return immediateDefense;
    }

    if (effect.status === "shield") {
      immediateDefense += effect.amount;
      if (effect.turns > 1) {
        addPlayerTimedEffect({ ...effect, turns: effect.turns - 1 });
      }
      pushStatusIndicator("player", effect.status, effect.amount);
      log.push(`${effect.status} applied for ${effect.turns} turn${effect.turns === 1 ? "" : "s"}.`);
    } else if (effect.status === "regen") {
      addPlayerTimedEffect(effect);
      pushStatusIndicator("player", effect.status, effect.amount);
      log.push(`${effect.status} applied for ${effect.turns} turn${effect.turns === 1 ? "" : "s"}.`);
    }

    return immediateDefense;
  }

  function applyAbilityStatusToTarget(ability: AbilityDefinition, target: CombatIndicator["target"], log: string[], targetKey?: string | null) {
    const effect = buildTimedEffect(ability);

    if (!effect) {
      return;
    }

    if (target === "enemy") {
      addEnemyTimedEffect(targetKey, effect);
    } else if (target === "player") {
      addPlayerTimedEffect(effect);
    }

    pushStatusIndicator(target, effect.status, effect.amount, targetKey);
    log.push(`${effect.status} applied for ${effect.turns} turn${effect.turns === 1 ? "" : "s"}.`);
  }

  function tickPlayerTimedEffects(log: string[]) {
    let defenseBonus = 0;
    let attackPenalty = 0;
    let healing = 0;
    const nextEffects: BattleTimedEffect[] = [];

    for (const effect of playerTimedEffects) {
      if (effect.status === "shield") {
        defenseBonus += effect.amount;
      } else if (effect.status === "weakness" || effect.status === "slow") {
        attackPenalty += effect.amount;
      } else if (effect.status === "regen") {
        healing += effect.amount;
      }

      if (effect.turns > 1) {
        nextEffects.push({ ...effect, turns: effect.turns - 1 });
      }
    }

    if (healing > 0) {
      pushCombatIndicator("player", `+${healing}`, "#42d77d");
      log.push(`Regeneration restores ${healing} Health.`);
    }

    setPlayerTimedEffects(nextEffects);
    return { defenseBonus, attackPenalty, healing };
  }

  function tickEnemyTimedEffects(opponent: BattleOpponentState, effectsByTarget: Record<string, BattleTimedEffect[]>, log: string[]) {
    const effects = effectsByTarget[opponent.key] ?? [];
    let damage = 0;
    let healing = 0;
    let attackPenalty = 0;
    let defenseBonus = 0;
    let skipTurn = false;
    const nextEffects: BattleTimedEffect[] = [];

    for (const effect of effects) {
      if (effect.status === "poison" || effect.status === "burn") {
        damage += effect.amount;
        pushStatusIndicator("enemy", effect.status, effect.amount, opponent.key);
      } else if (effect.status === "stun") {
        skipTurn = true;
      } else if (effect.status === "weakness" || effect.status === "slow") {
        attackPenalty += effect.amount;
      } else if (effect.status === "regen") {
        healing += effect.amount;
        pushStatusIndicator("enemy", effect.status, effect.amount, opponent.key);
      } else if (effect.status === "shield") {
        defenseBonus += effect.amount;
      }

      if (effect.turns > 1) {
        nextEffects.push({ ...effect, turns: effect.turns - 1 });
      }
    }

    const nextHp = Math.max(0, Math.min(Number(opponent.enemy?.health ?? activeBattle?.enemy_hp ?? 30), opponent.hp + healing - damage));
    if (damage > 0) {
      updateOpponent(opponent.key, { hp: nextHp });
      log.push(`${opponent.enemy?.name || "Enemy"} takes ${damage} lingering damage.`);
    }
    if (healing > 0) {
      updateOpponent(opponent.key, { hp: nextHp });
      log.push(`${opponent.enemy?.name || "Enemy"} regenerates ${healing} Health.`);
    }

    return {
      nextHp,
      skipTurn,
      attackPenalty,
      defenseBonus,
      effects: {
        ...effectsByTarget,
        [opponent.key]: nextEffects,
      },
    };
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
    log.push("No Revive Scroll found. Choose how to continue from the battle result.");
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
      finishEnemyExchange();
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
    battleAbilityCooldowns,
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
