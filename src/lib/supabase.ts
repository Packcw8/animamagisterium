import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { runtimeEnv } from "./runtimeEnv.generated";

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

const viteEnv = (import.meta as ViteImportMeta).env;

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value)) ?? "";
}

const supabaseUrl = firstConfiguredValue(
  runtimeEnv.supabaseUrl,
  viteEnv?.VITE_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_URL,
);

const supabasePublishableKey = firstConfiguredValue(
  runtimeEnv.supabasePublishableKey,
  viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY,
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
    created_at: string;
  };
  characters: {
    id: string;
    user_id: string;
    name: string;
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
    knowledge: number;
    craft: number;
    wealth: number;
    influence: number;
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
