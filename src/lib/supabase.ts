import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { runtimeEnv } from "./runtimeEnv.generated";

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value)) ?? "";
}

const supabaseUrl = firstConfiguredValue(
  runtimeEnv.supabaseUrl,
  typeof process !== "undefined" ? process.env.EXPO_PUBLIC_SUPABASE_URL : undefined,
  typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined,
);

const supabasePublishableKey = firstConfiguredValue(
  runtimeEnv.supabasePublishableKey,
  typeof process !== "undefined" ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined,
  typeof process !== "undefined" ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined,
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabasePublishableKey || "publishable-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Tables = {
  profiles: {
    id: string;
    username: string | null;
    role: "player" | "moderator" | "admin";
    created_at: string;
  };
  characters: {
    id: string;
    user_id: string;
    name: string;
    gender: string | null;
    ancestry: string | null;
    homeland: string | null;
    origin: string | null;
    path: string | null;
    trait: string | null;
    portrait_url: string | null;
    original_photo_url: string | null;
    current_health: number | null;
    total_distance_walked_meters: number;
    level: number;
    xp: number;
    gold: number;
    created_at: string;
  };
  attributes: {
    id: string;
    character_id: string;
    strength: number;
    endurance: number;
    agility: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    spirit: number;
  };
  attribute_progress: {
    id: string;
    user_id: string;
    character_id: string;
    attribute_key: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    current_level: number;
    current_xp: number;
    next_goal_value: number;
    last_completed_at: string | null;
    cooldown_until: string | null;
    created_at: string;
    updated_at: string;
  };
  training_sessions: {
    id: string;
    user_id: string;
    character_id: string;
    attribute_key: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    activity_label: string;
    goal_value: number;
    goal_unit: string;
    attribute_xp: number;
    character_xp: number;
    training_date: string;
    completed_at: string;
  };
  player_abilities: {
    id: string;
    user_id: string;
    character_id: string;
    ability_key: string;
    unlocked_by_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | null;
    unlocked_at: string;
  };
  equipped_abilities: {
    id: string;
    user_id: string;
    character_id: string;
    slot: number;
    ability_key: string | null;
    updated_at: string;
  };
  item_definitions: {
    id: string;
    name: string;
    type: "weapon" | "armor" | "wearable" | "potion" | "revive potion" | "consumable" | "food" | "scroll" | "special" | "material" | "misc";
    rarity: string;
    description: string | null;
    image_path: string | null;
    gold_value: number;
    weight: number;
    stackable: boolean;
    sellable: boolean;
    usable_in_battle: boolean;
    usable_outside_battle: boolean;
    usage_context: "battle_only" | "outside_battle_only" | "both";
    crafting_value: number | null;
    equipment_slot: "weapon" | "main_hand" | "off_hand" | "helmet" | "chest" | "gloves" | "legs" | "boots" | "armor" | "necklace" | "ring" | "charm" | "relic" | null;
    damage_amount: number;
    ability_name: string | null;
    ability_cost_type: "health" | "stamina" | "magika" | "none";
    ability_cost_amount: number;
    elemental_damage_type: "none" | "fire" | "ice" | "poison" | "lightning" | "shadow" | "holy";
    elemental_damage_amount: number;
    on_hit_effect: "restore health per hit" | "restore stamina per hit" | "restore magika per hit" | "burn enemy" | "poison enemy" | "weaken enemy" | null;
    armor_value: number;
    buff_target: "max health" | "max stamina" | "max magika" | "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "defense" | "damage" | "gold gain" | "xp gain" | null;
    buff_amount: number;
    equip_penalty_target: "max health" | "max stamina" | "max magika" | "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "defense" | "damage" | "gold gain" | "xp gain" | null;
    equip_penalty_amount: number;
    armor_set_key: string | null;
    armor_set_name: string | null;
    armor_piece_slot: "helmet" | "chest" | "gloves" | "legs" | "boots" | null;
    set_bonus_target: "max health" | "max stamina" | "max magika" | "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "defense" | "damage" | "gold gain" | "xp gain" | null;
    set_bonus_amount: number;
    set_penalty_target: "max health" | "max stamina" | "max magika" | "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "defense" | "damage" | "gold gain" | "xp gain" | null;
    set_penalty_amount: number;
    potion_target: "health" | "stamina" | "magika" | null;
    restore_amount: number;
    restore_percent: number | null;
    boost_target: "health" | "stamina" | "magika" | "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "damage" | "defense" | "gold gain" | "xp gain" | null;
    boost_amount: number;
    passive_mode: "owned" | "equipped" | null;
    linked_ability_id: string | null;
    teaches_ability_id: string | null;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  player_inventory: {
    id: string;
    user_id: string;
    character_id: string;
    item_id: string;
    quantity: number;
    acquired_at: string;
    updated_at: string;
  };
  equipped_items: {
    id: string;
    user_id: string;
    character_id: string;
    slot: "weapon" | "main_hand" | "off_hand" | "helmet" | "chest" | "gloves" | "legs" | "boots" | "armor" | "necklace" | "ring" | "charm" | "relic";
    item_id: string | null;
    updated_at: string;
  };
  game_balance_settings: {
    key: string;
    value: number;
    updated_at: string;
  };
  game_progression_settings: {
    id: boolean;
    character_level_cap: number;
    character_xp_base: number;
    character_xp_growth: number;
    default_attribute_level_cap: number;
    daily_training_limit: number;
    training_cooldown_minutes: number;
    updated_at: string;
  };
  game_toasts: {
    id: string;
    trigger_type:
      | "entering_area"
      | "leaving_area"
      | "starting_path"
      | "completing_path"
      | "unlocking_marker"
      | "completing_chapter"
      | "receiving_reward"
      | "learning_ability"
      | "discovering_npc_enemy"
      | "opening_game";
    trigger_key: string | null;
    title: string;
    body: string;
    icon_image_url: string | null;
    sound_url: string | null;
    button_text: string;
    display_once: boolean;
    trigger_condition: string | null;
    sort_order: number;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  training_attribute_configs: {
    attribute_key: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    name: string;
    effect: string;
    activities: string;
    image_url: string | null;
    background_image_url: string | null;
    unit: string;
    goal_template: string;
    starting_goal: number;
    goal_increment: number;
    character_xp_reward: number;
    attribute_xp_reward: number;
    level_cap: number;
    is_active: boolean;
    updated_at: string;
  };
  class_definitions: {
    id: string;
    class_key: string;
    name: string;
    first_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    second_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    unlock_level: number;
    description: string | null;
    image_url: string | null;
    background_image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  class_progress: {
    id: string;
    user_id: string;
    character_id: string;
    class_key: string;
    current_level: number;
    current_xp: number;
    last_trained_at: string | null;
    created_at: string;
    updated_at: string;
  };
  player_class_selection: {
    id: string;
    user_id: string;
    character_id: string;
    class_key: string;
    updated_at: string;
  };
  player_battle_snapshots: {
    id: string;
    user_id: string;
    character_id: string;
    snapshot_source: "manual" | "party_ally" | "arena_holder" | "system";
    character_name: string;
    portrait_url: string | null;
    level: number;
    xp: number;
    active_class_key: string | null;
    max_health: number;
    max_stamina: number;
    max_magika: number;
    current_health: number;
    defense: number;
    attack_bonus: number;
    damage_bonus: number;
    attributes: Record<string, unknown>;
    equipped_items: Record<string, unknown>;
    equipped_abilities: Array<Record<string, unknown>>;
    inventory_summary: Record<string, unknown>;
    is_current: boolean;
    created_at: string;
    updated_at: string;
  };
  arena_spots: {
    id: string;
    marker_id: string;
    name: string;
    description: string | null;
    background_image_url: string | null;
    entry_cost_gold: number;
    reward_xp: number;
    reward_gold: number;
    required_level: number;
    allow_holder_replacement: boolean;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  arena_holders: {
    id: string;
    arena_id: string;
    holder_user_id: string | null;
    holder_character_id: string | null;
    holder_snapshot_id: string | null;
    wins_defended: number;
    won_at: string;
    replaced_at: string | null;
    is_current: boolean;
    created_at: string;
  };
  arena_challenge_history: {
    id: string;
    arena_id: string;
    challenger_user_id: string | null;
    challenger_character_id: string | null;
    defender_snapshot_id: string | null;
    result: "win" | "loss" | "flee" | "preview";
    reward_xp: number;
    reward_gold: number;
    created_at: string;
  };
  arena_battle_slots: {
    id: string;
    arena_id: string;
    slot_type: "challenger_start" | "holder_start";
    label: string | null;
    x_percent: number;
    y_percent: number;
    size_percent: number;
    sort_order: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  avatar_assets: {
    id: string;
    type: "base" | "face" | "hair" | "armor" | "weapon" | "cloak" | "background";
    name: string;
    storage_path: string | null;
    preview_url: string | null;
    sort_order: number;
    is_active: boolean;
  };
  character_appearance: {
    id: string;
    character_id: string;
    base_asset_id: string | null;
    face_asset_id: string | null;
    hair_asset_id: string | null;
    armor_asset_id: string | null;
    weapon_asset_id: string | null;
    cloak_asset_id: string | null;
    skin_tone: string | null;
    updated_at: string;
  };
  map_routes: {
    id: string;
    name: string;
    sort_order: number;
    terrain: string;
    danger_level: string;
    distance_required_meters: number;
    estimated_encounters: number;
    path_points: Array<{ x: number; y: number }>;
    path_segments: Array<{
      from_index: number;
      to_index: number;
      visibility: "visible" | "hidden" | "cave" | "fog";
      label?: string | null;
    }>;
    image_url: string | null;
    journal_title: string | null;
    journal_body: string | null;
    journal_image_url: string | null;
    journal_sort_order: number;
    story_deck_id?: string | null;
    mini_map_id: string | null;
    parent_marker_id: string | null;
    lock_type: "public" | "story_locked" | "quest_locked";
    lock_message: string | null;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  map_seasons: {
    id: string;
    season_number: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  map_chapters: {
    id: string;
    season_number: number;
    chapter_number: number;
    name: string;
    description: string | null;
    access_type: "free" | "story_locked" | "subscription_locked" | "admin_test";
    unlock_story_flag_key: string | null;
    unlock_story_flag_value: boolean;
    completion_story_flag_key: string | null;
    completion_story_flag_value: boolean;
    transition_title: string | null;
    transition_body: string | null;
    unlock_message: string | null;
    subscription_prompt: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  map_story_instances: {
    id: string;
    route_id: string | null;
    title: string;
    body: string | null;
    trigger_type: "progress" | "random";
    trigger_percent: number | null;
    chance_percent: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  map_events: {
    id: string;
    event_type: "story" | "dialogue" | "battle" | "clue" | "reward";
    title: string;
    route_id: string | null;
    distance_marker_percent: number;
    background_image_url: string | null;
    npc_name: string | null;
    npc_portrait_url: string | null;
    dialogue_npc_id: string | null;
    npc_id: string | null;
    dialogue_text: string | null;
    choices: Array<{ label: string; action: "Continue" | "Investigate" | "Ask Questions" | "Start Battle" | "Complete Event"; battle_event_id?: string | null }>;
    enemy_name: string | null;
    enemy_id: string | null;
    enemy_image_url: string | null;
    enemy_hp: number;
    enemy_attack_damage: number;
    battle_intro_text: string | null;
    victory_text: string | null;
    defeat_text: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item: string | null;
    reward_item_id: string | null;
    reward_item_quantity: number;
    trigger_mode: "fixed" | "random";
    random_chance_percent: number;
    linked_only: boolean;
    story_deck_id?: string | null;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  map_event_completions: {
    id: string;
    user_id: string;
    event_id: string;
    completed_at: string;
  };
  battle_event_combatants: {
    id: string;
    event_id: string;
    side: "player" | "companion" | "enemy" | "player_summon" | "enemy_summon";
    enemy_id: string | null;
    npc_id: string | null;
    label: string | null;
    x_percent: number;
    y_percent: number;
    size_percent: number;
    sort_order: number;
    is_boss: boolean;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  marker_battle_combatants: {
    id: string;
    marker_id: string;
    side: "player" | "companion" | "enemy" | "player_summon" | "enemy_summon";
    enemy_id: string | null;
    npc_id: string | null;
    label: string | null;
    x_percent: number;
    y_percent: number;
    size_percent: number;
    sort_order: number;
    is_boss: boolean;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  enemy_kill_log: {
    id: string;
    user_id: string;
    character_id: string;
    enemy_key: string;
    enemy_id: string | null;
    npc_id: string | null;
    enemy_name: string;
    enemy_type: string | null;
    enemy_source: "enemy" | "npc" | "manual";
    route_id: string | null;
    map_event_id: string | null;
    season_number: number;
    chapter_number: number;
    killed_at: string;
  };
  player_enemy_kill_stats: {
    id: string;
    user_id: string;
    character_id: string;
    enemy_key: string;
    enemy_id: string | null;
    npc_id: string | null;
    enemy_name: string;
    enemy_type: string | null;
    enemy_source: "enemy" | "npc" | "manual";
    kill_count: number;
    last_killed_at: string;
  };
  player_enemy_type_kill_stats: {
    id: string;
    user_id: string;
    character_id: string;
    enemy_type: string;
    kill_count: number;
    last_killed_at: string;
  };
  badge_definitions: {
    id: string;
    title: string;
    description: string | null;
    badge_type: "distance" | "enemy_name_kills" | "enemy_type_kills" | "story_completion" | "training_sessions";
    metric_key: string | null;
    target_value: number;
    icon_url: string | null;
    icon_label: string | null;
    sort_order: number;
    is_active: boolean;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  player_badges: {
    id: string;
    user_id: string;
    character_id: string;
    badge_id: string;
    progress_value: number;
    is_earned: boolean;
    earned_at: string | null;
    updated_at: string;
  };
  player_friends: {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: "pending" | "accepted" | "declined" | "blocked";
    created_at: string;
    updated_at: string;
  };
  parties: {
    id: string;
    name: string;
    description: string | null;
    leader_id: string;
    max_members: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  party_members: {
    id: string;
    party_id: string;
    user_id: string;
    role: "leader" | "member";
    status: "pending" | "active" | "declined" | "left";
    invited_by: string | null;
    joined_at: string | null;
    created_at: string;
    updated_at: string;
  };
  guilds: {
    id: string;
    name: string;
    description: string | null;
    leader_id: string;
    max_members: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  guild_members: {
    id: string;
    guild_id: string;
    user_id: string;
    role: "leader" | "officer" | "member";
    status: "pending" | "active" | "declined" | "left";
    invited_by: string | null;
    joined_at: string | null;
    created_at: string;
    updated_at: string;
  };
  social_group_goals: {
    id: string;
    group_type: "party" | "guild";
    group_id: string;
    title: string;
    description: string | null;
    metric_type: string;
    metric_filter: string | null;
    target_value: number;
    reward_title: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item_id: string | null;
    reward_item_quantity: number;
    starts_at: string | null;
    ends_at: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  social_group_goal_rewards: {
    id: string;
    goal_id: string;
    reward_item_id: string;
    reward_item_quantity: number;
    sort_order: number;
    created_at: string;
  };
  social_group_goal_completions: {
    id: string;
    goal_id: string;
    group_type: "party" | "guild";
    group_id: string;
    completed_at: string;
  };
  social_group_goal_contributions: {
    id: string;
    goal_id: string;
    group_type: "party" | "guild";
    group_id: string;
    user_id: string;
    amount: number;
    source_type: string | null;
    source_id: string | null;
    created_at: string;
  };
  player_inbox_rewards: {
    id: string;
    user_id: string;
    character_id: string | null;
    title: string;
    body: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item_id: string | null;
    reward_item_quantity: number;
    is_claimed: boolean;
    seen_at: string | null;
    claimed_at: string | null;
    created_at: string;
  };
  story_dialogue_nodes: {
    id: string;
    event_id: string | null;
    marker_id: string | null;
    dialogue_pack_id: string | null;
    node_key: string;
    title: string;
    npc_name: string | null;
    npc_id: string | null;
    npc_portrait_url: string | null;
    background_image_url: string | null;
    dialogue_text: string;
    is_start: boolean;
    is_ending: boolean;
    allow_end_chat: boolean;
    end_completes_event: boolean;
    content_scope: "chapter" | "universal";
    season_number: number | null;
    chapter_number: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  dialogue_packs: {
    id: string;
    marker_id: string | null;
    npc_id: string | null;
    name: string;
    description: string | null;
    pack_type: "main" | "quest" | "ambient" | "repeat" | "fallback";
    content_scope: "chapter" | "universal";
    season_number: number | null;
    chapter_number: number | null;
    priority: number;
    required_story_flag_key: string | null;
    required_story_flag_value: boolean;
    repeatable: boolean;
    is_published: boolean;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  story_dialogue_choices: {
    id: string;
    node_id: string;
    button_text: string;
    player_dialogue_text: string | null;
    action: "go_to_node" | "start_battle" | "start_quest" | "complete_event" | "unlock_next_event" | "give_reward" | "end_conversation" | "return_to_map";
    next_node_id: string | null;
    battle_event_id: string | null;
    story_deck_id?: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item: string | null;
    reward_item_id: string | null;
    reward_item_quantity: number;
    consume_gold: number;
    requirement_type: "none" | "gold" | "item" | "story_flag" | "completed_marker" | "completed_event" | "tutorial_step" | "ability_known" | "attribute_level";
    requirement_value: string | null;
    requirement_quantity: number;
    requirement_operator: ">=" | ">" | "=" | "<=" | "<";
    hide_if_unmet: boolean;
    disable_if_unmet: boolean;
    requirement_failure_message: string | null;
    check_enabled: boolean;
    check_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | null;
    check_dc: number;
    check_success_node_id: string | null;
    check_failure_node_id: string | null;
    check_success_text: string | null;
    check_failure_text: string | null;
    unlock_marker_id: string | null;
    update_notification_title: string | null;
    update_notification_body: string | null;
    restore_health: boolean;
    restore_stamina: boolean;
    restore_mana: boolean;
    choice_group_key: string | null;
    choice_group_lock_message: string | null;
    hide_when_group_locked: boolean;
    set_story_flag_key: string | null;
    set_story_flag_value: boolean;
    repeatable: boolean;
    hide_after_selected: boolean;
    disable_after_selected: boolean;
    selected_message: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  dialogue_choice_rewards: {
    id: string;
    choice_id: string;
    reward_type: "gold" | "xp" | "item";
    item_id: string | null;
    quantity: number;
    amount: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  player_story_flags: {
    id: string;
    user_id: string;
    character_id: string;
    flag_key: string;
    flag_value: boolean;
    text_value: string | null;
    created_at: string;
    updated_at: string;
  };
  player_tutorial_completions: {
    id: string;
    user_id: string;
    character_id: string;
    tutorial_step_id: string;
    completed_at: string;
  };
  player_attribute_checks: {
    id: string;
    user_id: string;
    character_id: string;
    dialogue_node_id: string | null;
    choice_id: string;
    attribute_used: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    attribute_value: number;
    dc: number;
    roll_value: number;
    final_result: number;
    succeeded: boolean;
    created_at: string;
  };
  route_progress: {
    id: string;
    user_id: string;
    route_id: string;
    distance_walked_meters: number;
    progress_percent: number;
    current_x_percent: number | null;
    current_y_percent: number | null;
    last_lat: number | null;
    last_lng: number | null;
    travel_direction: "forward" | "reverse";
    is_current: boolean;
    source_marker_id: string | null;
    updated_at: string;
  };
  player_map_state: {
    user_id: string;
    active_mini_map_id: string | null;
    current_x_percent: number | null;
    current_y_percent: number | null;
    updated_at: string;
  };
  map_markers: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    x_percent: number;
    y_percent: number;
    is_active: boolean;
    is_unlocked: boolean;
    is_interactable: boolean;
    quest_key: string | null;
    route_id: string | null;
    quest_title: string | null;
    quest_dialogue: string | null;
    quest_image_url: string | null;
    shop_image_url: string | null;
    shop_background_image_url: string | null;
    scene_background_image_url: string | null;
    scene_npc_image_url: string | null;
    interaction_radius_percent: number;
    reward_xp: number;
    reward_gold: number;
    reward_item_id: string | null;
    reward_item_quantity: number;
    reward_full_heal: boolean;
    reward_timing: "on_interact" | "on_path_complete";
    repeatable: boolean;
    reward_once_per_player: boolean;
    linked_mini_map_id: string | null;
    mini_map_id: string | null;
    parent_marker_id: string | null;
    exit_target_type: "world_marker" | "mini_map" | null;
    exit_target_marker_id: string | null;
    exit_target_spawn_marker_id: string | null;
    linked_route_id: string | null;
    linked_route_start_direction: "forward" | "reverse";
    starts_route_on_accept: boolean;
    icon_label: string | null;
    icon_image_url: string | null;
    icon_color: string | null;
    marker_size: number;
    lock_type: "public" | "story_locked" | "quest_locked";
    lock_message: string | null;
    access_rule: "always" | "story_flag" | "puzzle_unlock" | "item_required" | "admin_only";
    required_item_id: string | null;
    required_item_quantity: number;
    access_hint: string | null;
    visible_story_flag_key: string | null;
    visible_story_flag_value: boolean;
    story_order: number;
    unlock_after_marker_id: string | null;
    hide_when_completed: boolean;
    require_all_linked_routes: boolean;
    dialogue_event_id: string | null;
    battle_event_id: string | null;
    enemy_id: string | null;
    npc_id: string | null;
    journal_title: string | null;
    journal_body: string | null;
    journal_image_url: string | null;
    journal_sort_order: number;
    story_deck_id?: string | null;
    content_scope: "chapter" | "universal";
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  player_marker_unlocks: {
    id: string;
    user_id: string;
    marker_id: string;
    source_choice_id: string | null;
    unlocked_at: string;
  };
  player_dialogue_choice_history: {
    id: string;
    user_id: string;
    character_id: string | null;
    choice_id: string;
    node_id: string | null;
    event_id: string | null;
    marker_id: string | null;
    selected_at: string;
  };
  story_decks: {
    id: string;
    title: string;
    description: string | null;
    deck_type: "lore" | "chapter_summary" | "cutscene" | "recap" | "tutorial" | "area_intro";
    trigger_type: "manual" | "opening_game" | "entering_area" | "leaving_area" | "starting_path" | "completing_path" | "marker_interaction" | "dialogue_choice" | "puzzle_complete" | "completing_chapter" | "receiving_reward";
    trigger_key: string | null;
    season_number: number;
    chapter_number: number;
    play_once: boolean;
    save_to_journal: boolean;
    replayable: boolean;
    is_published: boolean;
    is_active: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  story_cards: {
    id: string;
    deck_id: string;
    title: string | null;
    body: string;
    image_url: string | null;
    text_position: "top" | "center" | "bottom";
    text_style: "dark" | "light" | "gold";
    button_text: string;
    sound_url: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  player_story_deck_views: {
    id: string;
    user_id: string;
    character_id: string | null;
    story_deck_id: string;
    first_viewed_at: string;
    last_viewed_at: string;
    view_count: number;
    completed_at: string | null;
  };
  marker_legend_items: {
    id: string;
    marker_type: string;
    title: string;
    description: string | null;
    icon_label: string | null;
    icon_image_url: string | null;
    icon_color: string | null;
    sort_order: number;
    is_active: boolean;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  world_map_settings: {
    id: string;
    season_number: number;
    chapter_number: number;
    name: string;
    image_url: string | null;
    draft_image_url: string | null;
    notes: string | null;
    aspect_ratio: string;
    width: number;
    height: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  marker_route_links: {
    id: string;
    marker_id: string;
    route_id: string;
    sort_order: number;
    destination_label: string | null;
    starts_on_select: boolean;
    start_direction: "forward" | "reverse";
    completion_condition: "start" | "end" | "either";
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  marker_market_items: {
    id: string;
    marker_id: string;
    item_id: string;
    buy_price: number;
    sell_price: number;
    stock_quantity: number | null;
    unlimited_stock: boolean;
    listing_mode: "buy_and_sell" | "buy_only" | "sell_only";
    season_number: number;
    chapter_number: number;
    created_at: string;
    updated_at: string;
  };
  player_market_purchases: {
    id: string;
    user_id: string;
    character_id: string;
    market_item_id: string;
    quantity_purchased: number;
    updated_at: string;
  };
  marker_reward_claims: {
    id: string;
    user_id: string;
    character_id: string;
    marker_id: string | null;
    event_id: string | null;
    choice_id: string | null;
    claimed_at: string;
  };
  puzzle_definitions: {
    id: string;
    marker_id: string;
    title: string;
    intro_text: string | null;
    image_url: string | null;
    success_text: string | null;
    failure_text: string | null;
    reset_on_failure: boolean;
    max_attempts: number;
    unlock_marker_id: string | null;
    set_story_flag_key: string | null;
    set_story_flag_value: boolean;
    complete_marker_on_success: boolean;
    is_active: boolean;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  puzzle_tap_zones: {
    id: string;
    puzzle_id: string;
    label: string;
    player_label: string | null;
    clue_text: string | null;
    x_percent: number;
    y_percent: number;
    radius_percent: number;
    sequence_order: number;
    icon_label: string | null;
    icon_image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  player_puzzle_progress: {
    id: string;
    user_id: string;
    character_id: string | null;
    puzzle_id: string;
    marker_id: string | null;
    current_index: number;
    attempts: number;
    completed_at: string | null;
    updated_at: string;
  };
  story_marker_completions: {
    id: string;
    user_id: string;
    marker_id: string;
    completed_at: string;
  };
  story_marker_starts: {
    id: string;
    user_id: string;
    marker_id: string;
    started_at: string;
  };
  mini_maps: {
    id: string;
    name: string;
    type: "town" | "forest" | "dungeon" | "area" | "tutorial";
    area_key: string | null;
    area_name: string | null;
    background_image_url: string | null;
    description: string | null;
    width: number;
    height: number;
    behavior_mode: "scrollable" | "follow_player" | "fixed";
    zoom_enabled: boolean;
    player_avatar_scale: number;
    marker_scale: number;
    entry_toast_title: string | null;
    entry_toast_message: string | null;
    entry_sound_url: string | null;
    entry_video_url: string | null;
    sort_order: number;
    is_active: boolean;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  tutorial_steps: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    marker_id: string | null;
    mini_map_id: string | null;
    route_id: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item_id: string | null;
    reward_item_quantity: number;
    sort_order: number;
    is_active: boolean;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  combat_abilities: {
    id: string;
    name: string;
    type: "attack" | "heal" | "buff" | "debuff" | "defense" | "passive" | "summon" | "conjure";
    damage: number;
    healing: number;
    defense_amount: number;
    stamina_restore: number;
    magika_restore: number;
    stamina_cost: number;
    magika_cost: number;
    health_cost: number;
    hit_chance: number;
    critical_chance: number;
    critical_multiplier: number;
    cooldown_turns: number;
    duration_turns: number;
    status_effect: "none" | "poison" | "burn" | "regen" | "shield" | "weakness" | "slow" | "stun";
    effect_amount: number;
    effect_duration: number;
    linked_stat: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | "weapon" | "item" | "none";
    learn_method: "starter" | "level" | "class level" | "weapon equipped" | "armor equipped" | "wearable equipped" | "scroll" | "quest" | "admin";
    required_level: number;
    required_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | null;
    required_attribute_level: number;
    required_class_key: string | null;
    required_class_level: number;
    image_path: string | null;
    usage_context: "battle_only" | "outside_battle_only" | "both";
    attack_bonus: number;
    target_mode: "single_enemy" | "all_enemies" | "random_enemy" | "self" | "all_allies";
    summon_kind: "enemy" | "npc" | null;
    summon_enemy_id: string | null;
    summon_npc_id: string | null;
    summon_count: number;
    summon_duration_turns: number;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  enemy_definitions: {
    id: string;
    name: string;
    type: string | null;
    image_url: string | null;
    health: number;
    stamina: number;
    magika: number;
    strength: number;
    endurance: number;
    agility: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    spirit: number;
    defense: number;
    attack_bonus: number;
    armor_rating: number;
    xp_reward: number;
    gold_reward: number;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  enemy_abilities: {
    id: string;
    enemy_id: string;
    ability_id: string;
    use_weight: number;
    created_at: string;
    updated_at: string;
  };
  enemy_item_drops: {
    id: string;
    enemy_id: string;
    item_id: string;
    quantity: number;
    drop_chance: number;
    created_at: string;
    updated_at: string;
  };
  npc_definitions: {
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    image_url: string | null;
    can_battle: boolean;
    health: number;
    stamina: number;
    magika: number;
    strength: number;
    endurance: number;
    agility: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    spirit: number;
    defense: number;
    attack_bonus: number;
    armor_rating: number;
    xp_reward: number;
    gold_reward: number;
    season_number: number;
    chapter_number: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  npc_abilities: {
    id: string;
    npc_id: string;
    ability_id: string;
    use_weight: number;
    created_at: string;
    updated_at: string;
  };
  npc_item_drops: {
    id: string;
    npc_id: string;
    item_id: string;
    quantity: number;
    drop_chance: number;
    created_at: string;
    updated_at: string;
  };
};

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: "Supabase environment variables are missing.",
    };
  }

  const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    message: "Connected to Supabase.",
  };
}
