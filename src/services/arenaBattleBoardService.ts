import { supabase, Tables } from "../lib/supabase";
import type { MarkerBattleCombatant } from "./battlefieldService";

export type ArenaBattleSlot = Tables["arena_battle_slots"];
export type ArenaBattleSlotType = ArenaBattleSlot["slot_type"];

export const arenaBattleSlotTypes: Array<{ key: ArenaBattleSlotType; label: string; side: MarkerBattleCombatant["side"] }> = [
  { key: "challenger_start", label: "Challenger Start", side: "player" },
  { key: "holder_start", label: "Holder Start", side: "enemy" },
];

export async function getArenaBattleSlots(arenaId: string) {
  const { data, error } = await supabase
    .from("arena_battle_slots")
    .select("*")
    .eq("arena_id", arenaId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ArenaBattleSlot[];
}

export async function saveArenaBattleSlot(input: Partial<ArenaBattleSlot> & { arena_id: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    arena_id: input.arena_id,
    slot_type: input.slot_type === "challenger_start" ? "challenger_start" : "holder_start",
    label: input.label?.trim() || null,
    x_percent: clampPercent(Number(input.x_percent ?? 50)),
    y_percent: clampPercent(Number(input.y_percent ?? 50)),
    size_percent: Math.max(8, Math.min(34, Number(input.size_percent ?? 16) || 16)),
    sort_order: Math.max(1, Number(input.sort_order ?? 1) || 1),
    is_active: input.is_active !== false,
    created_by: input.id ? undefined : userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("arena_battle_slots").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("arena_battle_slots").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as ArenaBattleSlot;
}

export async function deleteArenaBattleSlot(slotId: string) {
  const { error } = await supabase.from("arena_battle_slots").delete().eq("id", slotId);

  if (error) {
    throw error;
  }
}

export function buildArenaBattleLayout(slots: ArenaBattleSlot[], arenaId: string) {
  const activeSlots = slots.filter((slot) => slot.is_active);
  const holderSlot = activeSlots.find((slot) => slot.slot_type === "holder_start") ?? null;
  const combatants = activeSlots.map((slot) => arenaSlotToCombatant(slot, arenaId));

  return {
    combatants,
    holderCombatant: holderSlot ? arenaSlotToCombatant(holderSlot, arenaId) : null,
  };
}

export function getArenaSlotLabel(slotType: ArenaBattleSlotType) {
  return arenaBattleSlotTypes.find((item) => item.key === slotType)?.label ?? "Arena Slot";
}

function arenaSlotToCombatant(slot: ArenaBattleSlot, arenaId: string): MarkerBattleCombatant {
  const slotMeta = arenaBattleSlotTypes.find((item) => item.key === slot.slot_type) ?? arenaBattleSlotTypes[1];

  return {
    id: slot.id,
    marker_id: arenaId,
    side: slotMeta.side,
    enemy_id: null,
    npc_id: null,
    label: slot.label || slotMeta.label,
    x_percent: slot.x_percent,
    y_percent: slot.y_percent,
    size_percent: slot.size_percent,
    sort_order: slot.sort_order,
    is_boss: slot.slot_type === "holder_start",
    is_active: slot.is_active,
    created_by: slot.created_by,
    created_at: slot.created_at,
    updated_at: slot.updated_at,
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}
