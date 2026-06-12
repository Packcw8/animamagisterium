import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "anon-key", {
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
    display_name: string;
    title: string;
    level: number;
    xp: number;
    xp_max: number;
  };
  player_stats: {
    profile_id: string;
    health: number;
    health_max: number;
    mana: number;
    mana_max: number;
    stamina: number;
    stamina_max: number;
  };
  quests: {
    id: string;
    profile_id: string;
    title: string;
    description: string;
    xp_reward: number;
    coin_reward: number;
    progress: number;
    target: number;
    cadence: "daily" | "weekly" | "achievement";
  };
};
