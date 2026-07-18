import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ItemPicker } from "../map/MarkerEditorControls";
import { colors, fonts } from "../theme";
import {
  blankCraftingRecipe,
  deleteCraftingRecipe,
  getCraftingItemName,
  getCraftingRecipes,
  saveCraftingRecipe,
  saveCraftingRecipeIngredients,
  type CraftingRecipe,
  type CraftingRecipeIngredient,
  type CraftingRecipeWithIngredients,
} from "../../services/craftingService";
import type { ItemDefinition } from "../../services/inventoryService";

type IngredientDraft = Pick<CraftingRecipeIngredient, "item_id" | "quantity">;

type CraftingAdminPanelProps = {
  itemDefinitions: ItemDefinition[];
  seasonNumber: number;
  chapterNumber: number;
  onMessage?: (message: string) => void;
};

export function CraftingAdminPanel({ itemDefinitions, seasonNumber, chapterNumber, onMessage }: CraftingAdminPanelProps) {
  const [recipes, setRecipes] = useState<CraftingRecipeWithIngredients[]>([]);
  const [recipeForm, setRecipeForm] = useState<Partial<CraftingRecipe>>({ ...blankCraftingRecipe(), season_number: seasonNumber, chapter_number: chapterNumber });
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [ingredientDrafts, setIngredientDrafts] = useState<IngredientDraft[]>([]);
  const [selectedIngredientItemId, setSelectedIngredientItemId] = useState<string | null>(null);
  const [ingredientQuantity, setIngredientQuantity] = useState("1");
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const scopedRecipes = useMemo(
    () => recipes.filter((recipe) => Number(recipe.season_number ?? 1) === seasonNumber && Number(recipe.chapter_number ?? 1) === chapterNumber),
    [chapterNumber, recipes, seasonNumber],
  );
  const materialItems = useMemo(() => {
    const materials = itemDefinitions.filter((item) => item.type === "material");
    return materials.length > 0 ? materials : itemDefinitions;
  }, [itemDefinitions]);

  useEffect(() => {
    void loadRecipes();
  }, []);

  useEffect(() => {
    if (!editingRecipeId) {
      setRecipeForm((current) => ({ ...current, season_number: seasonNumber, chapter_number: chapterNumber }));
    }
  }, [chapterNumber, editingRecipeId, seasonNumber]);

  async function loadRecipes() {
    try {
      setRecipes(await getCraftingRecipes());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load crafting recipes.");
    }
  }

  function setMessage(message: string) {
    setLocalMessage(message);
    onMessage?.(message);
  }

  function addIngredientDraft() {
    if (!selectedIngredientItemId) {
      setMessage("Choose a material first.");
      return;
    }

    const quantity = Math.max(1, Math.floor(Number(ingredientQuantity) || 1));
    setIngredientDrafts((current) => {
      const existing = current.find((ingredient) => ingredient.item_id === selectedIngredientItemId);
      if (existing) {
        return current.map((ingredient) => ingredient.item_id === selectedIngredientItemId ? { ...ingredient, quantity } : ingredient);
      }
      return [...current, { item_id: selectedIngredientItemId, quantity }];
    });
    setSelectedIngredientItemId(null);
    setIngredientQuantity("1");
  }

  async function saveRecipe() {
    try {
      if (!recipeForm.output_item_id) {
        setMessage("Choose the item this recipe creates.");
        return;
      }
      if (ingredientDrafts.length === 0) {
        setMessage("Add at least one crafting material.");
        return;
      }

      const saved = await saveCraftingRecipe({
        ...recipeForm,
        id: editingRecipeId ?? undefined,
        season_number: seasonNumber,
        chapter_number: chapterNumber,
      });
      await saveCraftingRecipeIngredients(saved.id, ingredientDrafts);
      resetForm();
      await loadRecipes();
      setMessage(`${saved.name} recipe saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save crafting recipe.");
    }
  }

  async function removeRecipe(recipeId: string) {
    try {
      await deleteCraftingRecipe(recipeId);
      if (editingRecipeId === recipeId) {
        resetForm();
      }
      await loadRecipes();
      setMessage("Recipe deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete recipe.");
    }
  }

  function editRecipe(recipe: CraftingRecipeWithIngredients) {
    setEditingRecipeId(recipe.id);
    setRecipeForm(recipe);
    setIngredientDrafts(recipe.ingredients.map((ingredient) => ({ item_id: ingredient.item_id, quantity: ingredient.quantity })));
  }

  function resetForm() {
    setEditingRecipeId(null);
    setRecipeForm({ ...blankCraftingRecipe(), season_number: seasonNumber, chapter_number: chapterNumber });
    setIngredientDrafts([]);
    setSelectedIngredientItemId(null);
    setIngredientQuantity("1");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Crafting Admin</Text>
      <Text style={styles.copy}>Create recipes from material items. A Crafting marker will show active recipes for the player's current chapter.</Text>
      {localMessage ? <Text style={styles.message}>{localMessage}</Text> : null}

      <View style={styles.builder}>
        <Text style={styles.subTitle}>{editingRecipeId ? "Edit Recipe" : "Recipe Builder"}</Text>
        <Field label="Recipe name" value={recipeForm.name ?? ""} onChange={(value) => setRecipeForm((current) => ({ ...current, name: value }))} />
        <Field label="Description" value={recipeForm.description ?? ""} onChange={(value) => setRecipeForm((current) => ({ ...current, description: value }))} />
        <ItemPicker label="Creates item" items={itemDefinitions} selectedId={recipeForm.output_item_id || null} onSelect={(id) => setRecipeForm((current) => ({ ...current, output_item_id: id ?? "" }))} />
        <Field label="Creates quantity" value={String(recipeForm.output_quantity ?? 1)} keyboardType="numeric" onChange={(value) => setRecipeForm((current) => ({ ...current, output_quantity: Number(value) || 1 }))} />
        <Field label="Station label, optional" value={recipeForm.station_type ?? ""} onChange={(value) => setRecipeForm((current) => ({ ...current, station_type: value }))} />
        <ToggleRow label="Active" value={recipeForm.is_active ?? true} onPress={() => setRecipeForm((current) => ({ ...current, is_active: !(current.is_active ?? true) }))} />

        <Text style={styles.subTitle}>Materials</Text>
        <ItemPicker label="Material item" items={materialItems} selectedId={selectedIngredientItemId} onSelect={setSelectedIngredientItemId} />
        <View style={styles.inline}>
          <View style={styles.inlineGrow}>
            <Field label="Quantity needed" value={ingredientQuantity} keyboardType="numeric" onChange={setIngredientQuantity} />
          </View>
          <Pressable style={styles.smallButton} onPress={addIngredientDraft}>
            <Text style={styles.smallButtonText}>Add</Text>
          </Pressable>
        </View>

        {ingredientDrafts.length === 0 ? <Text style={styles.copy}>No materials added yet.</Text> : null}
        {ingredientDrafts.map((ingredient) => (
          <View key={ingredient.item_id} style={styles.ingredientRow}>
            <Text style={styles.ingredientName}>{getCraftingItemName(itemDefinitions, ingredient.item_id)}</Text>
            <Text style={styles.ingredientQty}>x{ingredient.quantity}</Text>
            <Pressable style={styles.removeButton} onPress={() => setIngredientDrafts((current) => current.filter((entry) => entry.item_id !== ingredient.item_id))}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.primaryButton} onPress={() => void saveRecipe()}>
          <Text style={styles.primaryText}>{editingRecipeId ? "Update Recipe" : "Create Recipe"}</Text>
        </Pressable>
        {editingRecipeId ? (
          <Pressable style={styles.secondaryButton} onPress={resetForm}>
            <Text style={styles.secondaryText}>Cancel Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.subTitle}>Recipes In This Chapter</Text>
      {scopedRecipes.length === 0 ? <Text style={styles.copy}>No recipes in this chapter yet.</Text> : null}
      {scopedRecipes.map((recipe) => (
        <View key={recipe.id} style={styles.recipeCard}>
          <View style={styles.recipeHeader}>
            <View style={styles.recipeBody}>
              <Text style={styles.recipeName}>{recipe.name}</Text>
              <Text style={styles.copy}>Creates {recipe.output_quantity} {getCraftingItemName(itemDefinitions, recipe.output_item_id)}</Text>
              <Text style={styles.copy}>{recipe.ingredients.map((ingredient) => `${getCraftingItemName(itemDefinitions, ingredient.item_id)} x${ingredient.quantity}`).join(" + ") || "No materials"}</Text>
            </View>
            <Text style={recipe.is_active ? styles.activePill : styles.inactivePill}>{recipe.is_active ? "Active" : "Inactive"}</Text>
          </View>
          <View style={styles.inline}>
            <Pressable style={styles.smallButton} onPress={() => editRecipe(recipe)}>
              <Text style={styles.smallButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => void removeRecipe(recipe.id)}>
              <Text style={styles.smallButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function Field({ label, value, onChange, keyboardType = "default" }: { label: string; value: string; onChange: (value: string) => void; keyboardType?: "default" | "numeric" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, value && styles.toggleActive]} onPress={onPress}>
      <Text style={styles.toggleText}>{label}: {value ? "Yes" : "No"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activePill: {
    color: colors.green,
    fontWeight: "900",
  },
  builder: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  inactivePill: {
    color: colors.red,
    fontWeight: "900",
  },
  ingredientName: {
    color: colors.text,
    flex: 1,
    fontWeight: "800",
  },
  ingredientQty: {
    color: colors.gold,
    fontWeight: "900",
  },
  ingredientRow: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  inline: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineGrow: {
    flex: 1,
    minWidth: 160,
  },
  input: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  label: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  message: {
    color: colors.blue,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryText: {
    color: "#050403",
    fontWeight: "900",
  },
  recipeBody: {
    flex: 1,
    gap: 4,
  },
  recipeCard: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  recipeHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  recipeName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  removeButton: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeText: {
    color: colors.red,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  smallButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  subTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  toggle: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  toggleActive: {
    backgroundColor: "rgba(2, 172, 231, 0.18)",
    borderColor: colors.blue,
  },
  toggleText: {
    color: colors.blue,
    fontWeight: "900",
  },
  wrap: {
    gap: 12,
  },
});
