import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { PlayerAbilitiesPanel } from "../components/home/PlayerAbilitiesPanel";
import { PlayerInventoryPanel } from "../components/home/PlayerInventoryPanel";
import { CharacterAbilitiesSheet } from "../components/player/CharacterAbilitiesSheet";
import { CharacterInventorySheet } from "../components/player/CharacterInventorySheet";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { pickAndUploadAdminImage } from "../services/adminImageService";
import { CharacterWithDetails, updateCharacterHealth } from "../services/characterService";
import { AbilityDefinition, canUseAbilityInContext, clampHealth, equipAbility, getAbilityCostLabel, getAbilitySourceLabel, getCombatLoadout, getCharacterResources, getCurrentHealth, learnAbilityFromScroll } from "../services/abilityService";
import {
  blankCombatAbility,
  blankEnemy,
  blankNpc,
  combatAbilityTypes,
  CombatAbility,
  deleteCombatAbility,
  deleteEnemy,
  deleteEnemyAbility,
  deleteEnemyDrop,
  deleteNpc,
  deleteNpcAbility,
  deleteNpcDrop,
  EnemyAbility,
  EnemyDefinition,
  EnemyItemDrop,
  NpcAbility,
  NpcDefinition,
  NpcItemDrop,
  getCombatAbilities,
  getEnemyLoadout,
  getEnemies,
  getNpcLoadout,
  getNpcs,
  learnMethods,
  linkedStats,
  requiredAttributes,
  requiredClassKeys,
  resolveEnemyImageUri,
  saveCombatAbility,
  saveEnemy,
  saveEnemyAbility,
  saveEnemyDrop,
  saveNpc,
  saveNpcAbility,
  saveNpcDrop,
  statusEffects,
  usageContexts as abilityUsageContexts,
} from "../services/combatAdminService";
import { classCombinations } from "../services/classService";
import {
  blankItemDefinition,
  boostTargets,
  buffTargets,
  costTypes,
  consumeInventoryItem,
  deleteItemDefinition,
  elementalTypes,
  equipmentSlots,
  equipInventoryItem,
  getCarrySettings,
  getInventoryResourceBonuses,
  getInventoryState,
  grantItemToCharacter,
  InventoryItem,
  canUseItemInContext,
  isHealingConsumable,
  itemTypes,
  onHitEffects,
  potionTargets,
  rarityOptions,
  resolveAbilityImageUri,
  resolveInventoryImageUri,
  saveCarrySettings,
  saveItemDefinition,
  unequipInventorySlot,
  usageContexts as itemUsageContexts,
  ItemDefinition,
} from "../services/inventoryService";
import { getCurrentRole, Role } from "../services/mapService";
import { getLeaderboardProfileForCharacter } from "../services/leaderboardService";
import { getInboxUnreadCount } from "../services/inboxService";
import { defaultProgressionSettings, GameProgressionSettings, getCharacterXpProgress, getProgressionSettings } from "../services/progressionService";

type HomeScreenProps = {
  character: CharacterWithDetails;
  onCharacterUpdated: (character: CharacterWithDetails) => void;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
};

const homeTabs = ["Overview", "Identity", "Attributes", "Battle Stats", "Abilities", "Inventory"] as const;
const attributeKeys = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"] as const;
const inventoryCategoryTabs = ["Weapons", "Armor", "Wearables", "Consumables", "Materials", "Special", "Misc"] as const;
const abilityTypeTabs = ["Attack", "Heal", "Buff", "Debuff", "Defense", "Passive"] as const;
const adminToolTabs = ["Items", "Abilities", "Enemies", "NPCs"] as const;
const abilityCostResources = ["none", "stamina", "mana", "health"] as const;
const enemyBalanceProfiles = ["minion", "standard", "elite", "boss"] as const;
type AbilityCostResource = (typeof abilityCostResources)[number];
type EnemyBalanceProfile = (typeof enemyBalanceProfiles)[number];
const abilityCostResourceLabels: Record<AbilityCostResource, string> = {
  none: "No Cost",
  stamina: "Stamina",
  mana: "Mana",
  health: "Health",
};
const enemyBalanceLabels: Record<EnemyBalanceProfile, string> = {
  minion: "Minion",
  standard: "Standard",
  elite: "Elite",
  boss: "Boss",
};

function getAbilityCostResource(ability: Partial<CombatAbility>): AbilityCostResource {
  if ((ability.magika_cost ?? 0) > 0) return "mana";
  if ((ability.stamina_cost ?? 0) > 0) return "stamina";
  if ((ability.health_cost ?? 0) > 0) return "health";
  return "none";
}

function getAbilityCostAmount(ability: Partial<CombatAbility>) {
  const resource = getAbilityCostResource(ability);

  if (resource === "mana") return ability.magika_cost ?? 0;
  if (resource === "stamina") return ability.stamina_cost ?? 0;
  if (resource === "health") return ability.health_cost ?? 0;
  return 0;
}

function setAbilityCost(current: Partial<CombatAbility>, resource: AbilityCostResource, amount: number): Partial<CombatAbility> {
  const safeAmount = Math.max(0, Number(amount) || 0);

  return {
    ...current,
    stamina_cost: resource === "stamina" ? safeAmount : 0,
    magika_cost: resource === "mana" ? safeAmount : 0,
    health_cost: resource === "health" ? safeAmount : 0,
  };
}

export function HomeScreen({ character, onCharacterUpdated, onOpenInbox, onOpenSettings }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<(typeof homeTabs)[number]>("Overview");
  const [activeSheet, setActiveSheet] = useState<"inventory" | "abilities" | null>(null);
  const [unlockedAbilities, setUnlockedAbilities] = useState<AbilityDefinition[]>([]);
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);
  const [playerAbilityTab, setPlayerAbilityTab] = useState<(typeof abilityTypeTabs)[number]>("Attack");
  const [selectedPlayerAbility, setSelectedPlayerAbility] = useState<AbilityDefinition | null>(null);
  const [selectedAdminAbilityId, setSelectedAdminAbilityId] = useState<string | null>(null);
  const [abilityTypeTab, setAbilityTypeTab] = useState<(typeof abilityTypeTabs)[number]>("Attack");
  const [abilityMessage, setAbilityMessage] = useState<string | null>(null);
  const [adminAbilities, setAdminAbilities] = useState<CombatAbility[]>([]);
  const [abilityForm, setAbilityForm] = useState<Partial<CombatAbility>>(blankCombatAbility());
  const [abilityCostResource, setAbilityCostResource] = useState<AbilityCostResource>("none");
  const [editingAdminAbilityId, setEditingAdminAbilityId] = useState<string | null>(null);
  const [enemies, setEnemies] = useState<EnemyDefinition[]>([]);
  const [enemyForm, setEnemyForm] = useState<Partial<EnemyDefinition>>(blankEnemy());
  const [enemyBalanceProfile, setEnemyBalanceProfile] = useState<EnemyBalanceProfile>("standard");
  const [editingEnemyId, setEditingEnemyId] = useState<string | null>(null);
  const [enemyAbilities, setEnemyAbilities] = useState<EnemyAbility[]>([]);
  const [enemyDrops, setEnemyDrops] = useState<EnemyItemDrop[]>([]);
  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [npcForm, setNpcForm] = useState<Partial<NpcDefinition>>(blankNpc());
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [npcAbilities, setNpcAbilities] = useState<NpcAbility[]>([]);
  const [npcDrops, setNpcDrops] = useState<NpcItemDrop[]>([]);
  const [selectedEnemyAbilityId, setSelectedEnemyAbilityId] = useState<string | null>(null);
  const [enemyAbilityWeight, setEnemyAbilityWeight] = useState("1");
  const [selectedDropItemId, setSelectedDropItemId] = useState<string | null>(null);
  const [dropQuantity, setDropQuantity] = useState("1");
  const [dropChance, setDropChance] = useState("100");
  const [selectedNpcAbilityId, setSelectedNpcAbilityId] = useState<string | null>(null);
  const [npcAbilityWeight, setNpcAbilityWeight] = useState("1");
  const [selectedNpcDropItemId, setSelectedNpcDropItemId] = useState<string | null>(null);
  const [npcDropQuantity, setNpcDropQuantity] = useState("1");
  const [npcDropChance, setNpcDropChance] = useState("100");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [inventoryCategory, setInventoryCategory] = useState<(typeof inventoryCategoryTabs)[number]>("Weapons");
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [adminToolTab, setAdminToolTab] = useState<(typeof adminToolTabs)[number]>("Items");
  const [equippedItems, setEquippedItems] = useState<Record<string, ItemDefinition | null>>({});
  const [totalInventoryWeight, setTotalInventoryWeight] = useState(0);
  const [carryCapacity, setCarryCapacity] = useState(50);
  const [baseCarryWeight, setBaseCarryWeight] = useState("50");
  const [carryWeightPerStrength, setCarryWeightPerStrength] = useState("10");
  const [itemForm, setItemForm] = useState<Partial<ItemDefinition>>(blankItemDefinition());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [distanceWalkedMeters, setDistanceWalkedMeters] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [progressionSettings, setProgressionSettings] = useState<GameProgressionSettings>(defaultProgressionSettings);
  const knownAbilityKeysRef = useRef<Set<string> | null>(null);
  const knownInventoryRef = useRef<Map<string, number> | null>(null);
  const inventoryBonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
  const resources = getCharacterResources(character, {
    maxHp: inventoryBonuses.maxHp,
    maxStamina: inventoryBonuses.maxStamina,
    maxMagicka: inventoryBonuses.maxMagicka,
  });
  const currentHealth = getCurrentHealth(character, resources);
  const isAdmin = role === "admin";
  const visibleHomeTabs = isAdmin ? homeTabs : homeTabs.filter((tab) => tab !== "Abilities" && tab !== "Inventory");
  const playerAbilityCounts = useMemo(() => getAbilityTypeCounts(unlockedAbilities), [unlockedAbilities]);
  const filteredPlayerAbilities = useMemo(() => unlockedAbilities.filter((ability) => getPlayerAbilityType(ability) === playerAbilityTab), [unlockedAbilities, playerAbilityTab]);
  const selectedInventoryItem = useMemo(() => inventoryItems.find((entry) => entry.id === selectedInventoryItemId) ?? null, [inventoryItems, selectedInventoryItemId]);
  const filteredInventoryItems = useMemo(() => inventoryItems.filter((entry) => itemMatchesCategory(entry.item, inventoryCategory)), [inventoryItems, inventoryCategory]);
  const filteredAdminItems = useMemo(() => itemDefinitions.filter((item) => itemMatchesCategory(item, inventoryCategory)), [itemDefinitions, inventoryCategory]);
  const filteredAdminAbilities = useMemo(() => adminAbilities.filter((ability) => ability.type === abilityTypeTab.toLowerCase()), [adminAbilities, abilityTypeTab]);
  const selectedAdminAbility = useMemo(() => adminAbilities.find((ability) => ability.id === selectedAdminAbilityId) ?? filteredAdminAbilities[0] ?? null, [adminAbilities, filteredAdminAbilities, selectedAdminAbilityId]);
  const battleStats = useMemo(
    () => getDerivedBattleStats(character, resources, inventoryBonuses, equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>, totalInventoryWeight, carryCapacity),
    [character, resources, inventoryBonuses, equippedItems, totalInventoryWeight, carryCapacity],
  );
  const characterXpProgress = useMemo(() => getCharacterXpProgress(character.xp, progressionSettings), [character.xp, progressionSettings]);

  useEffect(() => {
    void loadAbilities();
    void loadInventory();
    void loadAdminCombat();
    void loadTravelProgress();
    void loadInboxCount();
    void loadProgressionSettings();
    void getCurrentRole().then(setRole);
  }, [character.id, character.attributes]);

  useEffect(() => {
    setDistanceWalkedMeters(Number(character.total_distance_walked_meters ?? 0));
  }, [character.total_distance_walked_meters]);

  async function loadProgressionSettings() {
    try {
      setProgressionSettings(await getProgressionSettings());
    } catch {
      setProgressionSettings(defaultProgressionSettings);
    }
  }

  async function loadInboxCount() {
    try {
      setInboxUnreadCount(await getInboxUnreadCount());
    } catch {
      setInboxUnreadCount(0);
    }
  }

  async function loadTravelProgress() {
    try {
      const profile = await getLeaderboardProfileForCharacter(character.id);
      setDistanceWalkedMeters(Number(profile?.total_distance_walked_meters ?? character.total_distance_walked_meters ?? 0));
    } catch {
      setDistanceWalkedMeters(Number(character.total_distance_walked_meters ?? 0));
    }
  }

  async function loadAbilities() {
    try {
      let loadout = await getCombatLoadout(character);
      const equippedKeys = new Set(loadout.equipped.filter(Boolean).map((ability) => ability?.key));
      const emptySlots = loadout.equipped
        .map((ability, index) => ({ ability, slot: index + 1 }))
        .filter((entry) => !entry.ability)
        .map((entry) => entry.slot);
      const autoEquipCandidates = loadout.unlocked.filter((ability) => !equippedKeys.has(ability.key)).slice(0, emptySlots.length);

      if (autoEquipCandidates.length > 0) {
        await Promise.all(autoEquipCandidates.map((ability, index) => equipAbility(character.id, emptySlots[index], ability.key)));
        loadout = await getCombatLoadout(character);
        setAbilityMessage(`${autoEquipCandidates.map((ability) => ability.name).join(", ")} added to empty ability slot${autoEquipCandidates.length > 1 ? "s" : ""}.`);
      }

      const currentKeys = new Set(loadout.unlocked.map((ability) => ability.key));
      const previousKeys = knownAbilityKeysRef.current;
      if (previousKeys) {
        const learned = loadout.unlocked.filter((ability) => !previousKeys.has(ability.key));
        if (learned.length > 0) {
          setAbilityMessage(`New ability learned: ${learned.map((ability) => ability.name).join(", ")}.`);
        }
      }
      knownAbilityKeysRef.current = currentKeys;

      setUnlockedAbilities(loadout.unlocked);
      setEquippedAbilities(loadout.equipped);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to load abilities.");
    }
  }

  async function loadAdminCombat() {
    try {
      const [abilities, enemyRows, npcRows] = await Promise.all([getCombatAbilities(), getEnemies(), getNpcs()]);
      setAdminAbilities(abilities);
      setEnemies(enemyRows);
      setNpcs(npcRows);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to load admin combat data.");
    }
  }

  async function loadEnemyDetails(enemyId: string) {
    const loadout = await getEnemyLoadout(enemyId);
    setEnemyAbilities(loadout?.abilities ?? []);
    setEnemyDrops(loadout?.drops ?? []);
  }

  async function loadNpcDetails(npcId: string) {
    const loadout = await getNpcLoadout(npcId);
    setNpcAbilities(loadout?.abilities ?? []);
    setNpcDrops(loadout?.drops ?? []);
  }

  async function saveAdminAbility() {
    try {
      const saved = await saveCombatAbility({ ...abilityForm, id: editingAdminAbilityId ?? undefined });
      setAbilityMessage(`${saved.name} saved.`);
      setAbilityForm(blankCombatAbility());
      setAbilityCostResource("none");
      setEditingAdminAbilityId(null);
      await loadAdminCombat();
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save ability.");
    }
  }

  async function editAdminAbility(ability: CombatAbility) {
    setSelectedAdminAbilityId(ability.id);
    setAbilityTypeTab(toAbilityTypeTab(ability.type));
    setEditingAdminAbilityId(ability.id);
    setAbilityForm(ability);
    setAbilityCostResource(getAbilityCostResource(ability));
  }

  async function removeAdminAbility(id: string) {
    try {
      await deleteCombatAbility(id);
      setAbilityMessage("Ability deleted.");
      await loadAdminCombat();
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to delete ability.");
    }
  }

  async function saveEnemyDefinition() {
    try {
      const saved = await saveEnemy({ ...enemyForm, id: editingEnemyId ?? undefined });
      setAbilityMessage(`${saved.name} saved.`);
      setEnemyForm(saved);
      setEditingEnemyId(saved.id);
      await loadAdminCombat();
      await loadEnemyDetails(saved.id);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save enemy.");
    }
  }

  function applyEnemyBalance(profile: EnemyBalanceProfile) {
    const equipmentBonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    const resources = getCharacterResources(character, equipmentBonuses);
    const attributes = character.attributes;
    const attributeAverage = attributeKeys.reduce((sum, key) => sum + Number(attributes?.[key] ?? 0), 0) / attributeKeys.length;
    const topPhysical = Math.max(Number(attributes?.strength ?? 0), Number(attributes?.agility ?? 0), Number(attributes?.endurance ?? 0));
    const topMental = Math.max(Number(attributes?.intelligence ?? 0), Number(attributes?.wisdom ?? 0), Number(attributes?.spirit ?? 0));
    const playerDefense = 10 + equipmentBonuses.defense;
    const level = Math.max(1, Number(character.level) || 1);
    const profileTuning: Record<EnemyBalanceProfile, { hp: number; attack: number; defense: number; armor: number; xp: number; gold: number; stat: number }> = {
      minion: { hp: 0.55, attack: -3, defense: -2, armor: 0, xp: 0.45, gold: 0.35, stat: 0.55 },
      standard: { hp: 0.9, attack: -1, defense: 0, armor: 0, xp: 1, gold: 0.75, stat: 0.8 },
      elite: { hp: 1.35, attack: 1, defense: 1, armor: 1, xp: 1.75, gold: 1.25, stat: 1.05 },
      boss: { hp: 2.5, attack: 3, defense: 2, armor: 2, xp: 3.25, gold: 2.4, stat: 1.3 },
    };
    const tuning = profileTuning[profile];
    const targetAttackBonus = Math.max(0, Math.round(playerDefense - 11 + tuning.attack));
    const targetDefense = Math.max(8, Math.min(18, 10 + Math.floor(attributeAverage / 8) + tuning.defense));
    const health = Math.max(8, Math.round((resources.maxHp + level * 4 + attributeAverage * 1.5) * tuning.hp));
    const stamina = Math.max(0, Math.round((resources.maxStamina * 0.55 + topPhysical) * (profile === "boss" ? 1.35 : profile === "elite" ? 1.1 : 0.85)));
    const magika = Math.max(0, Math.round((resources.maxMagicka * 0.35 + topMental) * (profile === "boss" ? 1.25 : profile === "elite" ? 1 : 0.65)));
    const mainStat = Math.max(0, Math.round(Math.max(1, attributeAverage) * tuning.stat));
    const secondaryStat = Math.max(0, Math.round(mainStat * 0.55));
    const xpReward = Math.max(1, Math.round((level * 12 + health * 0.45) * tuning.xp));
    const goldReward = Math.max(0, Math.round((level * 3 + health * 0.08) * tuning.gold));

    setEnemyBalanceProfile(profile);
    setEnemyForm((current) => ({
      ...current,
      health,
      stamina,
      magika,
      strength: mainStat,
      endurance: profile === "boss" || profile === "elite" ? mainStat : secondaryStat,
      agility: secondaryStat,
      intelligence: secondaryStat,
      wisdom: secondaryStat,
      charisma: secondaryStat,
      spirit: profile === "boss" ? mainStat : secondaryStat,
      defense: targetDefense,
      attack_bonus: targetAttackBonus,
      armor_rating: tuning.armor,
      xp_reward: xpReward,
      gold_reward: goldReward,
    }));
    setAbilityMessage(`${enemyBalanceLabels[profile]} balance applied from ${character.name}'s current stats.`);
  }

  async function editEnemy(enemy: EnemyDefinition) {
    setEditingEnemyId(enemy.id);
    setEnemyForm(enemy);
    await loadEnemyDetails(enemy.id);
  }

  async function removeEnemy(id: string) {
    try {
      await deleteEnemy(id);
      setAbilityMessage("Enemy deleted.");
      setEditingEnemyId(null);
      setEnemyForm(blankEnemy());
      setEnemyAbilities([]);
      setEnemyDrops([]);
      await loadAdminCombat();
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to delete enemy.");
    }
  }

  async function addEnemyAbility() {
    if (!editingEnemyId || !selectedEnemyAbilityId) {
      setAbilityMessage("Save/select an enemy and ability first.");
      return;
    }
    try {
      await saveEnemyAbility(editingEnemyId, selectedEnemyAbilityId, Number(enemyAbilityWeight) || 1);
      await loadEnemyDetails(editingEnemyId);
      setAbilityMessage("Enemy ability saved.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save enemy ability.");
    }
  }

  async function addEnemyDrop() {
    if (!editingEnemyId || !selectedDropItemId) {
      setAbilityMessage("Save/select an enemy and item first.");
      return;
    }
    try {
      await saveEnemyDrop(editingEnemyId, selectedDropItemId, Number(dropQuantity) || 1, Number(dropChance) || 0);
      await loadEnemyDetails(editingEnemyId);
      setAbilityMessage("Enemy drop saved.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save enemy drop.");
    }
  }

  async function saveNpcDefinition() {
    try {
      const saved = await saveNpc({ ...npcForm, id: editingNpcId ?? undefined });
      setAbilityMessage(`${saved.name} saved.`);
      setNpcForm(saved);
      setEditingNpcId(saved.id);
      await loadAdminCombat();
      await loadNpcDetails(saved.id);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save NPC.");
    }
  }

  async function editNpc(npc: NpcDefinition) {
    setEditingNpcId(npc.id);
    setNpcForm(npc);
    await loadNpcDetails(npc.id);
  }

  async function removeNpc(id: string) {
    try {
      await deleteNpc(id);
      setAbilityMessage("NPC deleted.");
      setEditingNpcId(null);
      setNpcForm(blankNpc());
      setNpcAbilities([]);
      setNpcDrops([]);
      await loadAdminCombat();
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to delete NPC.");
    }
  }

  async function addNpcAbility() {
    if (!editingNpcId || !selectedNpcAbilityId) {
      setAbilityMessage("Save/select an NPC and ability first.");
      return;
    }
    try {
      await saveNpcAbility(editingNpcId, selectedNpcAbilityId, Number(npcAbilityWeight) || 1);
      await loadNpcDetails(editingNpcId);
      setAbilityMessage("NPC ability saved.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save NPC ability.");
    }
  }

  async function addNpcDrop() {
    if (!editingNpcId || !selectedNpcDropItemId) {
      setAbilityMessage("Save/select an NPC and item first.");
      return;
    }
    try {
      await saveNpcDrop(editingNpcId, selectedNpcDropItemId, Number(npcDropQuantity) || 1, Number(npcDropChance) || 0);
      await loadNpcDetails(editingNpcId);
      setAbilityMessage("NPC drop saved.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to save NPC drop.");
    }
  }

  async function loadInventory() {
    try {
      const state = await getInventoryState(character.id);
      setInventoryItems(state.items);
      setItemDefinitions(state.definitions);
      setEquippedItems(state.equipped);
      setTotalInventoryWeight(state.totalWeight);
      setCarryCapacity(state.carryCapacity);
      const settings = await getCarrySettings();
      setBaseCarryWeight(String(settings.baseCarryWeight));
      setCarryWeightPerStrength(String(settings.carryWeightPerStrengthLevel));
      const currentInventory = new Map(state.items.map((entry) => [entry.item_id, entry.quantity]));
      const previousInventory = knownInventoryRef.current;
      if (previousInventory) {
        const gained = state.items.filter((entry) => entry.quantity > (previousInventory.get(entry.item_id) ?? 0));
        if (gained.length > 0) {
          setInventoryMessage(`Added to inventory: ${gained.map((entry) => `${entry.item.name} x${entry.quantity - (previousInventory.get(entry.item_id) ?? 0)}`).join(", ")}.`);
        }
      }
      knownInventoryRef.current = currentInventory;
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to load inventory.");
    }
  }

  async function equipSelectedAbility(slot: number) {
    if (!selectedAbilityKey) {
      setAbilityMessage("Select an unlocked ability first.");
      return;
    }

    try {
      await equipAbility(character.id, slot, selectedAbilityKey);
      await loadAbilities();
      setAbilityMessage("Ability equipped.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to equip ability.");
    }
  }

  async function clearSlot(slot: number) {
    try {
      await equipAbility(character.id, slot, null);
      await loadAbilities();
      setAbilityMessage("Slot cleared.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to clear slot.");
    }
  }

  async function saveItem() {
    try {
      const saved = await saveItemDefinition({ ...itemForm, id: editingItemId ?? undefined });
      setInventoryMessage(`${saved.name} saved.`);
      setItemForm(blankItemDefinition());
      setEditingItemId(null);
      await loadInventory();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to save item.");
    }
  }

  async function saveInventoryBalance() {
    try {
      await saveCarrySettings({
        baseCarryWeight: Number(baseCarryWeight) || 50,
        carryWeightPerStrengthLevel: Number(carryWeightPerStrength) || 10,
      });
      setInventoryMessage("Inventory balance saved.");
      await loadInventory();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to save inventory balance.");
    }
  }

  async function editItem(item: ItemDefinition) {
    setInventoryCategory(toInventoryCategory(item.type));
    setEditingItemId(item.id);
    setItemForm(item);
  }

  async function deleteItem(itemId: string) {
    try {
      await deleteItemDefinition(itemId);
      setInventoryMessage("Item deleted.");
      await loadInventory();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to delete item.");
    }
  }

  async function grantItem(itemId: string) {
    try {
      await grantItemToCharacter(character.id, itemId, 1);
      setInventoryMessage("Item added to inventory.");
      await loadInventory();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to add item.");
    }
  }

  async function equipItem(entry: InventoryItem) {
    try {
      await equipInventoryItem(character.id, entry.item);
      setInventoryMessage(`${entry.item.name} equipped.`);
      await loadInventory();
      await loadAbilities();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to equip item.");
    }
  }

  async function unequipSlot(slot: "weapon" | "armor" | "necklace" | "ring" | "charm" | "relic") {
    try {
      await unequipInventorySlot(character.id, slot);
      setInventoryMessage("Item unequipped.");
      await loadInventory();
      await loadAbilities();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to unequip item.");
    }
  }

  async function dropItem(entry: InventoryItem) {
    try {
      await consumeInventoryItem(entry, 1);
      setSelectedInventoryItemId(null);
      setInventoryMessage(`Dropped ${entry.item.name}.`);
      await loadInventory();
      await loadAbilities();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to drop item.");
    }
  }

  async function saveHealth(nextHealth: number) {
    const safeHealth = clampHealth(nextHealth, resources.maxHp);
    await updateCharacterHealth(character.id, safeHealth);
    onCharacterUpdated({ ...character, current_health: safeHealth });
    return safeHealth;
  }

  async function useOutsideBattleAbility(ability: AbilityDefinition) {
    if (!ability.adminAbility || ability.adminAbility.type !== "heal" || !canUseAbilityInContext(ability, "outside")) {
      setAbilityMessage("This ability cannot be used outside battle.");
      return;
    }

    if (currentHealth >= resources.maxHp) {
      setAbilityMessage("Health is already full.");
      return;
    }

    try {
      const amount = Math.max(1, Number(ability.adminAbility.healing) || 1);
      const nextHealth = await saveHealth(currentHealth + amount);
      setAbilityMessage(`${ability.name} restored Health to ${nextHealth} / ${resources.maxHp}.`);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to use healing ability.");
    }
  }

  async function useOutsideBattleItem(entry: InventoryItem) {
    if (!canUseItemOutsideBattle(entry)) {
      setInventoryMessage("This item cannot be used outside battle.");
      return;
    }

    if (currentHealth >= resources.maxHp) {
      setInventoryMessage("Health is already full.");
      return;
    }

    try {
      const amount = getItemRestoreAmount(entry.item, resources.maxHp);
      const nextHealth = await saveHealth(currentHealth + amount);
      await consumeInventoryItem(entry, 1);
      await loadInventory();
      setInventoryMessage(`Used ${entry.item.name}. Health is now ${nextHealth} / ${resources.maxHp}.`);
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to use item.");
    }
  }

  async function useAbilityScroll(entry: InventoryItem) {
    if (entry.item.type !== "scroll" || !entry.item.teaches_ability_id) {
      setInventoryMessage("This scroll is not linked to an ability.");
      return;
    }

    try {
      const result = await learnAbilityFromScroll(character.id, entry.item.teaches_ability_id);
      if (!result.learned) {
        setInventoryMessage(result.message);
        return;
      }

      await consumeInventoryItem(entry, 1);
      await loadInventory();
      await loadAbilities();
      setInventoryMessage(result.message);
    } catch (error) {
      console.error("[inventory] ability scroll use failed", error);
      setInventoryMessage(error instanceof Error ? error.message : "Unable to learn ability from scroll.");
    }
  }

  if (activeSheet === "inventory") {
    return (
      <CharacterInventorySheet
        items={inventoryItems}
        equippedItems={equippedItems}
        selectedItem={selectedInventoryItem}
        activeTab={inventoryCategory}
        totalWeight={totalInventoryWeight}
        carryCapacity={carryCapacity}
        currentHealth={currentHealth}
        maxHealth={resources.maxHp}
        message={inventoryMessage}
        onClose={() => setActiveSheet(null)}
        onSelectTab={setInventoryCategory}
        onSelectItem={setSelectedInventoryItemId}
        onEquipItem={(entry) => void equipItem(entry)}
        onUnequipSlot={(slot) => void unequipSlot(slot)}
        onUseItem={(entry) => void useOutsideBattleItem(entry)}
        onUseScroll={(entry) => void useAbilityScroll(entry)}
        onDropItem={(entry) => void dropItem(entry)}
      />
    );
  }

  if (activeSheet === "abilities") {
    return (
      <CharacterAbilitiesSheet
        abilities={unlockedAbilities}
        equippedAbilities={equippedAbilities}
        selectedAbility={selectedPlayerAbility}
        selectedAbilityKey={selectedAbilityKey}
        activeTab={playerAbilityTab}
        currentHealth={currentHealth}
        maxHealth={resources.maxHp}
        message={abilityMessage}
        onClose={() => setActiveSheet(null)}
        onSelectTab={setPlayerAbilityTab}
        onSelectAbility={(ability) => {
          setSelectedPlayerAbility(ability);
          setSelectedAbilityKey(ability?.key ?? null);
        }}
        onEquipAbility={(slot) => void equipSelectedAbility(slot)}
        onClearSlot={(slot) => void clearSlot(slot)}
        onUseHeal={(ability) => void useOutsideBattleAbility(ability)}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.homeChrome}>
        <Pressable style={styles.chromeButton}><Text style={styles.chromeIcon}>☰</Text></Pressable>
        <View style={styles.chromeActions}>
          <Pressable style={styles.chromeButton} onPress={onOpenInbox}>
            <Text style={styles.chromeIcon}>✉</Text>
            {inboxUnreadCount > 0 ? (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>{inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.chromeButton} onPress={onOpenSettings}><Text style={styles.chromeIcon}>⚙</Text></Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        {character.portrait_url ? (
          <Image source={{ uri: character.portrait_url }} style={styles.portrait} />
        ) : (
          <View style={styles.noPortrait}>
            <Text style={styles.noPortraitText}>Portrait pending</Text>
          </View>
        )}
        <View style={styles.heroShade} />
        <View style={styles.heroInfo}>
          <Text style={styles.name}>{character.name}</Text>
          <Text style={styles.identity}>{character.ancestry ?? "Adventurer"} · {character.origin ?? "Unknown Origin"}</Text>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNumber}>{character.level}</Text>
            </View>
            <View style={styles.levelCopy}>
              <Text style={styles.levelLabel}>Level {character.level}</Text>
              <Text style={styles.xpText}>
                {characterXpProgress.isCapped ? "Level cap reached" : `${characterXpProgress.progress.toLocaleString()} / ${characterXpProgress.required.toLocaleString()} XP`}
              </Text>
              <ProgressBar value={characterXpProgress.progress} max={characterXpProgress.required} color={colors.gold} height={8} />
            </View>
          </View>
        </View>
      </View>

      <Frame style={styles.summaryBand}>
        <SummaryTile icon="◎" label="Gold" value={character.gold.toLocaleString()} />
        <SummaryTile icon="✦" label="Seed" value="50" />
        <SummaryTile icon="⌖" label="Distance Walked" value={formatWalkedDistance(distanceWalkedMeters)} />
        <SummaryTile icon="▧" label="Chapter" value="1" />
      </Frame>

      <Frame style={styles.resourcesPanel}>
        <ResourceBar label="HP" value={currentHealth} max={resources.maxHp} color={colors.red} icon="♥" />
        <ResourceBar label="Stamina" value={resources.maxStamina} max={resources.maxStamina} color={colors.gold} icon="ϟ" />
        <ResourceBar label="Mana" value={resources.maxMagicka} max={resources.maxMagicka} color={colors.blue} icon="◉" />
      </Frame>

      <View style={styles.tabs}>
        {visibleHomeTabs.map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <Frame style={styles.card}>
        {activeTab === "Overview" ? (
          <View style={styles.dashboardSection}>
            <View style={styles.quickGrid}>
              <QuickTile icon="▣" label="Inventory" selected onPress={() => setActiveSheet("inventory")} />
              <QuickTile icon="⚔" label="Abilities" onPress={() => setActiveSheet("abilities")} />
              <QuickTile icon="☷" label="Attributes" onPress={() => setActiveTab("Attributes")} />
              <QuickTile icon="✎" label="Battle Stats" onPress={() => setActiveTab("Battle Stats")} />
            </View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Equipped</Text>
              <Pressable style={styles.viewAllButton} onPress={() => setActiveSheet("inventory")}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.equippedList}>
              {(["weapon", "armor", "necklace", "ring"] as const).map((slot) => (
                <EquippedRow key={slot} slot={slot} item={equippedItems[slot] ?? null} />
              ))}
            </View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Inventory Items</Text>
              <Pressable style={styles.viewAllButton} onPress={() => setActiveSheet("inventory")}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.inventoryStrip}>
              {inventoryItems.slice(0, 6).map((entry) => (
                <InventoryStripItem key={entry.id} entry={entry} />
              ))}
              {inventoryItems.length === 0 ? <Text style={styles.muted}>No inventory items yet.</Text> : null}
            </View>
          </View>
        ) : activeTab === "Identity" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identity</Text>
            <Info label="Gender" value={character.gender ?? "Not set"} />
            <Info label="Race" value={character.ancestry ?? "Not set"} />
            <Info label="Origin" value={character.origin ?? "Not set"} />
          </View>
        ) : activeTab === "Attributes" ? (
          <View style={styles.attributeGrid}>
            {attributeKeys.map((key) => (
              <View key={key} style={styles.attribute}>
                <Text style={styles.attributeName}>{key}</Text>
                <Text style={styles.attributeValue}>{character.attributes?.[key] ?? 0}</Text>
              </View>
            ))}
          </View>
        ) : activeTab === "Battle Stats" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Battle Stats</Text>
            <Text style={styles.muted}>These are derived from attributes and equipped gear. Training will keep feeding these numbers as the combat system grows.</Text>
            <View style={styles.combatStatGrid}>
              <CombatStat label="Health" value={`${currentHealth} / ${battleStats.maxHp}`} note="Persistent Health / max Health" />
              <CombatStat label="Stamina" value={battleStats.maxStamina} note="Strength, Endurance, gear" />
              <CombatStat label="Mana" value={battleStats.maxMagicka} note="Intelligence, Wisdom, Spirit" />
              <CombatStat label="Defense" value={battleStats.defense} note="Armor Class: 10 + equipped armor bonuses" />
              <CombatStat label="Melee Attack" value={`+${battleStats.meleeAttackBonus}`} note="Strength + gear damage" />
              <CombatStat label="Ranged / Dodge" value={`+${battleStats.agilityBonus}`} note="Agility accuracy and evasion" />
              <CombatStat label="Spell Power" value={`+${battleStats.spellPower}`} note="Intelligence + Mana scaling" />
              <CombatStat label="Healing Power" value={`+${battleStats.healingPower}`} note="Wisdom support scaling" />
              <CombatStat label="Spirit Power" value={`+${battleStats.spiritPower}`} note="Spirit resistance and divine scaling" />
              <CombatStat label="Crit Chance" value={`${battleStats.critChance}%`} note="Agility-based starter value" />
              <CombatStat label="Armor" value={battleStats.armorValue} note="Equipped armor reduction" />
              <CombatStat label="Carry Weight" value={`${battleStats.currentWeight} / ${battleStats.maxWeight}`} note="Strength capacity" />
            </View>
            <View style={styles.detailPanel}>
              <Text style={styles.subTitle}>Equipped Battle Sources</Text>
              <Info label="Weapon" value={battleStats.weaponName} />
              <Info label="Armor" value={battleStats.armorName} />
              <Info label="Gear Damage Bonus" value={`+${battleStats.gearDamageBonus}`} />
              <Info label="Gear Defense Bonus" value={`+${battleStats.gearDefenseBonus}`} />
            </View>
          </View>
        ) : activeTab === "Abilities" ? (
          <View style={styles.section}>
            <PlayerAbilitiesPanel
              abilities={unlockedAbilities}
              equippedAbilities={equippedAbilities}
              selectedAbility={selectedPlayerAbility}
              selectedAbilityKey={selectedAbilityKey}
              activeTab={playerAbilityTab}
              currentHealth={currentHealth}
              maxHealth={resources.maxHp}
              message={abilityMessage}
              onSelectTab={setPlayerAbilityTab}
              onSelectAbility={(ability) => {
                setSelectedPlayerAbility(ability);
                setSelectedAbilityKey(ability?.key ?? null);
              }}
              onEquipAbility={(slot) => void equipSelectedAbility(slot)}
              onClearSlot={(slot) => void clearSlot(slot)}
              onUseHeal={(ability) => void useOutsideBattleAbility(ability)}
            />
            {isAdmin ? (
              <View style={styles.adminBuilder}>
                <View style={styles.tabs}>
                  {adminToolTabs.map((tab) => (
                    <Pressable key={tab} style={[styles.tab, adminToolTab === tab && styles.activeTab]} onPress={() => setAdminToolTab(tab)}>
                      <Text style={[styles.tabText, adminToolTab === tab && styles.activeTabText]}>{tab}</Text>
                    </Pressable>
                  ))}
                </View>
                {adminToolTab === "Abilities" ? (
                  <>
                <Text style={styles.sectionTitle}>Admin Abilities</Text>
                <View style={styles.tabs}>
                  {abilityTypeTabs.map((tab) => (
                    <Pressable key={tab} style={[styles.tab, abilityTypeTab === tab && styles.activeTab]} onPress={() => setAbilityTypeTab(tab)}>
                      <Text style={[styles.tabText, abilityTypeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </Pressable>
                  ))}
                </View>
                {selectedAdminAbility ? (
                  <View style={styles.detailPanel}>
                    <AssetPreview label="Selected ability image" uri={resolveAbilityImageUri(selectedAdminAbility.image_path)} />
                    <Text style={styles.abilityName}>{selectedAdminAbility.name}</Text>
                    <Text style={styles.muted}>{selectedAdminAbility.type} / Damage {selectedAdminAbility.damage} / Healing {selectedAdminAbility.healing} / Defense {selectedAdminAbility.defense_amount}</Text>
                    <Text style={styles.muted}>Restores: {selectedAdminAbility.stamina_restore} Stamina / {selectedAdminAbility.magika_restore} Mana</Text>
                    <Text style={styles.muted}>Costs: {selectedAdminAbility.stamina_cost} Stamina / {selectedAdminAbility.magika_cost} Mana / {selectedAdminAbility.health_cost} Health</Text>
                    <Text style={styles.muted}>Unlock: {formatAbilityUnlockText(selectedAdminAbility)}</Text>
                    <View style={styles.slotActions}>
                      <Pressable style={styles.smallButton} onPress={() => void editAdminAbility(selectedAdminAbility)}><Text style={styles.smallButtonText}>Edit Selected</Text></Pressable>
                      <Pressable style={styles.smallButton} onPress={() => void removeAdminAbility(selectedAdminAbility.id)}><Text style={styles.smallButtonText}>Delete Selected</Text></Pressable>
                    </View>
                  </View>
                ) : null}
                <Text style={styles.muted}>Create database abilities for players, gear, scrolls, quests, and enemies. Images can use /assets/Abilities/filename.png, a simple filename, or a full URL.</Text>
                <ItemText label="Name" value={abilityForm.name ?? ""} onChange={(value) => setAbilityForm((current) => ({ ...current, name: value }))} />
                <ChoiceRow label="Type" options={combatAbilityTypes} value={abilityForm.type ?? "attack"} onSelect={(value) => setAbilityForm((current) => ({ ...current, type: value }))} />
                <ChoiceRow label="Use context" options={abilityUsageContexts} value={abilityForm.usage_context ?? "battle_only"} onSelect={(value) => setAbilityForm((current) => ({ ...current, usage_context: value }))} />
                <View style={styles.slotActions}>
                  <ItemText label="Damage" value={String(abilityForm.damage ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, damage: Number(value) || 0 }))} />
                  <ItemText label="Healing" value={String(abilityForm.healing ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, healing: Number(value) || 0 }))} />
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="Defense amount" value={String(abilityForm.defense_amount ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, defense_amount: Number(value) || 0 }))} />
                  <ItemText label="Attack bonus" value={String(abilityForm.attack_bonus ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, attack_bonus: Number(value) || 0 }))} />
                </View>
                <View style={styles.adminSubPanel}>
                  <Text style={styles.sectionTitleSmall}>Ability Cost</Text>
                  <Text style={styles.muted}>Choose what this ability spends in battle, then set the amount.</Text>
                  <ChoiceRow
                    label="Cost resource"
                    options={abilityCostResources}
                    value={abilityCostResource}
                    labels={abilityCostResourceLabels}
                    onSelect={(value) => {
                      setAbilityCostResource(value);
                      setAbilityForm((current) => setAbilityCost(current, value, getAbilityCostAmount(current)));
                    }}
                  />
                  <ItemText
                    label={abilityCostResource === "none" ? "Cost amount disabled" : `${abilityCostResourceLabels[abilityCostResource]} cost amount`}
                    value={String(getAbilityCostAmount(abilityForm))}
                    onChange={(value) => setAbilityForm((current) => setAbilityCost(current, abilityCostResource, Number(value) || 0))}
                  />
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="Hit chance %" value={String(abilityForm.hit_chance ?? 75)} onChange={(value) => setAbilityForm((current) => ({ ...current, hit_chance: Number(value) || 75 }))} />
                  <ItemText label="Critical chance %" value={String(abilityForm.critical_chance ?? 5)} onChange={(value) => setAbilityForm((current) => ({ ...current, critical_chance: Number(value) || 0 }))} />
                  <ItemText label="Critical multiplier" value={String(abilityForm.critical_multiplier ?? 2)} onChange={(value) => setAbilityForm((current) => ({ ...current, critical_multiplier: Number(value) || 2 }))} />
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="Cooldown turns" value={String(abilityForm.cooldown_turns ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, cooldown_turns: Number(value) || 0 }))} />
                  <ItemText label="Duration turns" value={String(abilityForm.duration_turns ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, duration_turns: Number(value) || 0 }))} />
                </View>
                <ChoiceRow label="Status effect" options={statusEffects} value={abilityForm.status_effect ?? "none"} onSelect={(value) => setAbilityForm((current) => ({ ...current, status_effect: value }))} />
                <View style={styles.slotActions}>
                  <ItemText label="Effect amount" value={String(abilityForm.effect_amount ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, effect_amount: Number(value) || 0 }))} />
                  <ItemText label="Effect duration" value={String(abilityForm.effect_duration ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, effect_duration: Number(value) || 0 }))} />
                </View>
                <ChoiceRow label="Linked stat" options={linkedStats} value={abilityForm.linked_stat ?? "none"} onSelect={(value) => setAbilityForm((current) => ({ ...current, linked_stat: value }))} />
                <ChoiceRow label="Learn method" options={learnMethods} value={abilityForm.learn_method ?? "admin"} onSelect={(value) => setAbilityForm((current) => ({ ...current, learn_method: value }))} />
                <ToggleRow label="Starter Ability" value={abilityForm.learn_method === "starter"} onPress={() => setAbilityForm((current) => ({ ...current, learn_method: current.learn_method === "starter" ? "admin" : "starter", required_attribute: current.learn_method === "starter" ? current.required_attribute ?? null : null, required_attribute_level: current.learn_method === "starter" ? current.required_attribute_level ?? 0 : 0, required_level: current.learn_method === "starter" ? current.required_level ?? 0 : 0 }))} />
                <ItemText label="Required level" value={String(abilityForm.required_level ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, required_level: Number(value) || 0 }))} />
                <ChoiceRow label="Required Attribute" options={["", ...requiredAttributes]} value={abilityForm.required_attribute ?? ""} onSelect={(value) => setAbilityForm((current) => ({ ...current, required_attribute: value || null, linked_stat: value || current.linked_stat }))} />
                <ItemText label="Required Attribute Level" value={String(abilityForm.required_attribute_level ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, required_attribute_level: Number(value) || 0, required_level: Number(value) || current.required_level || 0 }))} />
                <ChoiceRow label="Required Class" options={["", ...requiredClassKeys]} value={abilityForm.required_class_key ?? ""} labels={getClassChoiceLabels()} onSelect={(value) => setAbilityForm((current) => ({ ...current, required_class_key: value || null }))} />
                <View style={styles.slotActions}>
                  <ItemText label="Stamina Restore" value={String(abilityForm.stamina_restore ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, stamina_restore: Number(value) || 0 }))} />
                  <ItemText label="Mana Restore" value={String(abilityForm.magika_restore ?? 0)} onChange={(value) => setAbilityForm((current) => ({ ...current, magika_restore: Number(value) || 0 }))} />
                </View>
                <ItemText label="Image URL/path" value={abilityForm.image_path ?? ""} onChange={(value) => setAbilityForm((current) => ({ ...current, image_path: value }))} />
                <AdminImageUploadButton folder="abilities" onUploaded={(url) => setAbilityForm((current) => ({ ...current, image_path: url }))} onMessage={setAbilityMessage} />
                <AssetPreview label="Ability image preview" uri={resolveAbilityImageUri(abilityForm.image_path)} />
                <ToggleRow label="Active" value={abilityForm.is_active ?? true} onPress={() => setAbilityForm((current) => ({ ...current, is_active: !current.is_active }))} />
                <Pressable style={styles.primaryAdminButton} onPress={() => void saveAdminAbility()}>
                  <Text style={styles.primaryAdminText}>{editingAdminAbilityId ? "Update Ability" : "Add Ability"}</Text>
                </Pressable>
                {editingAdminAbilityId ? (
                  <Pressable style={styles.smallButton} onPress={() => { setEditingAdminAbilityId(null); setAbilityForm(blankCombatAbility()); setAbilityCostResource("none"); }}>
                    <Text style={styles.smallButtonText}>Cancel Ability Edit</Text>
                  </Pressable>
                ) : null}
                {filteredAdminAbilities.map((ability) => (
                  <Pressable key={ability.id} style={[styles.abilityCard, selectedAdminAbilityId === ability.id && styles.abilityCardActive]} onPress={() => setSelectedAdminAbilityId(ability.id)}>
                    <View style={styles.itemCardHeader}>
                      {resolveAbilityImageUri(ability.image_path) ? <Image source={{ uri: resolveAbilityImageUri(ability.image_path) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                      <View style={styles.itemBody}>
                    <Text style={styles.abilityName}>{ability.name}</Text>
                    <Text style={styles.muted}>{ability.type} / {ability.damage} damage / {ability.healing} healing / {ability.status_effect}</Text>
                    <Text style={styles.muted}>Restores {ability.stamina_restore} Stamina / {ability.magika_restore} Mana</Text>
                    <Text style={styles.muted}>Unlock: {formatAbilityUnlockText(ability)}</Text>
                      </View>
                    </View>
                    <View style={styles.slotActions}>
                      <Pressable style={styles.smallButton} onPress={() => void editAdminAbility(ability)}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                      <Pressable style={styles.smallButton} onPress={() => void removeAdminAbility(ability.id)}><Text style={styles.smallButtonText}>Delete</Text></Pressable>
                    </View>
                  </Pressable>
                ))}
                  </>
                ) : null}
                {adminToolTab === "Enemies" ? (
                  <>
                <Text style={styles.sectionTitle}>Enemy Admin</Text>
                <ItemText label="Name" value={enemyForm.name ?? ""} onChange={(value) => setEnemyForm((current) => ({ ...current, name: value }))} />
                <ItemText label="Type" value={enemyForm.type ?? ""} onChange={(value) => setEnemyForm((current) => ({ ...current, type: value }))} />
                <ItemText label="Image URL/path" value={enemyForm.image_url ?? ""} onChange={(value) => setEnemyForm((current) => ({ ...current, image_url: value }))} />
                <AdminImageUploadButton folder="enemies" onUploaded={(url) => setEnemyForm((current) => ({ ...current, image_url: url }))} onMessage={setAbilityMessage} />
                <AssetPreview label="Enemy image preview" uri={resolveEnemyImageUri(enemyForm.image_url)} />
                <View style={styles.adminBuilder}>
                  <Text style={styles.subTitle}>Balance From Current Player</Text>
                  <Text style={styles.muted}>Uses {character.name}'s level, resources, attributes, and equipped defense to tune enemy HP, Defense, Attack Bonus, resources, and rewards.</Text>
                  <View style={styles.slotActions}>
                    {enemyBalanceProfiles.map((profile) => (
                      <Pressable key={profile} style={[styles.smallButton, enemyBalanceProfile === profile && styles.smallButtonActive]} onPress={() => applyEnemyBalance(profile)}>
                        <Text style={styles.smallButtonText}>{enemyBalanceLabels[profile]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.muted}>
                    Target feel: Minions fall fast, Standard enemies trade blows, Elites pressure the player, Bosses need resources and strategy.
                  </Text>
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="Health" value={String(enemyForm.health ?? 20)} onChange={(value) => setEnemyForm((current) => ({ ...current, health: Number(value) || 20 }))} />
                  <ItemText label="Stamina" value={String(enemyForm.stamina ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, stamina: Number(value) || 0 }))} />
                  <ItemText label="Mana" value={String(enemyForm.magika ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, magika: Number(value) || 0 }))} />
                </View>
                {attributeKeys.map((key) => (
                  <ItemText key={key} label={key} value={String(enemyForm[key] ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, [key]: Number(value) || 0 }))} />
                ))}
                <View style={styles.slotActions}>
                  <ItemText label="Defense" value={String(enemyForm.defense ?? 10)} onChange={(value) => setEnemyForm((current) => ({ ...current, defense: Number(value) || 10 }))} />
                  <ItemText label="Attack Bonus" value={String(enemyForm.attack_bonus ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, attack_bonus: Number(value) || 0 }))} />
                  <ItemText label="Armor Rating" value={String(enemyForm.armor_rating ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, armor_rating: Number(value) || 0 }))} />
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="XP Reward" value={String(enemyForm.xp_reward ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, xp_reward: Number(value) || 0 }))} />
                  <ItemText label="Gold Reward" value={String(enemyForm.gold_reward ?? 0)} onChange={(value) => setEnemyForm((current) => ({ ...current, gold_reward: Number(value) || 0 }))} />
                </View>
                <ToggleRow label="Enemy Active" value={enemyForm.is_active ?? true} onPress={() => setEnemyForm((current) => ({ ...current, is_active: !current.is_active }))} />
                <Pressable style={styles.primaryAdminButton} onPress={() => void saveEnemyDefinition()}>
                  <Text style={styles.primaryAdminText}>{editingEnemyId ? "Update Enemy" : "Add Enemy"}</Text>
                </Pressable>
                {editingEnemyId ? (
                  <View style={styles.adminBuilder}>
                    <Text style={styles.subTitle}>Enemy Abilities</Text>
                    <NamedChoiceRow label="Ability" options={adminAbilities.map((ability) => ({ id: ability.id, label: ability.name }))} value={selectedEnemyAbilityId ?? ""} onSelect={setSelectedEnemyAbilityId} />
                    <ItemText label="Use chance / weight" value={enemyAbilityWeight} onChange={setEnemyAbilityWeight} />
                    <Pressable style={styles.smallButton} onPress={() => void addEnemyAbility()}><Text style={styles.smallButtonText}>Add Enemy Ability</Text></Pressable>
                    {enemyAbilities.map((row) => (
                      <View key={row.id} style={styles.slotCard}>
                        <Text style={styles.slotName}>{adminAbilities.find((ability) => ability.id === row.ability_id)?.name ?? "Unknown Ability"}</Text>
                        <Text style={styles.muted}>Weight {row.use_weight}</Text>
                        <Pressable style={styles.smallButton} onPress={() => void deleteEnemyAbility(row.id).then(() => editingEnemyId ? loadEnemyDetails(editingEnemyId) : undefined)}><Text style={styles.smallButtonText}>Remove</Text></Pressable>
                      </View>
                    ))}
                    <Text style={styles.subTitle}>Item Drops</Text>
                    <NamedChoiceRow label="Item Drop" options={itemDefinitions.map((item) => ({ id: item.id, label: item.name }))} value={selectedDropItemId ?? ""} onSelect={setSelectedDropItemId} />
                    <View style={styles.slotActions}>
                      <ItemText label="Quantity" value={dropQuantity} onChange={setDropQuantity} />
                      <ItemText label="Drop chance %" value={dropChance} onChange={setDropChance} />
                    </View>
                    <Pressable style={styles.smallButton} onPress={() => void addEnemyDrop()}><Text style={styles.smallButtonText}>Add Drop</Text></Pressable>
                    {enemyDrops.map((drop) => (
                      <View key={drop.id} style={styles.slotCard}>
                        <Text style={styles.slotName}>{itemDefinitions.find((item) => item.id === drop.item_id)?.name ?? "Unknown Item"}</Text>
                        <Text style={styles.muted}>Qty {drop.quantity} / Chance {drop.drop_chance}%</Text>
                        <Pressable style={styles.smallButton} onPress={() => void deleteEnemyDrop(drop.id).then(() => editingEnemyId ? loadEnemyDetails(editingEnemyId) : undefined)}><Text style={styles.smallButtonText}>Remove</Text></Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                {enemies.map((enemy) => (
                  <View key={enemy.id} style={styles.abilityCard}>
                    <View style={styles.itemCardHeader}>
                      {resolveEnemyImageUri(enemy.image_url) ? <Image source={{ uri: resolveEnemyImageUri(enemy.image_url) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                      <View style={styles.itemBody}>
                    <Text style={styles.abilityName}>{enemy.name}</Text>
                    <Text style={styles.muted}>{enemy.type || "Enemy"} / HP {enemy.health} / Attack +{enemy.attack_bonus ?? 0} / Defense {enemy.defense} / Armor {enemy.armor_rating}</Text>
                      </View>
                    </View>
                    <View style={styles.slotActions}>
                      <Pressable style={styles.smallButton} onPress={() => void editEnemy(enemy)}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                      <Pressable style={styles.smallButton} onPress={() => void removeEnemy(enemy.id)}><Text style={styles.smallButtonText}>Delete</Text></Pressable>
                    </View>
                  </View>
                ))}
                  </>
                ) : null}
                {adminToolTab === "NPCs" ? (
                  <>
                <Text style={styles.sectionTitle}>NPC Admin</Text>
                <Text style={styles.muted}>Create reusable characters for dialogue. Turn on Battle Capable when this NPC can also be selected for battles.</Text>
                <ItemText label="Name" value={npcForm.name ?? ""} onChange={(value) => setNpcForm((current) => ({ ...current, name: value }))} />
                <ItemText label="Type / Role" value={npcForm.type ?? ""} onChange={(value) => setNpcForm((current) => ({ ...current, type: value }))} />
                <ItemText label="Description" value={npcForm.description ?? ""} onChange={(value) => setNpcForm((current) => ({ ...current, description: value }))} />
                <ItemText label="Image URL/path" value={npcForm.image_url ?? ""} onChange={(value) => setNpcForm((current) => ({ ...current, image_url: value }))} />
                <AdminImageUploadButton folder="npcs" onUploaded={(url) => setNpcForm((current) => ({ ...current, image_url: url }))} onMessage={setAbilityMessage} />
                <AssetPreview label="NPC image preview" uri={resolveEnemyImageUri(npcForm.image_url)} />
                <ToggleRow label="Battle Capable" value={npcForm.can_battle ?? false} onPress={() => setNpcForm((current) => ({ ...current, can_battle: !current.can_battle }))} />
                <View style={styles.slotActions}>
                  <ItemText label="Health" value={String(npcForm.health ?? 20)} onChange={(value) => setNpcForm((current) => ({ ...current, health: Number(value) || 20 }))} />
                  <ItemText label="Stamina" value={String(npcForm.stamina ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, stamina: Number(value) || 0 }))} />
                  <ItemText label="Mana" value={String(npcForm.magika ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, magika: Number(value) || 0 }))} />
                </View>
                {attributeKeys.map((key) => (
                  <ItemText key={key} label={key} value={String(npcForm[key] ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, [key]: Number(value) || 0 }))} />
                ))}
                <View style={styles.slotActions}>
                  <ItemText label="Defense" value={String(npcForm.defense ?? 10)} onChange={(value) => setNpcForm((current) => ({ ...current, defense: Number(value) || 10 }))} />
                  <ItemText label="Attack Bonus" value={String(npcForm.attack_bonus ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, attack_bonus: Number(value) || 0 }))} />
                  <ItemText label="Armor Rating" value={String(npcForm.armor_rating ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, armor_rating: Number(value) || 0 }))} />
                </View>
                <View style={styles.slotActions}>
                  <ItemText label="XP Reward" value={String(npcForm.xp_reward ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, xp_reward: Number(value) || 0 }))} />
                  <ItemText label="Gold Reward" value={String(npcForm.gold_reward ?? 0)} onChange={(value) => setNpcForm((current) => ({ ...current, gold_reward: Number(value) || 0 }))} />
                </View>
                <ToggleRow label="NPC Active" value={npcForm.is_active ?? true} onPress={() => setNpcForm((current) => ({ ...current, is_active: !current.is_active }))} />
                <Pressable style={styles.primaryAdminButton} onPress={() => void saveNpcDefinition()}>
                  <Text style={styles.primaryAdminText}>{editingNpcId ? "Update NPC" : "Add NPC"}</Text>
                </Pressable>
                {editingNpcId ? (
                  <View style={styles.adminBuilder}>
                    <Text style={styles.subTitle}>NPC Abilities</Text>
                    <NamedChoiceRow label="Ability" options={adminAbilities.map((ability) => ({ id: ability.id, label: ability.name }))} value={selectedNpcAbilityId ?? ""} onSelect={setSelectedNpcAbilityId} />
                    <ItemText label="Use chance / weight" value={npcAbilityWeight} onChange={setNpcAbilityWeight} />
                    <Pressable style={styles.smallButton} onPress={() => void addNpcAbility()}><Text style={styles.smallButtonText}>Add NPC Ability</Text></Pressable>
                    {npcAbilities.map((row) => (
                      <View key={row.id} style={styles.slotCard}>
                        <Text style={styles.slotName}>{adminAbilities.find((ability) => ability.id === row.ability_id)?.name ?? "Unknown Ability"}</Text>
                        <Text style={styles.muted}>Weight {row.use_weight}</Text>
                        <Pressable style={styles.smallButton} onPress={() => void deleteNpcAbility(row.id).then(() => editingNpcId ? loadNpcDetails(editingNpcId) : undefined)}><Text style={styles.smallButtonText}>Remove</Text></Pressable>
                      </View>
                    ))}
                    <Text style={styles.subTitle}>Item Drops</Text>
                    <NamedChoiceRow label="Item Drop" options={itemDefinitions.map((item) => ({ id: item.id, label: item.name }))} value={selectedNpcDropItemId ?? ""} onSelect={setSelectedNpcDropItemId} />
                    <View style={styles.slotActions}>
                      <ItemText label="Quantity" value={npcDropQuantity} onChange={setNpcDropQuantity} />
                      <ItemText label="Drop chance %" value={npcDropChance} onChange={setNpcDropChance} />
                    </View>
                    <Pressable style={styles.smallButton} onPress={() => void addNpcDrop()}><Text style={styles.smallButtonText}>Add Drop</Text></Pressable>
                    {npcDrops.map((drop) => (
                      <View key={drop.id} style={styles.slotCard}>
                        <Text style={styles.slotName}>{itemDefinitions.find((item) => item.id === drop.item_id)?.name ?? "Unknown Item"}</Text>
                        <Text style={styles.muted}>Qty {drop.quantity} / Chance {drop.drop_chance}%</Text>
                        <Pressable style={styles.smallButton} onPress={() => void deleteNpcDrop(drop.id).then(() => editingNpcId ? loadNpcDetails(editingNpcId) : undefined)}><Text style={styles.smallButtonText}>Remove</Text></Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                {npcs.map((npc) => (
                  <View key={npc.id} style={styles.abilityCard}>
                    <View style={styles.itemCardHeader}>
                      {resolveEnemyImageUri(npc.image_url) ? <Image source={{ uri: resolveEnemyImageUri(npc.image_url) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                      <View style={styles.itemBody}>
                    <Text style={styles.abilityName}>{npc.name}</Text>
                    <Text style={styles.muted}>{npc.type || "NPC"} / {npc.can_battle ? `Battle Capable / HP ${npc.health} / Attack +${npc.attack_bonus ?? 0} / Defense ${npc.defense}` : "Dialogue NPC"}</Text>
                    {npc.description ? <Text style={styles.muted}>{npc.description}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.slotActions}>
                      <Pressable style={styles.smallButton} onPress={() => void editNpc(npc)}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                      <Pressable style={styles.smallButton} onPress={() => void removeNpc(npc.id)}><Text style={styles.smallButtonText}>Delete</Text></Pressable>
                    </View>
                  </View>
                ))}
                  </>
                ) : null}
                {adminToolTab === "Items" ? <Text style={styles.muted}>Open the Inventory tab to manage item records by category.</Text> : null}
              </View>
            ) : null}
          </View>
        ) : activeTab === "Inventory" ? (
          <View style={styles.section}>
            <PlayerInventoryPanel
              items={inventoryItems}
              equippedItems={equippedItems}
              selectedItem={selectedInventoryItem}
              activeTab={inventoryCategory}
              totalWeight={totalInventoryWeight}
              carryCapacity={carryCapacity}
              currentHealth={currentHealth}
              maxHealth={resources.maxHp}
              message={inventoryMessage}
              onSelectTab={setInventoryCategory}
              onSelectItem={setSelectedInventoryItemId}
              onEquipItem={(entry) => void equipItem(entry)}
              onUnequipSlot={(slot) => void unequipSlot(slot)}
              onUseItem={(entry) => void useOutsideBattleItem(entry)}
              onUseScroll={(entry) => void useAbilityScroll(entry)}
              onDropItem={(entry) => void dropItem(entry)}
            />
            {isAdmin ? (
              <View style={styles.adminBuilder}>
                <View style={styles.tabs}>
                  {adminToolTabs.map((tab) => (
                    <Pressable key={tab} style={[styles.tab, adminToolTab === tab && styles.activeTab]} onPress={() => setAdminToolTab(tab)}>
                      <Text style={[styles.tabText, adminToolTab === tab && styles.activeTabText]}>{tab}</Text>
                    </Pressable>
                  ))}
                </View>
                {adminToolTab === "Items" ? (
                  <>
                <Text style={styles.sectionTitle}>Admin Items</Text>
                <Text style={styles.muted}>Create/edit items. Use /assets/InventoryItems/filename.png, paste a full URL, or type just the filename.</Text>
                <Text style={styles.subTitle}>Carry Balance</Text>
                <View style={styles.slotActions}>
                  <ItemText label="Base Carry Weight" value={baseCarryWeight} onChange={setBaseCarryWeight} />
                  <ItemText label="Carry Per Strength" value={carryWeightPerStrength} onChange={setCarryWeightPerStrength} />
                </View>
                <Pressable style={styles.smallButton} onPress={() => void saveInventoryBalance()}>
                  <Text style={styles.smallButtonText}>Save Carry Balance</Text>
                </Pressable>
                <Text style={styles.subTitle}>Item Builder</Text>
                <ItemText label="Name" value={itemForm.name ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, name: value }))} />
                <ChoiceRow label="Type" options={itemTypes} value={itemForm.type ?? "misc"} onSelect={(value) => setItemForm((current) => ({ ...current, type: value, equipment_slot: defaultSlotForType(value) }))} />
                <ChoiceRow label="Rarity" options={rarityOptions} value={itemForm.rarity ?? "common"} onSelect={(value) => setItemForm((current) => ({ ...current, rarity: value }))} />
                <ItemText label="Description" value={itemForm.description ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, description: value }))} />
                <ItemText label="Image path" value={itemForm.image_path ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, image_path: value }))} />
                <AdminImageUploadButton folder="items" onUploaded={(url) => setItemForm((current) => ({ ...current, image_path: url }))} onMessage={setInventoryMessage} />
                <AssetPreview label="Item image preview" uri={resolveInventoryImageUri(itemForm.image_path)} />
                <ItemText label="Gold value" value={String(itemForm.gold_value ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, gold_value: Number(value) || 0 }))} />
                <ItemText label="Weight" value={String(itemForm.weight ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, weight: Number(value) || 0 }))} />
                <ToggleRow label="Stackable" value={Boolean(itemForm.stackable)} onPress={() => setItemForm((current) => ({ ...current, stackable: !current.stackable }))} />
                <ToggleRow label="Sellable" value={Boolean(itemForm.sellable)} onPress={() => setItemForm((current) => ({ ...current, sellable: !current.sellable }))} />
                <ToggleRow label="Usable in battle" value={Boolean(itemForm.usable_in_battle)} onPress={() => setItemForm((current) => ({ ...current, usable_in_battle: !current.usable_in_battle }))} />
                <ToggleRow label="Usable outside battle" value={Boolean(itemForm.usable_outside_battle)} onPress={() => setItemForm((current) => ({ ...current, usable_outside_battle: !current.usable_outside_battle }))} />
                <ChoiceRow label="Use context" options={itemUsageContexts} value={itemForm.usage_context ?? "battle_only"} onSelect={(value) => setItemForm((current) => ({ ...current, usage_context: value, usable_in_battle: value === "battle_only" || value === "both", usable_outside_battle: value === "outside_battle_only" || value === "both" }))} />
                <ItemText label="Crafting value" value={String(itemForm.crafting_value ?? "")} onChange={(value) => setItemForm((current) => ({ ...current, crafting_value: value ? Number(value) || 0 : null }))} />
                <NamedChoiceRow label="Linked ability" options={[{ id: "", label: "None" }, ...adminAbilities.map((ability) => ({ id: ability.id, label: ability.name }))]} value={itemForm.linked_ability_id ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, linked_ability_id: value || null }))} />
                <NamedChoiceRow label="Scroll teaches ability" options={[{ id: "", label: "None" }, ...adminAbilities.map((ability) => ({ id: ability.id, label: ability.name }))]} value={itemForm.teaches_ability_id ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, teaches_ability_id: value || null }))} />
                {(itemForm.type === "weapon" || itemForm.type === "armor" || itemForm.type === "wearable") ? (
                  <ChoiceRow label="Equipment slot" options={equipmentSlots} value={itemForm.equipment_slot ?? "weapon"} onSelect={(value) => setItemForm((current) => ({ ...current, equipment_slot: value }))} />
                ) : null}
                {itemForm.type === "weapon" ? (
                  <>
                    <ItemText label="Damage amount" value={String(itemForm.damage_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, damage_amount: Number(value) || 0 }))} />
                    <ItemText label="Ability name" value={itemForm.ability_name ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, ability_name: value }))} />
                    <ChoiceRow label="Ability cost type" options={costTypes} value={itemForm.ability_cost_type ?? "none"} onSelect={(value) => setItemForm((current) => ({ ...current, ability_cost_type: value }))} />
                    <ItemText label="Ability cost amount" value={String(itemForm.ability_cost_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, ability_cost_amount: Number(value) || 0 }))} />
                    <ChoiceRow label="Element" options={elementalTypes} value={itemForm.elemental_damage_type ?? "none"} onSelect={(value) => setItemForm((current) => ({ ...current, elemental_damage_type: value }))} />
                    <ItemText label="Element damage" value={String(itemForm.elemental_damage_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, elemental_damage_amount: Number(value) || 0 }))} />
                    <ChoiceRow label="On-hit effect" options={["", ...onHitEffects]} value={itemForm.on_hit_effect ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, on_hit_effect: value || null }))} />
                  </>
                ) : null}
                {(itemForm.type === "armor" || itemForm.type === "wearable") ? (
                  <>
                    <ItemText label="Armor value" value={String(itemForm.armor_value ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, armor_value: Number(value) || 0 }))} />
                    <ChoiceRow label="Buff target" options={["", ...buffTargets]} value={itemForm.buff_target ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, buff_target: value || null }))} />
                    <ItemText label="Buff amount" value={String(itemForm.buff_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, buff_amount: Number(value) || 0 }))} />
                  </>
                ) : null}
                {(itemForm.type === "potion" || itemForm.type === "revive potion") ? (
                  <>
                    <ChoiceRow label="Potion target" options={potionTargets} value={itemForm.potion_target ?? "health"} onSelect={(value) => setItemForm((current) => ({ ...current, potion_target: value }))} />
                    <ItemText label="Restore amount" value={String(itemForm.restore_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, restore_amount: Number(value) || 0 }))} />
                    <ItemText label="Restore percent" value={String(itemForm.restore_percent ?? "")} onChange={(value) => setItemForm((current) => ({ ...current, restore_percent: value ? Number(value) || null : null }))} />
                  </>
                ) : null}
                {itemForm.type === "special" ? (
                  <>
                    <ChoiceRow label="Boost target" options={["", ...boostTargets]} value={itemForm.boost_target ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, boost_target: value || null }))} />
                    <ItemText label="Boost amount" value={String(itemForm.boost_amount ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, boost_amount: Number(value) || 0 }))} />
                    <ChoiceRow label="Passive mode" options={["", "owned", "equipped"]} value={itemForm.passive_mode ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, passive_mode: value || null }))} />
                  </>
                ) : null}
                <Pressable style={styles.primaryAdminButton} onPress={() => void saveItem()}>
                  <Text style={styles.primaryAdminText}>{editingItemId ? "Update Item" : "Add Item"}</Text>
                </Pressable>
                {editingItemId ? (
                  <Pressable style={styles.smallButton} onPress={() => { setEditingItemId(null); setItemForm(blankItemDefinition()); }}>
                    <Text style={styles.smallButtonText}>Cancel Edit</Text>
                  </Pressable>
                ) : null}
                {filteredAdminItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    {resolveInventoryImageUri(item.image_path) ? <Image source={{ uri: resolveInventoryImageUri(item.image_path) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                    <View style={styles.itemBody}>
                      <Text style={styles.abilityName}>{item.name}</Text>
                      <Text style={styles.muted}>{item.type} / {item.rarity} / {Number(item.weight ?? 0).toFixed(1)} wt</Text>
                      <View style={styles.slotActions}>
                        <Pressable style={styles.smallButton} onPress={() => void editItem(item)}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                        <Pressable style={styles.smallButton} onPress={() => void grantItem(item.id)}><Text style={styles.smallButtonText}>Grant</Text></Pressable>
                        <Pressable style={styles.smallButton} onPress={() => void deleteItem(item.id)}><Text style={styles.smallButtonText}>Delete</Text></Pressable>
                      </View>
                    </View>
                  </View>
                ))}
                  </>
                ) : null}
                {adminToolTab === "Abilities" ? <Text style={styles.muted}>Open the Abilities tab to manage ability records by type.</Text> : null}
                {adminToolTab === "Enemies" ? <Text style={styles.muted}>Open the Abilities tab to manage enemy records.</Text> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View />
        )}
      </Frame>
    </Screen>
  );
}

function SummaryTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.summaryValue}>
          {value}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.summaryLabel}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function ResourceBar({ label, value, max, color, icon }: { label: string; value: number; max: number; color: string; icon: string }) {
  return (
    <View style={styles.resourceBarCard}>
      <View style={styles.resourceBarHeader}>
        <Text style={[styles.resourceBarIcon, { color }]}>{icon}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.resourceBarLabel, { color }]}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.resourceBarValue}>
        {value} / {max}
      </Text>
      <ProgressBar value={value} max={max || 1} color={color} height={8} />
    </View>
  );
}

function QuickTile({ icon, label, selected, onPress }: { icon: string; label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.quickTile, selected && styles.quickTileSelected]} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74} style={styles.quickLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function AbilitySlotCard({ slot, ability, selectedAbility, onEquip, onClear }: { slot: number; ability: AbilityDefinition | null; selectedAbility: AbilityDefinition | null; onEquip: () => void; onClear: () => void }) {
  return (
    <View style={[styles.monitoredSlot, ability && styles.monitoredSlotFilled]}>
      <Text style={styles.monitoredSlotLabel}>Slot {slot}</Text>
      <View style={styles.monitoredSlotIcon}>
        {ability ? <AbilityIcon ability={ability} /> : <Text style={styles.monitoredSlotEmpty}>+</Text>}
      </View>
      <Text style={styles.monitoredSlotName}>{ability?.name ?? "Empty"}</Text>
      <View style={styles.slotActions}>
        <Pressable style={[styles.smallButton, !selectedAbility && styles.disabledAction]} onPress={onEquip} disabled={!selectedAbility}>
          <Text style={styles.smallButtonText}>{ability ? "Replace" : "Equip"}</Text>
        </Pressable>
        {ability ? <Pressable style={styles.smallButton} onPress={onClear}><Text style={styles.smallButtonText}>Clear</Text></Pressable> : null}
      </View>
    </View>
  );
}

function EquipmentSlotCard({ slot, item, onUnequip }: { slot: "weapon" | "armor" | "necklace" | "ring" | "charm" | "relic"; item: ItemDefinition | null; onUnequip: () => void }) {
  const uri = resolveInventoryImageUri(item?.image_path);
  return (
    <View style={[styles.monitoredSlot, item && styles.monitoredSlotFilled]}>
      <Text style={styles.monitoredSlotLabel}>{slot}</Text>
      <View style={styles.monitoredSlotIcon}>
        {uri ? <Image source={{ uri }} style={styles.monitoredItemImage} /> : <Text style={styles.monitoredSlotEmpty}>{slot.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <Text style={styles.monitoredSlotName}>{item?.name ?? "Empty"}</Text>
      {item ? <Pressable style={styles.smallButton} onPress={onUnequip}><Text style={styles.smallButtonText}>Unequip</Text></Pressable> : null}
    </View>
  );
}

function formatWalkedDistance(meters: number) {
  if (meters < 160.9344) {
    return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
  }

  return `${(meters / 1609.344).toFixed(2)} mi`;
}

function EquippedRow({ slot, item }: { slot: string; item: ItemDefinition | null }) {
  const uri = resolveInventoryImageUri(item?.image_path);
  return (
    <View style={styles.equippedRow}>
      {uri ? <Image source={{ uri }} style={styles.equippedImage} /> : <View style={styles.equippedPlaceholder}><Text style={styles.equippedPlaceholderText}>{slot.slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.equippedBody}>
        <Text style={styles.equippedName}>{item?.name ?? "Empty"}</Text>
        <Text style={styles.equippedDescription}>{item?.description ?? `No ${slot} equipped.`}</Text>
      </View>
      <Text style={styles.equippedSlot}>{slot}</Text>
      <Text style={styles.equippedChevron}>›</Text>
    </View>
  );
}

function InventoryStripItem({ entry }: { entry: InventoryItem }) {
  const uri = resolveInventoryImageUri(entry.item.image_path);
  return (
    <View style={styles.stripItem}>
      {uri ? <Image source={{ uri }} style={styles.stripImage} /> : <View style={styles.stripPlaceholder} />}
      <Text style={styles.stripQuantity}>{entry.quantity}</Text>
    </View>
  );
}

function Resource({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[styles.resourcePill, { borderColor: color }]}>
      <Text style={[styles.resourceLabel, { color }]}>{label}</Text>
      <Text style={styles.resourceValue}>{value}</Text>
    </View>
  );
}

function CombatStat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <View style={styles.combatStatCard}>
      <Text style={styles.combatStatLabel}>{label}</Text>
      <Text style={styles.combatStatValue}>{value}</Text>
      <Text style={styles.combatStatNote}>{note}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ItemText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggleButton, value && styles.toggleButtonActive]} onPress={onPress}>
      <Text style={styles.smallButtonText}>{label}: {value ? "true" : "false"}</Text>
    </Pressable>
  );
}

function AdminImageUploadButton({ folder, onUploaded, onMessage }: { folder: string; onUploaded: (url: string) => void; onMessage: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);

  async function upload() {
    setUploading(true);
    try {
      const url = await pickAndUploadAdminImage(folder);
      onUploaded(url);
      onMessage("Image uploaded and URL added.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable style={[styles.smallButton, uploading && styles.disabledAction]} onPress={() => void upload()} disabled={uploading}>
      <Text style={styles.smallButtonText}>{uploading ? "Uploading..." : "Upload Image"}</Text>
    </Pressable>
  );
}

function AssetPreview({ label, uri }: { label: string; uri: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.previewPlaceholder}>
          <Text style={styles.muted}>No image selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      {failed ? (
        <View style={styles.previewPlaceholder}>
          <Text style={styles.muted}>Image failed to load. Check the URL or asset path.</Text>
          <Text style={styles.muted}>{uri}</Text>
        </View>
      ) : (
        <Image source={{ uri }} style={styles.previewImage} onError={() => setFailed(true)} />
      )}
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  labels,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  value: T | string;
  labels?: Partial<Record<T | string, string>>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option || "none"} style={[styles.choiceButton, value === option && styles.choiceButtonActive]} onPress={() => onSelect(option)}>
            <Text style={styles.choiceText}>{labels?.[option] ?? (option ? String(option).replace(/magika/gi, "Mana") : "none")}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NamedChoiceRow({ label, options, value, onSelect }: { label: string; options: Array<{ id: string; label: string }>; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option.id || "none"} style={[styles.choiceButton, value === option.id && styles.choiceButtonActive]} onPress={() => onSelect(option.id)}>
            <Text style={styles.choiceText}>{option.label || "None"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function defaultSlotForType(type: ItemDefinition["type"]) {
  if (type === "weapon") {
    return "weapon";
  }
  if (type === "armor") {
    return "armor";
  }
  if (type === "wearable") {
    return "charm";
  }
  return null;
}

function getAbilityUnlockLabel(ability: AbilityDefinition) {
  if (ability.source === "default") {
    return "Always known";
  }

  if (ability.source === "weapon") {
    return ability.sourceWeapon ? `From ${ability.sourceWeapon.name}` : "From equipped gear";
  }

  if (ability.attribute) {
    return `${ability.attribute} Lv ${ability.unlockLevel}`;
  }

  return "Learned";
}

function getPlayerAbilityType(ability: AbilityDefinition): (typeof abilityTypeTabs)[number] {
  if (ability.adminAbility?.type) {
    return toAbilityTypeTab(ability.adminAbility.type);
  }

  if (ability.kind === "physical" || ability.kind === "magic" || ability.kind === "divine") {
    return "Attack";
  }

  return "Passive";
}

function getAbilityTypeCounts(abilities: AbilityDefinition[]) {
  return abilityTypeTabs.reduce((counts, tab) => {
    counts[tab] = abilities.filter((ability) => getPlayerAbilityType(ability) === tab).length;
    return counts;
  }, {} as Record<(typeof abilityTypeTabs)[number], number>);
}

function canUseItemOutsideBattle(entry: InventoryItem) {
  return entry.quantity > 0 && isHealingConsumable(entry.item) && canUseItemInContext(entry.item, "outside");
}

function getItemRestoreAmount(item: ItemDefinition, maxHp: number) {
  const percentAmount = item.restore_percent ? Math.ceil(maxHp * (item.restore_percent / 100)) : 0;
  return Math.max(1, Number(item.restore_amount) || 0, percentAmount);
}

function getAbilityImageUri(ability: AbilityDefinition) {
  if (ability.adminAbility?.image_path) {
    return resolveAbilityImageUri(ability.adminAbility.image_path);
  }

  if (ability.sourceWeapon?.image_path) {
    return resolveInventoryImageUri(ability.sourceWeapon.image_path);
  }

  return null;
}

function getAbilityEffectSummary(ability: AbilityDefinition) {
  if (ability.adminAbility) {
    const parts = [
      ability.adminAbility.damage ? `${ability.adminAbility.damage} damage` : null,
      ability.adminAbility.healing ? `${ability.adminAbility.healing} healing` : null,
      ability.adminAbility.defense_amount ? `${ability.adminAbility.defense_amount} defense` : null,
      ability.adminAbility.stamina_restore ? `${ability.adminAbility.stamina_restore} stamina restore` : null,
      ability.adminAbility.magika_restore ? `${ability.adminAbility.magika_restore} mana restore` : null,
      ability.adminAbility.status_effect !== "none" ? `${ability.adminAbility.status_effect} ${ability.adminAbility.effect_amount} for ${ability.adminAbility.effect_duration} turns` : null,
    ].filter(Boolean);

    return parts.join(" / ") || "No direct effect";
  }

  return `${ability.baseDamage} damage + ${ability.attribute ?? "no"} scaling`;
}

function getAbilityDetailedSource(ability: AbilityDefinition) {
  if (ability.source === "weapon") return ability.sourceWeapon ? `weapon: ${ability.sourceWeapon.name}` : "weapon";
  if (ability.source === "admin") return ability.adminAbility?.learn_method ?? "admin";
  if (ability.source === "training") return "learned";
  return "default";
}

function getShortAbilityDescription(ability: AbilityDefinition) {
  const type = getPlayerAbilityType(ability);
  return `${type} / ${getAbilityCostLabel(ability)} / ${ability.attribute ? `${ability.attribute} Lv ${ability.unlockLevel}` : getAbilityDetailedSource(ability)}`;
}

function AbilityIcon({ ability }: { ability: AbilityDefinition }) {
  const imageUri = getAbilityImageUri(ability);

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={styles.abilityIcon} />;
  }

  return (
    <View style={styles.abilityIconFallback}>
      <Text style={styles.abilityIconText}>{ability.name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function itemMatchesCategory(item: ItemDefinition, category: (typeof inventoryCategoryTabs)[number]) {
  if (category === "Weapons") return item.type === "weapon";
  if (category === "Armor") return item.type === "armor";
  if (category === "Wearables") return item.type === "wearable";
  if (category === "Consumables") return ["potion", "revive potion", "consumable", "food", "scroll"].includes(item.type);
  if (category === "Materials") return item.type === "material";
  if (category === "Special") return item.type === "special";
  return item.type === "misc";
}

function toInventoryCategory(type: ItemDefinition["type"]): (typeof inventoryCategoryTabs)[number] {
  if (type === "weapon") return "Weapons";
  if (type === "armor") return "Armor";
  if (type === "wearable") return "Wearables";
  if (["potion", "revive potion", "consumable", "food", "scroll"].includes(type)) return "Consumables";
  if (type === "material") return "Materials";
  if (type === "special") return "Special";
  return "Misc";
}

function toAbilityTypeTab(type: CombatAbility["type"]): (typeof abilityTypeTabs)[number] {
  return type === "attack" ? "Attack" : type === "heal" ? "Heal" : type === "buff" ? "Buff" : type === "debuff" ? "Debuff" : type === "defense" ? "Defense" : "Passive";
}

function getClassChoiceLabels() {
  return classCombinations.reduce<Record<string, string>>((labels, combo) => {
    labels[combo.key] = combo.name;
    return labels;
  }, { "": "None" });
}

function formatAbilityUnlockText(ability: CombatAbility) {
  const parts: string[] = [];
  if (ability.learn_method === "starter") {
    parts.push("Starter");
  } else if (ability.required_attribute) {
    parts.push(`${ability.required_attribute} ${ability.required_attribute_level}`);
  } else {
    parts.push(ability.learn_method || "manual/gear/quest");
  }

  if (ability.required_class_key) {
    const className = classCombinations.find((combo) => combo.key === ability.required_class_key)?.name ?? ability.required_class_key;
    parts.push(className);
  }

  return parts.join(" + ");
}

function getDerivedBattleStats(
  character: CharacterWithDetails,
  resources: ReturnType<typeof getCharacterResources>,
  inventoryBonuses: ReturnType<typeof getInventoryResourceBonuses>,
  equipped: Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>,
  totalInventoryWeight: number,
  carryCapacity: number,
) {
  const attributes = character.attributes;
  const strength = attributes?.strength ?? 0;
  const agility = attributes?.agility ?? 0;
  const intelligence = attributes?.intelligence ?? 0;
  const wisdom = attributes?.wisdom ?? 0;
  const spirit = attributes?.spirit ?? 0;
  const weaponDamage = Number(equipped.weapon?.damage_amount ?? 0) + Number(equipped.weapon?.elemental_damage_amount ?? 0);
  const armorValue = Object.values(equipped).reduce((sum, item) => sum + Number(item?.armor_value ?? 0), 0);
  const meleeAttackBonus = strength + weaponDamage + inventoryBonuses.damage;
  const agilityBonus = Math.floor(agility / 2);
  const defense = 10 + inventoryBonuses.defense;

  return {
    maxHp: resources.maxHp,
    maxStamina: resources.maxStamina,
    maxMagicka: resources.maxMagicka,
    defense,
    meleeAttackBonus,
    agilityBonus,
    spellPower: intelligence + Math.floor(wisdom / 2),
    healingPower: wisdom + Math.floor(spirit / 2),
    spiritPower: spirit,
    critChance: Math.min(35, 5 + Math.floor(agility / 2)),
    armorValue,
    currentWeight: totalInventoryWeight.toFixed(1),
    maxWeight: carryCapacity.toFixed(1),
    weaponName: equipped.weapon?.name ?? "Unarmed",
    armorName: equipped.armor?.name ?? "None",
    gearDamageBonus: inventoryBonuses.damage,
    gearDefenseBonus: inventoryBonuses.defense,
  };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 19,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  homeChrome: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chromeActions: {
    flexDirection: "row",
    gap: 10,
  },
  chromeButton: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(4, 6, 6, 0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  inboxBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2c0808",
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  inboxBadgeText: {
    color: "#fff8ee",
    fontSize: 12,
    fontWeight: "900",
  },
  chromeIcon: {
    color: colors.goldSoft,
    fontSize: 27,
    fontWeight: "900",
  },
  hero: {
    minHeight: 430,
    overflow: "hidden",
    backgroundColor: "#050807",
    justifyContent: "flex-end",
  },
  portrait: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,5,5,0.42)",
  },
  noPortrait: {
    width: "100%",
    height: 430,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  noPortraitText: {
    color: colors.muted,
  },
  heroInfo: {
    gap: 14,
    paddingHorizontal: 26,
    paddingBottom: 30,
    paddingTop: 110,
    zIndex: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 42,
    fontWeight: "900",
  },
  identity: {
    color: colors.gold,
    fontWeight: "700",
    fontSize: 22,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    maxWidth: 360,
  },
  levelBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  levelNumber: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 30,
  },
  levelCopy: {
    flex: 1,
    gap: 6,
  },
  levelLabel: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  statLine: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  xpText: {
    color: colors.muted,
  },
  summaryBand: {
    margin: 12,
    marginTop: -12,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "rgba(5, 9, 10, 0.86)",
  },
  summaryTile: {
    flex: 1,
    minWidth: 135,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
  },
  summaryIcon: {
    color: colors.gold,
    fontSize: 28,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  summaryLabel: {
    color: colors.muted,
    marginTop: 2,
  },
  resourcesPanel: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: "rgba(5, 9, 10, 0.86)",
  },
  resourceBarCard: {
    flex: 1,
    minWidth: 160,
    gap: 8,
    padding: 10,
  },
  resourceBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resourceBarIcon: {
    fontSize: 22,
    fontWeight: "900",
  },
  resourceBarLabel: {
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resourceBarValue: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 24,
    textAlign: "center",
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resourcePill: {
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  resourceLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resourceValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  combatStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  combatStatCard: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 145,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  combatStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  combatStatValue: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },
  combatStatNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  tab: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "rgba(8, 8, 7, 0.9)",
  },
  activeTab: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  tabText: {
    color: colors.muted,
    fontWeight: "800",
  },
  activeTabText: {
    color: colors.text,
  },
  card: {
    margin: 12,
    padding: 14,
    backgroundColor: "rgba(5, 9, 10, 0.78)",
  },
  dashboardSection: {
    gap: 18,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickTile: {
    flex: 1,
    minWidth: 136,
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  quickTileSelected: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  quickIcon: {
    color: colors.goldSoft,
    fontSize: 46,
  },
  quickLabel: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  viewAllButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  viewAllText: {
    color: colors.goldSoft,
    fontWeight: "800",
  },
  equippedList: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    overflow: "hidden",
  },
  equippedRow: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  equippedImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  equippedPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  equippedPlaceholderText: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: "900",
  },
  equippedBody: {
    flex: 1,
    gap: 4,
  },
  equippedName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  equippedDescription: {
    color: colors.muted,
    lineHeight: 19,
  },
  equippedSlot: {
    color: colors.goldSoft,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  equippedChevron: {
    color: colors.muted,
    fontSize: 34,
  },
  inventoryStrip: {
    flexDirection: "row",
    gap: 10,
    overflow: "hidden",
  },
  stripItem: {
    width: 88,
    height: 88,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  stripImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  stripPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  stripQuantity: {
    position: "absolute",
    right: 8,
    bottom: 5,
    color: colors.text,
    fontWeight: "900",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  sectionTitleSmall: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  adminSubPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  subTitle: {
    color: colors.gold,
    fontWeight: "900",
    marginTop: 8,
  },
  abilityMessage: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  slotGrid: {
    gap: 8,
  },
  equippedAbilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  equipmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monitoredSlot: {
    flexGrow: 1,
    flexBasis: 145,
    minWidth: 135,
    minHeight: 168,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  monitoredSlotFilled: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 164, 65, 0.08)",
  },
  monitoredSlotLabel: {
    color: colors.goldSoft,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  monitoredSlotIcon: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,9,10,0.68)",
    overflow: "hidden",
  },
  monitoredItemImage: {
    width: 56,
    height: 56,
    borderRadius: 9,
  },
  monitoredSlotEmpty: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: "900",
  },
  monitoredSlotName: {
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
    minHeight: 36,
  },
  slotCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  slotTitle: {
    color: colors.muted,
    fontWeight: "800",
  },
  slotName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  slotActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
  },
  smallButtonActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.22)",
  },
  disabledAction: {
    opacity: 0.45,
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  abilityList: {
    gap: 8,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  abilityGridCard: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 132,
    minHeight: 166,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  gridIconWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 14,
    textAlign: "center",
  },
  gridCardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "capitalize",
  },
  detailPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(20, 61, 86, 0.28)",
  },
  abilityGroup: {
    gap: 8,
  },
  abilityGroupTitle: {
    color: colors.gold,
    fontWeight: "900",
    marginTop: 8,
  },
  abilityCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  abilityCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  abilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  abilityIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  abilityIconFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  abilityIconText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
  },
  abilityName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    flex: 1,
  },
  abilityTag: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  abilityMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  abilityCost: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  abilityMeta: {
    color: colors.muted,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  selectedHint: {
    color: colors.blue,
    fontWeight: "900",
  },
  itemCard: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  itemCardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  itemImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  itemBody: {
    flex: 1,
    gap: 6,
  },
  detailItemImage: {
    width: 86,
    height: 86,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  detailItemPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  inventoryGridCard: {
    flexGrow: 1,
    flexBasis: 118,
    minWidth: 108,
    minHeight: 142,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  inventoryGridImage: {
    width: 62,
    height: 62,
    borderRadius: 9,
  },
  inventoryGridPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  equippedBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: colors.blue,
    color: "#001018",
    textAlign: "center",
    fontWeight: "900",
    lineHeight: 22,
  },
  itemQtyBadge: {
    position: "absolute",
    top: 7,
    right: 8,
    color: colors.text,
    fontWeight: "900",
  },
  adminBuilder: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 12,
    marginTop: 8,
  },
  inputGroup: {
    gap: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  toggleButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  toggleButtonActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  choiceButtonActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  choiceText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "capitalize",
  },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  previewPlaceholder: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
  },
  primaryAdminButton: {
    minHeight: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryAdminText: {
    color: "#120e08",
    fontWeight: "900",
  },
  infoRow: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  infoLabel: {
    color: colors.muted,
  },
  infoValue: {
    color: colors.text,
    fontWeight: "800",
  },
  attributeGrid: {
    gap: 10,
  },
  attribute: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  attributeName: {
    color: colors.muted,
    textTransform: "capitalize",
  },
  attributeValue: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
});
