import { Dispatch, SetStateAction, useState } from "react";
import { AbilityDefinition, CharacterResources, clampHealth, getCharacterResources } from "../../services/abilityService";
import { CharacterWithDetails, updateCharacterHealth } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, getEnemyLoadout, getNpcLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { BattleEventCombatant, MarkerBattleCombatant, getBattleEventCombatants, getMarkerBattleCombatants } from "../../services/battlefieldService";
import { InventoryItem, ItemDefinition, consumeInventoryItem, getInventoryResourceBonuses, isReviveBattleItem } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { chooseWeightedEnemyAbility, getDefenseAttributeBonus, rollD20Attack } from "../../utils/combatMath";
import { type CombatIndicator } from "./BattleDisplay";

type PreviewMode = "story" | "battle" | null;

type StartBattleOptions = {
  preview?: boolean;
  currentHealth: number;
  combatResources: CharacterResources;
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
  const [revivePromptOpen, setRevivePromptOpen] = useState(false);
  const [activeEnemy, setActiveEnemy] = useState<EnemyWithLoadout | NpcWithLoadout | null>(null);
  const [battleOpponents, setBattleOpponents] = useState<BattleOpponentState[]>([]);
  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string | null>(null);
  const [combatIndicators, setCombatIndicators] = useState<CombatIndicator[]>([]);
  const [combatResources, setCombatResources] = useState<CharacterResources>(() => getCharacterResources(character));
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [battleInventoryOpen, setBattleInventoryOpen] = useState(false);

  function resetBattleState() {
    setActiveBattle(null);
    setActiveEnemy(null);
    setBattleOpponents([]);
    setSelectedOpponentKey(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setBattleLog([]);
    setCombatIndicators([]);
  }

  async function startBattle(event: MapEvent, options: StartBattleOptions): Promise<StartBattleResult> {
    const { preview = false, currentHealth, combatResources: nextCombatResources, setActiveEvent, setAdminPreviewMode, setAdminMessage } = options;

    try {
      const enemy = event.enemy_id ? await getEnemyLoadout(event.enemy_id) : null;
      const npcEnemy = !enemy && event.npc_id ? await getNpcLoadout(event.npc_id) : null;
      const opponent = enemy ?? npcEnemy;

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

      const stagedOpponents = await loadStagedOpponents(event);
      const fallbackOpponent = stagedOpponents.length === 0
        ? [{
          key: "primary",
          combatant: null,
          enemy: opponent,
          hp: Number(opponent?.health ?? event.enemy_hp) || 30,
          stamina: Number(opponent?.stamina ?? 0) || 0,
          magika: Number(opponent?.magika ?? 0) || 0,
        }]
        : stagedOpponents;
      const firstOpponent = fallbackOpponent[0];
      const selectedEnemy = firstOpponent?.enemy ?? opponent;
      const enemyImage = resolveEnemyImageUri(selectedEnemy?.image_url ?? event.enemy_image_url);
      setActiveEvent(null);
      setActiveBattle(event);
      setAdminPreviewMode(preview ? "battle" : null);
      setActiveEnemy(selectedEnemy);
      setBattleOpponents(fallbackOpponent);
      setSelectedOpponentKey(firstOpponent?.key ?? null);
      setCombatIndicators([]);
      setBattlePlayerHp(currentHealth);
      setBattleStamina(nextCombatResources.maxStamina);
      setBattleMagicka(nextCombatResources.maxMagicka);
      setBattleEnemyHp(firstOpponent?.hp ?? (Number(opponent?.health ?? event.enemy_hp) || 30));
      setBattleEnemyStamina(firstOpponent?.stamina ?? (Number(opponent?.stamina ?? 0) || 0));
      setBattleEnemyMagika(firstOpponent?.magika ?? (Number(opponent?.magika ?? 0) || 0));
      setBattleFinished(null);
      setRevivePromptOpen(false);
      setBattleInventoryOpen(false);
      setBattleLog([
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

  async function loadStagedOpponents(event: MapEvent): Promise<BattleOpponentState[]> {
    try {
      const eventStaged = await getBattleEventCombatants(event.id);
      const markerStaged = eventStaged.length > 0 ? [] : await getMarkerBattleCombatants(event.id);
      const staged = eventStaged.length > 0 ? eventStaged : markerStaged;
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

  function pushCombatIndicator(target: CombatIndicator["target"], text: string, color: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCombatIndicators((current) => [...current, { id, target, text, color }].slice(-8));
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
    if (!activeBattle || battleFinished) {
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
      const counter = resolveEnemyCounterAttack(context);
      const nextPlayerHp = Math.max(0, Math.min(combatResources.maxHp, battlePlayerHp + healthRestore) - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const enemyDefense = getEnemyDefense();
    const attackRoll = rollD20Attack(getAbilityAttributeLevel(ability, "player"), getAbilityAttackBonus(ability), enemyDefense, ability.adminAbility?.critical_chance ?? 0, ability.adminAbility?.critical_multiplier ?? 2);
    const nextLog = [`${ability.name}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${ability.name} misses.`);
      const counter = resolveEnemyCounterAttack(context);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
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

    const counter = resolveEnemyCounterAttack(context);
    const nextPlayerHp = Math.max(0, postAbilityPlayerHp - counter.damage);
    nextLog.push(...counter.log);

    markSelectedOpponentHp(nextEnemyHp);
    await savePlayerHealth(nextPlayerHp, context.previewMode);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog, context);
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  async function handleWeaponAction(weapon: ItemDefinition, context: BattleActionContext) {
    if (!activeBattle || battleFinished) {
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
    const attackRoll = rollD20Attack(character.attributes?.strength ?? 0, bonuses.damage, enemyDefense, 0, 2);
    const actionName = weapon.ability_name || weapon.name;
    const nextLog = [`${actionName}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${actionName} misses.`);
      const counter = resolveEnemyCounterAttack(context);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp, context.previewMode);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog, context);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const weaponDamage = Number(weapon.damage_amount ?? 0) + Number(weapon.elemental_damage_amount ?? 0) + bonuses.damage + Math.floor((character.attributes?.strength ?? 0) / 2);
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

    const counter = resolveEnemyCounterAttack(context);
    const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
    nextLog.push(...counter.log);
    markSelectedOpponentHp(nextEnemyHp);
    await savePlayerHealth(nextPlayerHp, context.previewMode);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog, context);
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
    setActiveBattle(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    context.setGpsMessage("You escaped. No rewards were granted.");
  }

  function resolveEnemyCounterAttack(context: BattleActionContext, extraPlayerDefense = 0) {
    const enemyName = activeEnemy?.name || activeBattle?.enemy_name || "Enemy";
    const ability = chooseWeightedEnemyAbility(activeEnemy, battleEnemyStamina, battleEnemyMagika, battleEnemyHp);
    const playerDefense = getPlayerDefense(context.equippedItems, extraPlayerDefense);

    if (!ability) {
      const roll = rollD20Attack(Number(activeEnemy?.strength ?? 0), getEnemyAttackBonus(), playerDefense, 0, 2);
      if (!roll.hit) {
        pushCombatIndicator("player", "MISS", "#9ca3af");
        return { damage: 0, log: [`${enemyName} misses. d20 ${roll.roll} + bonuses = ${roll.total} vs Defense ${playerDefense}.`] };
      }
      const damage = Math.max(1, (Number(activeBattle?.enemy_attack_damage) || 5) - extraPlayerDefense);
      const totalDamage = roll.critical ? Math.ceil(damage * 2) : damage;
      pushCombatIndicator("player", roll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, roll.critical ? "#f6d365" : "#ff5c5c");
      return { damage: totalDamage, log: [`${enemyName} hits for ${roll.critical ? "Critical " : ""}${totalDamage}.`] };
    }

    if (ability.stamina_cost > 0) {
      setBattleEnemyStamina((current) => Math.max(0, current - ability.stamina_cost));
    }
    if (ability.magika_cost > 0) {
      setBattleEnemyMagika((current) => Math.max(0, current - ability.magika_cost));
    }

    if (ability.type === "heal") {
      const logs: string[] = [];
      const healing = Math.max(0, Number(ability.healing) || 0);
      const staminaRestore = Math.max(0, Number(ability.stamina_restore) || 0);
      const magikaRestore = Math.max(0, Number(ability.magika_restore) || 0);
      if (healing > 0) {
        setBattleEnemyHp((current) => {
          const next = Math.min(Number(activeEnemy?.health ?? activeBattle?.enemy_hp ?? 30), current + healing);
          updateSelectedOpponent({ hp: next });
          return next;
        });
        pushCombatIndicator("enemy", `+${healing}`, "#42d77d");
        logs.push(`${enemyName} heals ${healing}.`);
      }
      if (staminaRestore > 0) {
        setBattleEnemyStamina((current) => Math.min(Number(activeEnemy?.stamina ?? 0), current + staminaRestore));
        pushCombatIndicator("enemy", `+${staminaRestore} Stamina`, "#3b82f6");
        logs.push(`${enemyName} restores ${staminaRestore} Stamina.`);
      }
      if (magikaRestore > 0) {
        setBattleEnemyMagika((current) => Math.min(Number(activeEnemy?.magika ?? 0), current + magikaRestore));
        pushCombatIndicator("enemy", `+${magikaRestore} Mana`, "#7dd3fc");
        logs.push(`${enemyName} restores ${magikaRestore} Mana.`);
      }
      return { damage: 0, log: [`${enemyName} uses ${ability.name}.`, ...(logs.length > 0 ? logs : ["No restore amount is configured."])] };
    }

    if (ability.type === "defense" || ability.type === "buff" || ability.type === "passive") {
      return { damage: 0, log: [`${enemyName} uses ${ability.name}. ${ability.status_effect !== "none" ? `Status: ${ability.status_effect}.` : "It braces for the next exchange."}`] };
    }

    const statBonus = Number(activeEnemy?.strength ?? 0);
    const roll = rollD20Attack(statBonus, Number(ability.attack_bonus ?? 0) + getEnemyAttackBonus(), playerDefense, ability.critical_chance, ability.critical_multiplier);
    if (!roll.hit) {
      pushCombatIndicator("player", "MISS", "#9ca3af");
      return { damage: 0, log: [`${enemyName} uses ${ability.name} and misses. d20 ${roll.roll} + bonuses = ${roll.total} vs Defense ${playerDefense}.`] };
    }

    const baseDamage = Math.max(1, Number(ability.damage) || 1);
    const reducedDamage = Math.max(1, baseDamage - extraPlayerDefense);
    const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability.critical_multiplier || 2)) : reducedDamage;
    const statusText = ability.status_effect !== "none" ? ` ${ability.status_effect} may linger.` : "";
    pushCombatIndicator("player", roll.critical ? `CRITICAL -${damage}` : `-${damage}`, roll.critical ? "#f6d365" : "#ff5c5c");
    pushStatusIndicator("player", ability.status_effect, ability.effect_amount);
    return { damage, log: [`${enemyName} uses ${ability.name} for ${roll.critical ? "Critical " : ""}${damage}.${statusText}`] };
  }

  function getPlayerDefense(equippedItems: Record<string, ItemDefinition | null>, extraDefense = 0) {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return 10 + getDefenseAttributeBonus(character.attributes?.endurance ?? 0) + getDefenseAttributeBonus(character.attributes?.agility ?? 0) + bonuses.defense + extraDefense;
  }

  function getEnemyDefense() {
    return Number(activeEnemy?.defense ?? 10) + getDefenseAttributeBonus(Number(activeEnemy?.endurance ?? 0)) + getDefenseAttributeBonus(Number(activeEnemy?.agility ?? 0)) + Number(activeEnemy?.armor_rating ?? 0);
  }

  function getEnemyAttackBonus() {
    return Number(activeEnemy?.attack_bonus ?? 0);
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

  function pushStatusIndicator(target: CombatIndicator["target"], status: string | null | undefined, amount: number) {
    if (!status || status === "none" || amount <= 0) {
      return;
    }

    if (status === "poison") {
      pushCombatIndicator(target, `Poison -${amount}`, "#b55cff");
    } else if (status === "burn") {
      pushCombatIndicator(target, `Burn -${amount}`, "#ff8a2a");
    } else if (status === "regen") {
      pushCombatIndicator(target, `+${amount}`, "#42d77d");
    }
  }

  async function resolvePlayerDefeat(log: string[], context: BattleActionContext) {
    setBattleFinished("defeat");
    await savePlayerHealth(1, context.previewMode);
    log.push(activeBattle?.defeat_text || "Defeat.");

    if (context.previewMode) {
      setRevivePromptOpen(false);
      log.push("Preview defeat. No route progress or Health was changed.");
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
    selectedOpponentKey,
    battleLog,
    setBattleLog,
    battleFinished,
    setBattleFinished,
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
    fleeBattle,
    declineReviveAfterDefeat,
    useBattleItem,
  };
}
