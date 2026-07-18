import { supabase, Tables } from "../lib/supabase";
import { getCharacter } from "./characterService";
import { getPartyGuildState, PartyMemberWithProfile } from "./partyGuildService";
import { createCurrentPlayerBattleSnapshot, PlayerBattleSnapshot } from "./battleSnapshotService";
import type { BattleEventCombatant, MarkerBattleCombatant } from "./battlefieldService";
import type { CombatAbility, NpcWithLoadout } from "./combatAdminService";

export type EquippedPartyCompanion = Tables["player_equipped_party_companions"] & {
  snapshot: PlayerBattleSnapshot | null;
};

export type PartyCompanionOption = {
  member: PartyMemberWithProfile;
  snapshot: PlayerBattleSnapshot | null;
  isSelf: boolean;
  isEquipped: boolean;
  unavailableReason: string | null;
};

export type PartyCompanionBuildState = {
  options: PartyCompanionOption[];
  equipped: EquippedPartyCompanion | null;
};

export async function getPartyCompanionBuildState(characterId?: string): Promise<PartyCompanionBuildState> {
  const character = characterId ? null : await getCharacter();
  const activeCharacterId = characterId ?? character?.id ?? null;

  if (!activeCharacterId) {
    return { options: [], equipped: null };
  }

  const [partyState, equipped] = await Promise.all([
    getPartyGuildState(),
    getEquippedPartyCompanion(activeCharacterId),
  ]);

  const members = partyState.partyMembers ?? [];
  const snapshots = await getBestSnapshotsForUsers(members.map((member) => member.user_id));

  return {
    equipped,
    options: members.map((member) => {
      const snapshot = snapshots.get(member.user_id) ?? null;
      const isSelf = member.user_id === partyState.userId;
      return {
        member,
        snapshot,
        isSelf,
        isEquipped: Boolean(equipped?.party_member_user_id === member.user_id && equipped?.is_active),
        unavailableReason: snapshot ? null : isSelf ? "Refresh your party snapshot first." : "Waiting for this player to refresh their party snapshot.",
      };
    }),
  };
}

export async function refreshOwnPartyAllySnapshot() {
  const character = await getCharacter();

  if (!character) {
    throw new Error("Create a character before refreshing a party snapshot.");
  }

  return createCurrentPlayerBattleSnapshot(character, "party_ally");
}

export async function equipPartyCompanion(partyMemberUserId: string, characterId?: string) {
  const character = characterId ? null : await getCharacter();
  const activeCharacterId = characterId ?? character?.id ?? null;
  const user = await requireUser();

  if (!activeCharacterId) {
    throw new Error("Create a character before equipping a party companion.");
  }

  await assertSameActiveParty(user.id, partyMemberUserId);

  let snapshot = await getBestSnapshotForUser(partyMemberUserId);

  if (!snapshot && partyMemberUserId === user.id && character) {
    snapshot = await createCurrentPlayerBattleSnapshot(character, "party_ally");
  }

  if (!snapshot) {
    throw new Error("That party member does not have a current battle snapshot yet.");
  }

  const payload = {
    user_id: user.id,
    character_id: activeCharacterId,
    party_member_user_id: partyMemberUserId,
    snapshot_id: snapshot.id,
    slot: 1,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from("player_equipped_party_companions")
    .select("id")
    .eq("user_id", user.id)
    .eq("character_id", activeCharacterId)
    .eq("slot", 1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const query = existing?.id
    ? supabase.from("player_equipped_party_companions").update(payload).eq("id", existing.id).select("*").single()
    : supabase.from("player_equipped_party_companions").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return { ...(data as Tables["player_equipped_party_companions"]), snapshot } satisfies EquippedPartyCompanion;
}

export async function unequipPartyCompanion(characterId?: string) {
  const character = characterId ? null : await getCharacter();
  const activeCharacterId = characterId ?? character?.id ?? null;
  const user = await requireUser();

  if (!activeCharacterId) {
    return;
  }

  const { error } = await supabase
    .from("player_equipped_party_companions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("character_id", activeCharacterId)
    .eq("slot", 1);

  if (error) {
    throw error;
  }
}

export async function getEquippedPartyCompanion(characterId: string): Promise<EquippedPartyCompanion | null> {
  const { data: rows, error } = await supabase
    .from("player_equipped_party_companions")
    .select("*")
    .eq("character_id", characterId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const equipped = ((rows ?? []) as Tables["player_equipped_party_companions"][])[0] ?? null;

  if (!equipped) {
    return null;
  }

  const snapshot = await getSnapshotById(equipped.snapshot_id);
  return { ...equipped, snapshot };
}

export function createCompanionFromSnapshot(
  snapshot: PlayerBattleSnapshot,
  combatant?: BattleEventCombatant | MarkerBattleCombatant | null,
) {
  const fallbackCombatant = createFallbackCompanionCombatant(snapshot);
  const selectedCombatant = combatant ?? fallbackCombatant;
  const ally = snapshotToNpcLoadout(snapshot);

  return {
    key: `party-${snapshot.id}`,
    combatant: selectedCombatant,
    ally,
    hp: Math.max(1, Number(snapshot.current_health ?? snapshot.max_health) || 1),
    stamina: Math.max(0, Number(snapshot.max_stamina) || 0),
    magika: Math.max(0, Number(snapshot.max_magika) || 0),
  };
}

async function getBestSnapshotsForUsers(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, PlayerBattleSnapshot>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .select("*")
    .in("user_id", uniqueIds)
    .eq("is_current", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  ((data ?? []) as PlayerBattleSnapshot[]).forEach((snapshot) => {
    const current = map.get(snapshot.user_id);
    if (!current || snapshotPriority(snapshot) > snapshotPriority(current)) {
      map.set(snapshot.user_id, snapshot);
    }
  });

  return map;
}

async function getBestSnapshotForUser(userId: string) {
  const snapshots = await getBestSnapshotsForUsers([userId]);
  return snapshots.get(userId) ?? null;
}

async function getSnapshotById(snapshotId: string) {
  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerBattleSnapshot | null;
}

function snapshotPriority(snapshot: PlayerBattleSnapshot) {
  if (snapshot.snapshot_source === "party_ally") return 4;
  if (snapshot.snapshot_source === "system") return 3;
  if (snapshot.snapshot_source === "arena_holder") return 2;
  return 1;
}

async function assertSameActiveParty(userId: string, partyMemberUserId: string) {
  const { data: ownMembership, error: ownError } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (ownError) {
    throw ownError;
  }

  if (!ownMembership?.party_id) {
    throw new Error("Join or create a party before equipping a party companion.");
  }

  const { data: targetMembership, error: targetError } = await supabase
    .from("party_members")
    .select("id")
    .eq("party_id", ownMembership.party_id)
    .eq("user_id", partyMemberUserId)
    .eq("status", "active")
    .maybeSingle();

  if (targetError) {
    throw targetError;
  }

  if (!targetMembership) {
    throw new Error("That player is not active in your party.");
  }
}

async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Sign in before changing party companions.");
  }

  return user;
}

function snapshotToNpcLoadout(snapshot: PlayerBattleSnapshot): NpcWithLoadout {
  const attributes = (snapshot.attributes ?? {}) as Record<string, number>;
  return {
    id: snapshot.id,
    name: snapshot.character_name,
    type: snapshot.active_class_key ?? "Party Ally",
    description: "A party member fighting from a saved battle snapshot.",
    image_url: snapshot.portrait_url,
    can_battle: true,
    health: Math.max(1, Number(snapshot.max_health) || 30),
    stamina: Math.max(0, Number(snapshot.max_stamina) || 0),
    magika: Math.max(0, Number(snapshot.max_magika) || 0),
    strength: Number(attributes.strength ?? 0),
    endurance: Number(attributes.endurance ?? 0),
    agility: Number(attributes.agility ?? 0),
    intelligence: Number(attributes.intelligence ?? 0),
    wisdom: Number(attributes.wisdom ?? 0),
    charisma: Number(attributes.charisma ?? 0),
    spirit: Number(attributes.spirit ?? 0),
    defense: Math.max(10, Number(snapshot.defense) || 10),
    armor_rating: 0,
    attack_bonus: Math.max(0, Number(snapshot.attack_bonus) || 0),
    xp_reward: 0,
    gold_reward: 0,
    is_active: true,
    created_by: null,
    created_at: snapshot.created_at,
    updated_at: snapshot.updated_at,
    season_number: 1,
    chapter_number: 1,
    abilities: snapshotAbilitiesToNpcAbilities(snapshot),
    drops: [],
  } as NpcWithLoadout;
}

function snapshotAbilitiesToNpcAbilities(snapshot: PlayerBattleSnapshot): NpcWithLoadout["abilities"] {
  const abilities = Array.isArray(snapshot.equipped_abilities) ? snapshot.equipped_abilities : [];
  return abilities.map((entry, index) => {
    const ability = entry as Record<string, unknown>;
    const combatAbility = {
      id: String(ability.id ?? `snapshot-${snapshot.id}-${index}`),
      name: String(ability.name ?? "Party Strike"),
      type: normalizeAbilityType(ability.type),
      damage: Number(ability.damage ?? 0),
      healing: Number(ability.healing ?? 0),
      defense_amount: Number(ability.defenseAmount ?? 0),
      stamina_cost: Number(ability.staminaCost ?? 0),
      magika_cost: Number(ability.magikaCost ?? 0),
      health_cost: Number(ability.healthCost ?? 0),
      hit_chance: 85,
      critical_chance: Number(ability.criticalChance ?? 5),
      critical_multiplier: Number(ability.criticalMultiplier ?? 2),
      cooldown_turns: 0,
      duration_turns: Number(ability.effectDuration ?? 0),
      status_effect: String(ability.statusEffect ?? "none"),
      effect_amount: Number(ability.effectAmount ?? 0),
      effect_duration: Number(ability.effectDuration ?? 0),
      linked_stat: String(ability.attribute ?? "strength"),
      learn_method: "admin",
      required_level: 0,
      image_path: typeof ability.imagePath === "string" ? ability.imagePath : null,
      attack_bonus: Number(ability.attackBonus ?? 0),
      is_active: true,
      required_attribute: null,
      required_attribute_level: 0,
      usage_context: "battle_only",
      stamina_restore: Number(ability.staminaRestore ?? 0),
      magika_restore: Number(ability.magikaRestore ?? 0),
      required_class_key: null,
      required_class_level: 0,
      season_number: 1,
      chapter_number: 1,
      target_mode: normalizeTargetMode(ability.type),
      summon_kind: null,
      summon_enemy_id: null,
      summon_npc_id: null,
      summon_count: 1,
      summon_duration_turns: 3,
      created_by: null,
      created_at: snapshot.created_at,
      updated_at: snapshot.updated_at,
    } as CombatAbility;

    return {
      id: `snapshot-link-${snapshot.id}-${index}`,
      npc_id: snapshot.id,
      ability_id: combatAbility.id,
      use_weight: 1,
      created_at: snapshot.created_at,
      updated_at: snapshot.updated_at,
      ability: combatAbility,
    };
  });
}

function normalizeAbilityType(value: unknown): CombatAbility["type"] {
  return value === "heal" || value === "buff" || value === "debuff" || value === "defense" || value === "summon" || value === "conjure" ? value : "attack";
}

function normalizeTargetMode(type: unknown): CombatAbility["target_mode"] {
  if (type === "heal" || type === "buff") {
    return "all_allies";
  }
  if (type === "defense") {
    return "self";
  }
  return "single_enemy";
}

function createFallbackCompanionCombatant(snapshot: PlayerBattleSnapshot): MarkerBattleCombatant {
  const now = new Date().toISOString();
  return {
    id: `party-companion-${snapshot.id}`,
    marker_id: "",
    side: "companion",
    enemy_id: null,
    npc_id: null,
    label: snapshot.character_name,
    x_percent: 28,
    y_percent: 68,
    size_percent: 13,
    sort_order: 50,
    is_boss: false,
    is_active: true,
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}
