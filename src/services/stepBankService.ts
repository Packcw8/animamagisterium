import { Platform } from "react-native";
import { supabase, type Tables } from "../lib/supabase";
import { averageStepLengthMeters, getPedometerDistanceBetween, isNativePedometerAvailable } from "./nativePedometerService";

export type PlayerStepBank = Tables["player_step_bank"];

export type SpendStepBankResult = {
  spent_steps: number;
  available_steps: number;
  lifetime_imported_steps: number;
  lifetime_spent_steps: number;
  updated_at: string;
};

const importLookbackHours = 36;
const maxImportSteps = 20000;

function getImportStart(bank: PlayerStepBank | null) {
  const lookbackStart = new Date(Date.now() - importLookbackHours * 60 * 60 * 1000);
  const lastImportedAt = bank?.last_imported_at ? new Date(bank.last_imported_at) : null;

  if (lastImportedAt && Number.isFinite(lastImportedAt.getTime()) && lastImportedAt > lookbackStart) {
    return lastImportedAt;
  }

  return lookbackStart;
}

export function stepsToMeters(steps: number) {
  return Math.max(0, Math.floor(Number(steps) || 0)) * averageStepLengthMeters;
}

export function metersToSteps(meters: number) {
  return Math.max(0, Math.ceil((Number(meters) || 0) / averageStepLengthMeters));
}

export async function getPlayerStepBank(characterId: string) {
  const { data, error } = await supabase.rpc("ensure_player_step_bank", {
    p_character_id: characterId,
  });

  if (error) {
    console.warn("[step bank] unavailable", error.message);
    return null;
  }

  return data as PlayerStepBank;
}

export async function importRecentStepsToBank(characterId: string) {
  if (Platform.OS === "web") {
    throw new Error("Step Bank import is available on iPhone builds.");
  }

  const available = await isNativePedometerAvailable();
  if (!available) {
    throw new Error("Step history is not available on this device.");
  }

  const currentBank = await getPlayerStepBank(characterId);
  const startedAt = getImportStart(currentBank);
  const endedAt = new Date();
  const sample = await getPedometerDistanceBetween(startedAt, endedAt);
  const importedSteps = Math.min(maxImportSteps, Math.max(0, Math.floor(sample.steps)));

  if (importedSteps <= 0) {
    return {
      bank: currentBank,
      importedSteps: 0,
      startedAt,
      endedAt,
    };
  }

  const { data, error } = await supabase.rpc("import_steps_to_bank", {
    p_character_id: characterId,
    p_steps: importedSteps,
    p_window_started_at: startedAt.toISOString(),
    p_window_ended_at: endedAt.toISOString(),
  });

  if (error) {
    throw error;
  }

  return {
    bank: data as PlayerStepBank,
    importedSteps,
    startedAt,
    endedAt,
  };
}

export async function spendStepsFromBank(characterId: string, requestedSteps: number) {
  const { data, error } = await supabase.rpc("spend_steps_from_bank", {
    p_character_id: characterId,
    p_steps: Math.max(0, Math.floor(Number(requestedSteps) || 0)),
  });

  if (error) {
    throw error;
  }

  return data as SpendStepBankResult;
}
