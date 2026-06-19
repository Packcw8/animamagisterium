import { Dispatch, SetStateAction, useState } from "react";
import { AbilityDefinition, CharacterResources, getCharacterResources } from "../../services/abilityService";
import { CharacterWithDetails } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout, getEnemyLoadout, getNpcLoadout, resolveEnemyImageUri } from "../../services/combatAdminService";
import { ItemDefinition } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
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

export function useBattleEncounter(character: CharacterWithDetails) {
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
  const [combatIndicators, setCombatIndicators] = useState<CombatIndicator[]>([]);
  const [combatResources, setCombatResources] = useState<CharacterResources>(() => getCharacterResources(character));
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [battleInventoryOpen, setBattleInventoryOpen] = useState(false);

  function resetBattleState() {
    setActiveBattle(null);
    setActiveEnemy(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setBattleLog([]);
    setCombatIndicators([]);
  }

  async function startBattle(event: MapEvent, options: StartBattleOptions) {
    const { preview = false, currentHealth, combatResources: nextCombatResources, setActiveEvent, setAdminPreviewMode, setAdminMessage } = options;

    try {
      const enemy = event.enemy_id ? await getEnemyLoadout(event.enemy_id) : null;
      const npcEnemy = !enemy && event.npc_id ? await getNpcLoadout(event.npc_id) : null;
      const opponent = enemy ?? npcEnemy;

      if (event.enemy_id && !enemy) {
        setAdminMessage("Battle enemy could not be loaded from Enemy Admin. Check the selected enemy.");
        setBattleLog(["Battle enemy could not be loaded from Enemy Admin. Check the selected enemy."]);
        return;
      }

      if (event.npc_id && !npcEnemy) {
        setAdminMessage("Battle NPC could not be loaded from NPC Admin. Check the selected NPC.");
        setBattleLog(["Battle NPC could not be loaded from NPC Admin. Check the selected NPC."]);
        return;
      }

      const enemyImage = resolveEnemyImageUri(opponent?.image_url ?? event.enemy_image_url);
      setActiveEvent(null);
      setActiveBattle(event);
      setAdminPreviewMode(preview ? "battle" : null);
      setActiveEnemy(opponent);
      setCombatIndicators([]);
      setBattlePlayerHp(currentHealth);
      setBattleStamina(nextCombatResources.maxStamina);
      setBattleMagicka(nextCombatResources.maxMagicka);
      setBattleEnemyHp(Number(opponent?.health ?? event.enemy_hp) || 30);
      setBattleEnemyStamina(Number(opponent?.stamina ?? 0) || 0);
      setBattleEnemyMagika(Number(opponent?.magika ?? 0) || 0);
      setBattleFinished(null);
      setRevivePromptOpen(false);
      setBattleInventoryOpen(false);
      setBattleLog([
        event.battle_intro_text || `${opponent?.name || event.enemy_name || "An enemy"} blocks the trail.`,
        opponent?.id ? `Loaded ${opponent.abilities.length} abilities and ${opponent.drops.length} drop entries from Admin.` : "Using manual battle enemy data.",
        enemyImage ? "Enemy image ready." : "Enemy image missing. A placeholder will be shown.",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load battle enemy data.";
      setAdminMessage(message);
      setBattleLog([message]);
    }
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
  };
}
