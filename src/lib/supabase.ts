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
    is_active: boolean;
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
    dialogue_text: string | null;
    choices: Array<{ label: string; action: "Continue" | "Investigate" | "Ask Questions" | "Start Battle" | "Complete Event"; battle_event_id?: string | null }>;
    enemy_name: string | null;
    enemy_image_url: string | null;
    enemy_hp: number;
    enemy_attack_damage: number;
    battle_intro_text: string | null;
    victory_text: string | null;
    defeat_text: string | null;
    reward_xp: number;
    reward_item: string | null;
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
  story_dialogue_nodes: {
    id: string;
    event_id: string;
    node_key: string;
    title: string;
    npc_name: string | null;
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
    reward_item: string | null;
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
    quest_key: string | null;
    route_id: string | null;
    created_by: string | null;
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
