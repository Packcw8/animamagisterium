import { supabase, type Tables } from "../lib/supabase";
import type { ItemDefinition } from "./inventoryService";

export type PlayerBankAccount = Tables["player_bank_accounts"];
export type PlayerBankItemRow = Tables["player_bank_items"];

export type BankItem = PlayerBankItemRow & {
  item: ItemDefinition;
};

export type PlayerBankState = {
  account: PlayerBankAccount;
  items: BankItem[];
};

export async function getPlayerBankState(characterId: string, itemDefinitions: ItemDefinition[]): Promise<PlayerBankState> {
  const account = await ensurePlayerBankAccount(characterId);
  const { data, error } = await supabase
    .from("player_bank_items")
    .select("*")
    .eq("character_id", characterId)
    .gt("quantity", 0)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const itemById = new Map(itemDefinitions.map((item) => [item.id, item]));
  const items = ((data ?? []) as PlayerBankItemRow[])
    .map((row) => {
      const item = itemById.get(row.item_id);
      return item ? { ...row, item } : null;
    })
    .filter(Boolean) as BankItem[];

  return { account, items };
}

export async function ensurePlayerBankAccount(characterId: string) {
  const { data, error } = await supabase.rpc("ensure_player_bank_account", {
    p_character_id: characterId,
  });

  if (error) {
    throw error;
  }

  return data as PlayerBankAccount;
}

export async function depositGoldToBank(characterId: string, amount: number) {
  const safeAmount = normalizeBankAmount(amount);
  const { data, error } = await supabase.rpc("deposit_character_gold_to_bank", {
    p_character_id: characterId,
    p_amount: safeAmount,
  });

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

export async function withdrawGoldFromBank(characterId: string, amount: number) {
  const safeAmount = normalizeBankAmount(amount);
  const { data, error } = await supabase.rpc("withdraw_character_gold_from_bank", {
    p_character_id: characterId,
    p_amount: safeAmount,
  });

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

export async function depositItemToBank(characterId: string, itemId: string, quantity: number) {
  const { error } = await supabase.rpc("deposit_character_item_to_bank", {
    p_character_id: characterId,
    p_item_id: itemId,
    p_quantity: normalizeBankAmount(quantity),
  });

  if (error) {
    throw error;
  }
}

export async function withdrawItemFromBank(characterId: string, itemId: string, quantity: number) {
  const { error } = await supabase.rpc("withdraw_character_item_from_bank", {
    p_character_id: characterId,
    p_item_id: itemId,
    p_quantity: normalizeBankAmount(quantity),
  });

  if (error) {
    throw error;
  }
}

function normalizeBankAmount(amount: number) {
  return Math.max(1, Math.floor(Number(amount) || 1));
}
