import { supabase, type Tables } from "../lib/supabase";
import type { InventoryItem, ItemDefinition } from "./inventoryService";

export type CraftingRecipe = Tables["crafting_recipes"];
export type CraftingRecipeIngredient = Tables["crafting_recipe_ingredients"];
export type CraftingRecipeWithIngredients = CraftingRecipe & {
  ingredients: CraftingRecipeIngredient[];
};

export const craftingStationTypes = ["all", "forge", "cooking", "alchemy", "workbench", "enchanting"] as const;
export const craftingCategories = ["materials", "weapons", "armor", "consumables", "tools", "quest", "misc"] as const;
export const craftingContentScopes = ["chapter", "universal"] as const;

export type CraftingStatus = {
  canCraft: boolean;
  hasBlueprint: boolean;
  missingBlueprint: { itemId: string; needed: number; owned: number } | null;
  missing: Array<{ itemId: string; needed: number; owned: number }>;
};

export function blankCraftingRecipe(): Partial<CraftingRecipe> {
  return {
    name: "",
    description: "",
    output_item_id: "",
    output_quantity: 1,
    station_type: "",
    content_scope: "chapter",
    category: "materials",
    sort_order: 0,
    required_blueprint_item_id: null,
    required_blueprint_quantity: 1,
    required_story_flag_key: "",
    required_story_flag_value: true,
    is_active: true,
    season_number: 1,
    chapter_number: 1,
  };
}

export async function getCraftingRecipes() {
  const [recipesResult, ingredientsResult] = await Promise.all([
    supabase
      .from("crafting_recipes")
      .select("*")
      .order("season_number", { ascending: true })
      .order("chapter_number", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("crafting_recipe_ingredients")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  if (recipesResult.error) {
    throw recipesResult.error;
  }

  if (ingredientsResult.error) {
    throw ingredientsResult.error;
  }

  return attachIngredients(
    (recipesResult.data ?? []) as CraftingRecipe[],
    (ingredientsResult.data ?? []) as CraftingRecipeIngredient[],
  );
}

export async function getCraftingRecipesForChapter(seasonNumber: number, chapterNumber: number) {
  const recipes = await getCraftingRecipes();
  return recipes.filter((recipe) => {
    if (!recipe.is_active) {
      return false;
    }
    if ((recipe.content_scope ?? "chapter") === "universal") {
      return true;
    }
    return Number(recipe.season_number ?? 1) === seasonNumber && Number(recipe.chapter_number ?? 1) === chapterNumber;
  });
}

export async function saveCraftingRecipe(input: Partial<CraftingRecipe>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const values = normalizeRecipeInput(input, user?.id ?? null);
  const request = input.id
    ? supabase.from("crafting_recipes").update(values).eq("id", input.id).select().single()
    : supabase.from("crafting_recipes").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as CraftingRecipe;
}

export async function saveCraftingRecipeIngredients(recipeId: string, ingredients: Array<Partial<CraftingRecipeIngredient>>) {
  const normalized = ingredients
    .filter((ingredient) => ingredient.item_id)
    .map((ingredient, index) => ({
      recipe_id: recipeId,
      item_id: ingredient.item_id as string,
      quantity: Math.max(1, Math.floor(Number(ingredient.quantity) || 1)),
      sort_order: index,
      updated_at: new Date().toISOString(),
    }));

  const { error: deleteError } = await supabase.from("crafting_recipe_ingredients").delete().eq("recipe_id", recipeId);

  if (deleteError) {
    throw deleteError;
  }

  if (normalized.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("crafting_recipe_ingredients").insert(normalized).select("*");

  if (error) {
    throw error;
  }

  return (data ?? []) as CraftingRecipeIngredient[];
}

export async function deleteCraftingRecipe(recipeId: string) {
  const { error } = await supabase.from("crafting_recipes").delete().eq("id", recipeId);

  if (error) {
    throw error;
  }
}

export async function craftRecipe(characterId: string, recipeId: string) {
  const { data, error } = await supabase.rpc("craft_item_atomic", {
    p_character_id: characterId,
    p_recipe_id: recipeId,
  });

  if (error) {
    throw error;
  }

  return data as { crafted: boolean; recipe_id: string; output_item_id: string; output_quantity: number };
}

export function getCraftingStatus(recipe: CraftingRecipeWithIngredients, inventoryItems: InventoryItem[]): CraftingStatus {
  const ownedByItemId = new Map(inventoryItems.map((entry) => [entry.item_id, entry.quantity]));
  const blueprintItemId = recipe.required_blueprint_item_id ?? null;
  const blueprintNeeded = Math.max(1, Number(recipe.required_blueprint_quantity ?? 1) || 1);
  const blueprintOwned = blueprintItemId ? ownedByItemId.get(blueprintItemId) ?? 0 : 0;
  const missingBlueprint = blueprintItemId && blueprintOwned < blueprintNeeded
    ? { itemId: blueprintItemId, needed: blueprintNeeded, owned: blueprintOwned }
    : null;
  const missing = recipe.ingredients
    .map((ingredient) => ({
      itemId: ingredient.item_id,
      needed: Math.max(1, Number(ingredient.quantity) || 1),
      owned: ownedByItemId.get(ingredient.item_id) ?? 0,
    }))
    .filter((entry) => entry.owned < entry.needed);

  return {
    canCraft: recipe.ingredients.length > 0 && !missingBlueprint && missing.length === 0,
    hasBlueprint: !missingBlueprint,
    missingBlueprint,
    missing,
  };
}

export function getMaxCraftableCount(recipe: CraftingRecipeWithIngredients, inventoryItems: InventoryItem[]) {
  const status = getCraftingStatus(recipe, inventoryItems);
  if (!status.hasBlueprint || recipe.ingredients.length === 0) {
    return 0;
  }

  const ownedByItemId = new Map(inventoryItems.map((entry) => [entry.item_id, entry.quantity]));
  return recipe.ingredients.reduce((maxCount, ingredient) => {
    const needed = Math.max(1, Number(ingredient.quantity) || 1);
    const owned = ownedByItemId.get(ingredient.item_id) ?? 0;
    return Math.min(maxCount, Math.floor(owned / needed));
  }, Number.MAX_SAFE_INTEGER);
}

export function getCraftingItemName(items: ItemDefinition[], itemId: string | null | undefined) {
  return items.find((item) => item.id === itemId)?.name ?? "Unknown Item";
}

function attachIngredients(recipes: CraftingRecipe[], ingredients: CraftingRecipeIngredient[]) {
  const ingredientsByRecipeId = new Map<string, CraftingRecipeIngredient[]>();
  ingredients.forEach((ingredient) => {
    const list = ingredientsByRecipeId.get(ingredient.recipe_id) ?? [];
    list.push(ingredient);
    ingredientsByRecipeId.set(ingredient.recipe_id, list);
  });

  return recipes.map((recipe) => ({
    ...recipe,
    ingredients: ingredientsByRecipeId.get(recipe.id) ?? [],
  }));
}

function normalizeRecipeInput(input: Partial<CraftingRecipe>, userId: string | null) {
  return {
    name: input.name?.trim() || "New Recipe",
    description: input.description?.trim() || null,
    output_item_id: input.output_item_id || null,
    output_quantity: Math.max(1, Math.floor(Number(input.output_quantity) || 1)),
    station_type: input.station_type?.trim() || null,
    content_scope: input.content_scope === "universal" ? "universal" : "chapter",
    category: input.category?.trim() || null,
    sort_order: Math.floor(Number(input.sort_order) || 0),
    required_blueprint_item_id: input.required_blueprint_item_id || null,
    required_blueprint_quantity: Math.max(1, Math.floor(Number(input.required_blueprint_quantity) || 1)),
    required_story_flag_key: input.required_story_flag_key?.trim() || null,
    required_story_flag_value: input.required_story_flag_value ?? true,
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}
