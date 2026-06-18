import { supabase } from "../lib/supabase";

export type LeaderboardMetric =
  | "total_distance_walked_meters"
  | "xp"
  | "gold"
  | "level"
  | "attribute_total"
  | "training_sessions_completed"
  | "event_completions";

export type LeaderboardRow = {
  character_id: string;
  user_id: string;
  display_name: string;
  character_name: string;
  portrait_url: string | null;
  level: number;
  xp: number;
  gold: number;
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  spirit: number;
  attribute_total: number;
  total_distance_walked_meters: number;
  training_sessions_completed: number;
  event_completions: number;
};

export const leaderboardMetrics: Array<{ key: LeaderboardMetric; label: string }> = [
  { key: "total_distance_walked_meters", label: "Distance" },
  { key: "xp", label: "XP" },
  { key: "gold", label: "Gold" },
  { key: "level", label: "Level" },
  { key: "attribute_total", label: "Attributes" },
  { key: "training_sessions_completed", label: "Training" },
  { key: "event_completions", label: "Events" },
];

export async function getLeaderboard(metric: LeaderboardMetric, limit = 50) {
  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("*")
    .order(metric, { ascending: false })
    .order("xp", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as LeaderboardRow[];
}
