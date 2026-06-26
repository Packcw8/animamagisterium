import { AbilityDefinition, CharacterResources } from "../../services/abilityService";
import { CharacterWithDetails } from "../../services/characterService";
import { EnemyWithLoadout, NpcWithLoadout } from "../../services/combatAdminService";
import { getBattleUsableItems, InventoryItem, ItemDefinition } from "../../services/inventoryService";
import { MapEvent } from "../../services/mapService";
import { GameToast, type GameToastData } from "../map/GameToast";
import { BattleEventScreen } from "./BattleEventScreen";
import { type CombatIndicator } from "./BattleDisplay";
import { type BattleOpponentState } from "./useBattleEncounter";

type ActiveBattleViewProps = {
  character: CharacterWithDetails;
  activeBattle: MapEvent;
  playerHp: number;
  stamina: number;
  mana: number;
  resources: CharacterResources;
  enemyHp: number;
  enemyStamina: number;
  enemyMana: number;
  activeEnemy: EnemyWithLoadout | NpcWithLoadout | null;
  opponents: BattleOpponentState[];
  selectedOpponentKey: string | null;
  equippedAbilities: Array<AbilityDefinition | null>;
  equippedWeapon: ItemDefinition | null;
  inventoryItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  combatIndicators: CombatIndicator[];
  revivePromptOpen: boolean;
  result: "victory" | "defeat" | null;
  previewMode: boolean;
  toast: GameToastData | null;
  onAction: (ability: AbilityDefinition) => void;
  onSelectOpponent: (opponentKey: string) => void;
  onWeaponAction: (weapon: ItemDefinition) => void;
  onFlee: () => void;
  onUseItem: (item: InventoryItem) => void;
  onToggleInventory: () => void;
  onDeclineRevive: () => void;
  onReturnToStart: () => void;
  onComplete: () => void;
  onExitPreview: () => void;
  onDismissToast: () => void;
};

export function ActiveBattleView({
  character,
  activeBattle,
  playerHp,
  stamina,
  mana,
  resources,
  enemyHp,
  enemyStamina,
  enemyMana,
  activeEnemy,
  opponents,
  selectedOpponentKey,
  equippedAbilities,
  equippedWeapon,
  inventoryItems,
  inventoryOpen,
  battleLog,
  combatIndicators,
  revivePromptOpen,
  result,
  previewMode,
  toast,
  onAction,
  onSelectOpponent,
  onWeaponAction,
  onFlee,
  onUseItem,
  onToggleInventory,
  onDeclineRevive,
  onReturnToStart,
  onComplete,
  onExitPreview,
  onDismissToast,
}: ActiveBattleViewProps) {
  return (
    <>
      <BattleEventScreen
        character={character}
        event={activeBattle}
        playerHp={playerHp}
        stamina={stamina}
        magicka={mana}
        resources={resources}
        enemyHp={enemyHp}
        enemyStamina={enemyStamina}
        enemyMana={enemyMana}
        activeEnemy={activeEnemy}
        opponents={opponents}
        selectedOpponentKey={selectedOpponentKey}
        equippedAbilities={equippedAbilities}
        weapon={equippedWeapon}
        battleItems={getBattleUsableItems(inventoryItems, playerHp <= 0 || result === "defeat")}
        inventoryOpen={inventoryOpen}
        battleLog={battleLog}
        combatIndicators={combatIndicators}
        revivePromptOpen={revivePromptOpen}
        result={result}
        previewMode={previewMode}
        onAction={onAction}
        onSelectOpponent={onSelectOpponent}
        onWeaponAction={onWeaponAction}
        onFlee={onFlee}
        onUseItem={onUseItem}
        onToggleInventory={onToggleInventory}
        onDeclineRevive={onDeclineRevive}
        onReturnToStart={onReturnToStart}
        onComplete={onComplete}
        onExitPreview={onExitPreview}
      />
      <GameToast toast={toast} onDismiss={onDismissToast} />
    </>
  );
}
