import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { runtimeEnv } from "./runtimeEnv.generated";

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value)) ?? "";
}

const supabaseUrl = firstConfiguredValue(
  runtimeEnv.supabaseUrl,
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_URL,
);

const supabasePublishableKey = firstConfiguredValue(
  runtimeEnv.supabasePublishableKey,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
    equipment_slot: "weapon" | "armor" | "necklace" | "ring" | "charm" | "relic" | null;
    damage_amount: number;
    ability_name: string | null;
    ability_cost_type: "health" | "stamina" | "magika" | "none";
    ability_cost_amount: number;
    elemental_damage_type: "none" | "fire" | "ice" | "poison" | "lightning" | "shadow" | "holy";
    elemental_damage_amount: number;
    on_hit_effect: "restore health per hit" | "restore stamina per hit" | "restore magika per hit" | "burn enemy" | "poison enemy" | "weaken enemy" | null;
    armor_value: number;
    buff_target: "max health" | "max stamina" | "max magika" | "strength" | "agility" | "intelligence" | "charisma" | "defense" | "damage" | "gold gain" | "xp gain" | null;
    buff_amount: number;
    potion_target: "health" | "stamina" | "magika" | null;
    restore_amount: number;
    restore_percent: number | null;
    boost_target: "health" | "stamina" | "magika" | "strength" | "agility" | "intelligence" | "charisma" | "damage" | "defense" | "gold gain" | "xp gain" | null;
    boost_amount: number;
    passive_mode: "owned" | "equipped" | null;
    linked_ability_id: string | null;
    teaches_ability_id: string | null;
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
    slot: "weapon" | "armor" | "necklace" | "ring" | "charm" | "relic";
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
  training_attribute_configs: {
    attribute_key: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit";
    name: string;
    effect: string;
    activities: string;
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
    image_url: string | null;
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
    event_id: string;
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
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  story_dialogue_choices: {
    id: string;
    node_id: string;
    button_text: string;
    player_dialogue_text: string | null;
    action: "go_to_node" | "start_battle" | "complete_event" | "unlock_next_event" | "give_reward" | "end_conversation" | "return_to_map";
    next_node_id: string | null;
    battle_event_id: string | null;
    reward_xp: number;
    reward_gold: number;
    reward_item: string | null;
    reward_item_id: string | null;
    reward_item_quantity: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
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
    reward_timing: "on_interact" | "on_path_complete";
    repeatable: boolean;
    reward_once_per_player: boolean;
    linked_mini_map_id: string | null;
    mini_map_id: string | null;
    parent_marker_id: string | null;
    exit_target_type: "world_marker" | "mini_map" | null;
    exit_target_marker_id: string | null;
    linked_route_id: string | null;
    starts_route_on_accept: boolean;
    icon_label: string | null;
    icon_image_url: string | null;
    icon_color: string | null;
    lock_type: "public" | "story_locked" | "quest_locked";
    lock_message: string | null;
    story_order: number;
    unlock_after_marker_id: string | null;
    hide_when_completed: boolean;
    require_all_linked_routes: boolean;
    dialogue_event_id: string | null;
    battle_event_id: string | null;
    enemy_id: string | null;
    npc_id: string | null;
    season_number: number;
    chapter_number: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
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
  marker_route_links: {
    id: string;
    marker_id: string;
    route_id: string;
    sort_order: number;
    destination_label: string | null;
    starts_on_select: boolean;
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
  story_marker_completions: {
    id: string;
    user_id: string;
    marker_id: string;
    completed_at: string;
  };
  mini_maps: {
    id: string;
    name: string;
    type: "town" | "forest" | "dungeon" | "area" | "tutorial";
    background_image_url: string | null;
    description: string | null;
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
    type: "attack" | "heal" | "buff" | "debuff" | "defense" | "passive";
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
    learn_method: "starter" | "level" | "weapon equipped" | "armor equipped" | "wearable equipped" | "scroll" | "quest" | "admin";
    required_level: number;
    required_attribute: "strength" | "endurance" | "agility" | "intelligence" | "wisdom" | "charisma" | "spirit" | null;
    required_attribute_level: number;
    image_path: string | null;
    usage_context: "battle_only" | "outside_battle_only" | "both";
    attack_bonus: number;
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
    armor_rating: number;
    xp_reward: number;
    gold_reward: number;
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
    armor_rating: number;
    xp_reward: number;
    gold_reward: number;
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
