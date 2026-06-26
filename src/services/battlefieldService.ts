import { supabase, Tables } from "../lib/supabase";

export type BattleEventCombatant = Tables["battle_event_combatants"];
export type MarkerBattleCombatant = Tables["marker_battle_combatants"];

export type BattleEventCombatantInput = Partial<BattleEventCombatant> & {
  event_id: string;
};

export async function getBattleEventCombatants(eventId: string) {
  const { data, error } = await supabase
    .from("battle_event_combatants")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BattleEventCombatant[];
}

export async function saveBattleEventCombatant(input: BattleEventCombatantInput) {
  const { data: userData } = await supabase.auth.getUser();
  const payload = normalizeCombatantPayload(input, userData.user?.id ?? null);
  const query = input.id
    ? supabase.from("battle_event_combatants").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("battle_event_combatants").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as BattleEventCombatant;
}

export async function deleteBattleEventCombatant(combatantId: string) {
  const { error } = await supabase.from("battle_event_combatants").delete().eq("id", combatantId);

  if (error) {
    throw error;
  }
}

export async function getMarkerBattleCombatants(markerId: string) {
  const { data, error } = await supabase
    .from("marker_battle_combatants")
    .select("*")
    .eq("marker_id", markerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MarkerBattleCombatant[];
}

export async function saveMarkerBattleCombatant(input: Partial<MarkerBattleCombatant> & { marker_id: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const payload = normalizeCombatantPayload({ ...input, event_id: input.marker_id }, userData.user?.id ?? null);
  const markerPayload = {
    ...payload,
    marker_id: input.marker_id,
  };
  delete (markerPayload as Partial<typeof markerPayload> & { event_id?: string }).event_id;

  const query = input.id
    ? supabase.from("marker_battle_combatants").update(markerPayload).eq("id", input.id).select("*").single()
    : supabase.from("marker_battle_combatants").insert(markerPayload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as MarkerBattleCombatant;
}

export async function deleteMarkerBattleCombatant(combatantId: string) {
  const { error } = await supabase.from("marker_battle_combatants").delete().eq("id", combatantId);

  if (error) {
    throw error;
  }
}

function normalizeCombatantPayload(input: BattleEventCombatantInput, userId: string | null) {
  const side = input.side === "player" || input.side === "companion" || input.side === "enemy" ? input.side : "enemy";
  return {
    event_id: input.event_id,
    side,
    enemy_id: input.enemy_id ?? null,
    npc_id: input.npc_id ?? null,
    label: input.label?.trim() || null,
    x_percent: clampPercent(Number(input.x_percent ?? 75)),
    y_percent: clampPercent(Number(input.y_percent ?? 30)),
    size_percent: Math.max(6, Math.min(34, Number(input.size_percent ?? 14) || 14)),
    sort_order: Math.max(1, Number(input.sort_order ?? 1) || 1),
    is_boss: Boolean(input.is_boss),
    is_active: input.is_active !== false,
    created_by: input.id ? undefined : userId,
    updated_at: new Date().toISOString(),
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}
