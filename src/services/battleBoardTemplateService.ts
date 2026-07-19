import { supabase, type Tables } from "../lib/supabase";
import { deleteBattleEventCombatant, deleteMarkerBattleCombatant, getBattleEventCombatants, getMarkerBattleCombatants, saveBattleEventCombatant, saveMarkerBattleCombatant, type BattleEventCombatant, type MarkerBattleCombatant } from "./battlefieldService";

export type BattleBoardTemplate = Tables["battle_board_templates"];
export type BattleBoardTemplateSlot = Tables["battle_board_template_slots"];
export type BattleBoardTemplateWithSlots = BattleBoardTemplate & { slots: BattleBoardTemplateSlot[] };

export async function getBattleBoardTemplates() {
  const [templatesResult, slotsResult] = await Promise.all([
    supabase.from("battle_board_templates").select("*").order("content_scope", { ascending: true }).order("season_number", { ascending: true }).order("chapter_number", { ascending: true }).order("name", { ascending: true }),
    supabase.from("battle_board_template_slots").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (templatesResult.error) throw templatesResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const slots = (slotsResult.data ?? []) as BattleBoardTemplateSlot[];
  return ((templatesResult.data ?? []) as BattleBoardTemplate[]).map((template) => ({
    ...template,
    slots: slots.filter((slot) => slot.template_id === template.id),
  })) as BattleBoardTemplateWithSlots[];
}

export async function saveBattleBoardTemplate(input: Partial<BattleBoardTemplate>) {
  const { data: userData } = await supabase.auth.getUser();
  const contentScope = input.content_scope === "universal" ? "universal" : "chapter";
  const payload = {
    name: input.name?.trim() || "Reusable Battle Board",
    description: input.description?.trim() || null,
    background_image_url: input.background_image_url?.trim() || null,
    content_scope: contentScope,
    season_number: contentScope === "chapter" ? Math.max(1, Number(input.season_number ?? 1) || 1) : 1,
    chapter_number: contentScope === "chapter" ? Math.max(1, Number(input.chapter_number ?? 1) || 1) : 1,
    is_active: input.is_active !== false,
    created_by: input.id ? undefined : userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("battle_board_templates").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("battle_board_templates").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as BattleBoardTemplate;
}

export async function deleteBattleBoardTemplate(templateId: string) {
  const { error } = await supabase.from("battle_board_templates").delete().eq("id", templateId);
  if (error) throw error;
}

export async function saveBattleBoardTemplateSlot(input: Partial<BattleBoardTemplateSlot> & { template_id: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const payload = normalizeSlotPayload(input, userData.user?.id ?? null);
  const query = input.id
    ? supabase.from("battle_board_template_slots").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("battle_board_template_slots").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as BattleBoardTemplateSlot;
}

export async function deleteBattleBoardTemplateSlot(slotId: string) {
  const { error } = await supabase.from("battle_board_template_slots").delete().eq("id", slotId);
  if (error) throw error;
}

export function templateSlotsToCombatants(slots: BattleBoardTemplateSlot[], templateId: string): MarkerBattleCombatant[] {
  return slots.map((slot) => ({
    id: slot.id,
    marker_id: templateId,
    side: slot.side,
    enemy_id: slot.enemy_id,
    npc_id: slot.npc_id,
    label: slot.label,
    x_percent: slot.x_percent,
    y_percent: slot.y_percent,
    size_percent: slot.size_percent,
    sort_order: slot.sort_order,
    is_boss: slot.is_boss,
    is_active: slot.is_active,
    created_by: slot.created_by,
    created_at: slot.created_at,
    updated_at: slot.updated_at,
  }));
}

export async function applyBattleBoardTemplateToEvent(template: BattleBoardTemplateWithSlots, eventId: string, replaceExisting = true) {
  if (replaceExisting) {
    const existing = await getBattleEventCombatants(eventId);
    await Promise.all(existing.map((combatant) => deleteBattleEventCombatant(combatant.id)));
  }

  const saved: BattleEventCombatant[] = [];
  for (const slot of template.slots.filter((item) => item.is_active)) {
    saved.push(await saveBattleEventCombatant({
      event_id: eventId,
      side: slot.side,
      enemy_id: slot.enemy_id,
      npc_id: slot.npc_id,
      label: slot.label,
      x_percent: slot.x_percent,
      y_percent: slot.y_percent,
      size_percent: slot.size_percent,
      sort_order: slot.sort_order,
      is_boss: slot.is_boss,
      is_active: slot.is_active,
    }));
  }
  return saved;
}

export async function applyBattleBoardTemplateToMarker(template: BattleBoardTemplateWithSlots, markerId: string, replaceExisting = true) {
  if (replaceExisting) {
    const existing = await getMarkerBattleCombatants(markerId);
    await Promise.all(existing.map((combatant) => deleteMarkerBattleCombatant(combatant.id)));
  }

  const saved: MarkerBattleCombatant[] = [];
  for (const slot of template.slots.filter((item) => item.is_active)) {
    saved.push(await saveMarkerBattleCombatant({
      marker_id: markerId,
      side: slot.side,
      enemy_id: slot.enemy_id,
      npc_id: slot.npc_id,
      label: slot.label,
      x_percent: slot.x_percent,
      y_percent: slot.y_percent,
      size_percent: slot.size_percent,
      sort_order: slot.sort_order,
      is_boss: slot.is_boss,
      is_active: slot.is_active,
    }));
  }
  return saved;
}

function normalizeSlotPayload(input: Partial<BattleBoardTemplateSlot> & { template_id: string }, userId: string | null) {
  return {
    template_id: input.template_id,
    side: isBattlefieldSide(input.side) ? input.side : "enemy",
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

function isBattlefieldSide(side: BattleBoardTemplateSlot["side"] | undefined): side is BattleBoardTemplateSlot["side"] {
  return side === "player" || side === "companion" || side === "enemy" || side === "player_summon" || side === "enemy_summon";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}
