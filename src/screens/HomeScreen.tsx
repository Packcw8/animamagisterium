import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import { AbilityDefinition, equipAbility, getAbilityCostLabel, getAbilitySourceLabel, getCombatLoadout, getCharacterResources } from "../services/abilityService";
import {
  blankItemDefinition,
  boostTargets,
  buffTargets,
  costTypes,
  deleteItemDefinition,
  elementalTypes,
  equipmentSlots,
  equipInventoryItem,
  getInventoryResourceBonuses,
  getInventoryState,
  grantItemToCharacter,
  InventoryItem,
  itemTypes,
  onHitEffects,
  potionTargets,
  rarityOptions,
  resolveInventoryImageUri,
  saveItemDefinition,
  sellInventoryItem,
  unequipInventorySlot,
  ItemDefinition,
} from "../services/inventoryService";
import { getCurrentRole, Role } from "../services/mapService";

type HomeScreenProps = {
  character: CharacterWithDetails;
};

const homeTabs = ["Overview", "Identity", "Attributes", "Abilities", "Inventory"] as const;
const attributeKeys = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"] as const;

export function HomeScreen({ character }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<(typeof homeTabs)[number]>("Overview");
  const [unlockedAbilities, setUnlockedAbilities] = useState<AbilityDefinition[]>([]);
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);
  const [abilityMessage, setAbilityMessage] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [equippedItems, setEquippedItems] = useState<Record<string, ItemDefinition | null>>({});
  const [itemForm, setItemForm] = useState<Partial<ItemDefinition>>(blankItemDefinition());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("player");
  const inventoryBonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
  const resources = getCharacterResources(character, {
    maxHp: inventoryBonuses.maxHp,
    maxStamina: inventoryBonuses.maxStamina,
    maxMagicka: inventoryBonuses.maxMagicka,
  });
  const isAdmin = role === "admin";

  useEffect(() => {
    void loadAbilities();
    void loadInventory();
    void getCurrentRole().then(setRole);
  }, [character.id, character.attributes]);

  async function loadAbilities() {
    try {
      const loadout = await getCombatLoadout(character);
      setUnlockedAbilities(loadout.unlocked);
      setEquippedAbilities(loadout.equipped);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to load abilities.");
    }
  }

  async function loadInventory() {
    try {
      const state = await getInventoryState(character.id);
      setInventoryItems(state.items);
      setItemDefinitions(state.definitions);
      setEquippedItems(state.equipped);
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

  async function editItem(item: ItemDefinition) {
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

  async function sellItem(entry: InventoryItem) {
    try {
      await sellInventoryItem(character, entry);
      setInventoryMessage(`${entry.item.name} sold.`);
      await loadInventory();
    } catch (error) {
      setInventoryMessage(error instanceof Error ? error.message : "Unable to sell item.");
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Adventurer Ledger</Text>
        </View>
      </View>

      <Frame style={styles.hero}>
        {character.portrait_url ? (
          <Image source={{ uri: character.portrait_url }} style={styles.portrait} />
        ) : (
          <View style={styles.noPortrait}>
            <Text style={styles.noPortraitText}>Portrait pending</Text>
          </View>
        )}
        <View style={styles.heroInfo}>
          <Text style={styles.name}>{character.name}</Text>
          <Text style={styles.identity}>{character.ancestry ?? "Adventurer"} / {character.origin ?? "Unknown Origin"}</Text>
          <View style={styles.statLine}>
            <Text style={styles.statPill}>Level {character.level}</Text>
            <Text style={styles.statPill}>{character.gold} Gold</Text>
          </View>
          <Text style={styles.xpText}>{character.xp.toLocaleString()} XP</Text>
          <ProgressBar value={character.xp % 1000} max={1000} color={colors.blue} height={9} />
          <View style={styles.resourceGrid}>
            <Resource label="HP" value={resources.maxHp} color={colors.red} />
            <Resource label="Stamina" value={resources.maxStamina} color={colors.gold} />
            <Resource label="Magika" value={resources.maxMagicka} color={colors.blue} />
          </View>
        </View>
      </Frame>

      <View style={styles.tabs}>
        {homeTabs.map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <Frame style={styles.card}>
        {activeTab === "Overview" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Info label="Race" value={character.ancestry ?? "Not set"} />
            <Info label="Origin" value={character.origin ?? "Not set"} />
            <Text style={styles.muted}>Progression comes from your actions after entering the world, not from onboarding choices.</Text>
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
        ) : activeTab === "Abilities" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ability Management</Text>
            <Text style={styles.muted}>Punch is always available. Training and equipped weapons add more abilities. Equip up to four before combat.</Text>
            {abilityMessage ? <Text style={styles.abilityMessage}>{abilityMessage}</Text> : null}
            <Text style={styles.subTitle}>Equipped Slots</Text>
            <View style={styles.slotGrid}>
              {equippedAbilities.map((ability, index) => (
                <View key={`slot-${index + 1}`} style={styles.slotCard}>
                  <Text style={styles.slotTitle}>Slot {index + 1}</Text>
                  <Text style={styles.slotName}>{ability?.name ?? "Empty"}</Text>
                  <View style={styles.slotActions}>
                    <Pressable style={styles.smallButton} onPress={() => void equipSelectedAbility(index + 1)}>
                      <Text style={styles.smallButtonText}>Equip Here</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => void clearSlot(index + 1)}>
                      <Text style={styles.smallButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.subTitle}>Unlocked Abilities</Text>
            {unlockedAbilities.length === 0 ? (
              <Text style={styles.muted}>Train an attribute to level 1 to unlock its first ability.</Text>
            ) : (
              <View style={styles.abilityList}>
                {unlockedAbilities.map((ability) => (
                  <Pressable
                    key={ability.key}
                    style={[styles.abilityCard, selectedAbilityKey === ability.key && styles.abilityCardActive]}
                    onPress={() => setSelectedAbilityKey(ability.key)}
                  >
                    <Text style={styles.abilityName}>{ability.name}</Text>
                    <Text style={styles.muted}>{ability.description}</Text>
                    <Text style={styles.abilityCost}>{getAbilitySourceLabel(ability)} / {getAbilityCostLabel(ability)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory</Text>
            {inventoryMessage ? <Text style={styles.abilityMessage}>{inventoryMessage}</Text> : null}
            <Text style={styles.subTitle}>Equipped</Text>
            <View style={styles.slotGrid}>
              {equipmentSlots.map((slot) => (
                <View key={slot} style={styles.slotCard}>
                  <Text style={styles.slotTitle}>{slot}</Text>
                  <Text style={styles.slotName}>{equippedItems[slot]?.name ?? "Empty"}</Text>
                  {equippedItems[slot] ? (
                    <Pressable style={styles.smallButton} onPress={() => void unequipSlot(slot)}>
                      <Text style={styles.smallButtonText}>Unequip</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={styles.subTitle}>Inventory</Text>
            <View style={styles.abilityList}>
              {inventoryItems.length === 0 ? <Text style={styles.muted}>No items yet.</Text> : null}
              {inventoryItems.map((entry) => (
                <View key={entry.id} style={styles.itemCard}>
                  {resolveInventoryImageUri(entry.item.image_path) ? <Image source={{ uri: resolveInventoryImageUri(entry.item.image_path) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                  <View style={styles.itemBody}>
                    <Text style={styles.abilityName}>{entry.item.name}{entry.equippedSlot ? " - Equipped" : ""}</Text>
                    <Text style={styles.muted}>{entry.item.type} / {entry.item.rarity} / Qty {entry.quantity} / {entry.item.gold_value} gold</Text>
                    <Text style={styles.muted}>{entry.item.description ?? "No description."}</Text>
                    <View style={styles.slotActions}>
                      {entry.item.equipment_slot ? (
                        <Pressable style={styles.smallButton} onPress={() => void equipItem(entry)}>
                          <Text style={styles.smallButtonText}>Equip</Text>
                        </Pressable>
                      ) : null}
                      {entry.equippedSlot ? (
                        <Pressable style={styles.smallButton} onPress={() => void unequipSlot(entry.equippedSlot as "weapon" | "armor" | "necklace" | "ring" | "charm" | "relic")}>
                          <Text style={styles.smallButtonText}>Unequip</Text>
                        </Pressable>
                      ) : null}
                      {entry.item.usable_outside_battle ? (
                        <Pressable style={styles.smallButton}>
                          <Text style={styles.smallButtonText}>Use</Text>
                        </Pressable>
                      ) : null}
                      {entry.item.sellable ? (
                        <Pressable style={styles.smallButton} onPress={() => void sellItem(entry)}>
                          <Text style={styles.smallButtonText}>Sell</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {isAdmin ? (
              <View style={styles.adminBuilder}>
                <Text style={styles.sectionTitle}>Admin Items</Text>
                <Text style={styles.muted}>Create/edit items. Use /assets/InventoryItems/filename.png, paste a full URL, or type just the filename.</Text>
                <ItemText label="Name" value={itemForm.name ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, name: value }))} />
                <ChoiceRow label="Type" options={itemTypes} value={itemForm.type ?? "misc"} onSelect={(value) => setItemForm((current) => ({ ...current, type: value, equipment_slot: defaultSlotForType(value) }))} />
                <ChoiceRow label="Rarity" options={rarityOptions} value={itemForm.rarity ?? "common"} onSelect={(value) => setItemForm((current) => ({ ...current, rarity: value }))} />
                <ItemText label="Description" value={itemForm.description ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, description: value }))} />
                <ItemText label="Image path" value={itemForm.image_path ?? ""} onChange={(value) => setItemForm((current) => ({ ...current, image_path: value }))} />
                {resolveInventoryImageUri(itemForm.image_path) ? <Image source={{ uri: resolveInventoryImageUri(itemForm.image_path) ?? "" }} style={styles.previewImage} /> : null}
                <ItemText label="Gold value" value={String(itemForm.gold_value ?? 0)} onChange={(value) => setItemForm((current) => ({ ...current, gold_value: Number(value) || 0 }))} />
                <ToggleRow label="Stackable" value={Boolean(itemForm.stackable)} onPress={() => setItemForm((current) => ({ ...current, stackable: !current.stackable }))} />
                <ToggleRow label="Sellable" value={Boolean(itemForm.sellable)} onPress={() => setItemForm((current) => ({ ...current, sellable: !current.sellable }))} />
                <ToggleRow label="Usable in battle" value={Boolean(itemForm.usable_in_battle)} onPress={() => setItemForm((current) => ({ ...current, usable_in_battle: !current.usable_in_battle }))} />
                <ToggleRow label="Usable outside battle" value={Boolean(itemForm.usable_outside_battle)} onPress={() => setItemForm((current) => ({ ...current, usable_outside_battle: !current.usable_outside_battle }))} />
                <ItemText label="Crafting value" value={String(itemForm.crafting_value ?? "")} onChange={(value) => setItemForm((current) => ({ ...current, crafting_value: value ? Number(value) || 0 : null }))} />
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
                {itemDefinitions.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    {resolveInventoryImageUri(item.image_path) ? <Image source={{ uri: resolveInventoryImageUri(item.image_path) ?? "" }} style={styles.itemImage} /> : <View style={styles.itemImagePlaceholder} />}
                    <View style={styles.itemBody}>
                      <Text style={styles.abilityName}>{item.name}</Text>
                      <Text style={styles.muted}>{item.type} / {item.rarity}</Text>
                      <View style={styles.slotActions}>
                        <Pressable style={styles.smallButton} onPress={() => void editItem(item)}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                        <Pressable style={styles.smallButton} onPress={() => void grantItem(item.id)}><Text style={styles.smallButtonText}>Grant</Text></Pressable>
                        <Pressable style={styles.smallButton} onPress={() => void deleteItem(item.id)}><Text style={styles.smallButtonText}>Delete</Text></Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </Frame>
    </Screen>
  );
}

function Resource({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.resourcePill, { borderColor: color }]}>
      <Text style={[styles.resourceLabel, { color }]}>{label}</Text>
      <Text style={styles.resourceValue}>{value}</Text>
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

function ChoiceRow<T extends string>({ label, options, value, onSelect }: { label: string; options: readonly T[]; value: T | string; onSelect: (value: T) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option || "none"} style={[styles.choiceButton, value === option && styles.choiceButtonActive]} onPress={() => onSelect(option)}>
            <Text style={styles.choiceText}>{option || "none"}</Text>
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
  hero: {
    margin: 12,
    padding: 12,
    gap: 12,
  },
  portrait: {
    width: "100%",
    height: 330,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  noPortrait: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  noPortraitText: {
    color: colors.muted,
  },
  heroInfo: {
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  identity: {
    color: colors.gold,
    fontWeight: "700",
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
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  abilityList: {
    gap: 8,
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
  abilityName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  abilityCost: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "capitalize",
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
