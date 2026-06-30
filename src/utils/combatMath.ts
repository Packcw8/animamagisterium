import type { EnemyWithLoadout, NpcWithLoadout } from "../services/combatAdminService";

export const maxGpsAccuracyMeters = 50;
export const maxTrackingGapSeconds = 60;
export const movementSpeedThresholdMph = 1;
export const maxHumanSpeedMph = 12;
export const minCountedGpsMeters = 0.5;

export function chooseWeightedEnemyAbility(enemy: EnemyWithLoadout | NpcWithLoadout | null, stamina: number, magika: number, currentHp?: number) {
  const valid = (enemy?.abilities ?? []).filter((row) => row.ability && row.ability.is_active && row.ability.stamina_cost <= stamina && row.ability.magika_cost <= magika);
  const maxHp = Number(enemy?.health ?? 0);
  const hurtRatio = maxHp > 0 && typeof currentHp === "number" ? currentHp / maxHp : 1;
  const weighted = valid.map((row) => {
    const ability = row.ability;
    const baseWeight = Math.max(1, Number(row.use_weight) || 1);
    const smartWeight = ability?.type === "heal" && hurtRatio <= 0.45
      ? baseWeight * 4
      : (ability?.type === "defense" || ability?.type === "buff") && hurtRatio <= 0.35
        ? baseWeight * 2
        : baseWeight;
    return { row, weight: smartWeight };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  if (valid.length === 0 || totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  for (const { row, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      return row.ability ?? null;
    }
  }

  return valid[0].ability ?? null;
}

export function rollD20Attack(statBonus: number, abilityBonus: number, defense: number, criticalChance: number, criticalMultiplier: number) {
  const roll = Math.ceil(Math.random() * 20);
  const naturalCritical = roll === 20;
  const naturalMiss = roll === 1;
  const critical = naturalCritical || Math.random() * 100 < criticalChance;
  const total = roll + Math.floor(Number(statBonus) || 0) + Math.floor(Number(abilityBonus) || 0);

  return {
    roll,
    total,
    hit: !naturalMiss && (naturalCritical || total >= defense),
    critical,
    criticalMultiplier,
  };
}

export function getD20StatBonus(attributeLevel: number) {
  return Math.floor((Number(attributeLevel) || 0) / 2);
}

export function getDefenseAttributeBonus(attributeLevel: number) {
  return 0;
}

export function metersPerSecondToMph(metersPerSecond: number) {
  return metersPerSecond * 2.23694;
}

export function classifyMovement({
  meters,
  elapsedSeconds,
  speedMph,
  accuracy,
}: {
  meters: number;
  elapsedSeconds: number;
  speedMph: number;
  accuracy: number | null;
}) {
  if (accuracy !== null && accuracy > maxGpsAccuracyMeters) {
    return {
      label: "Low GPS accuracy",
      countedMeters: 0,
      blockedReason: `Travel paused: GPS accuracy is ${Math.round(accuracy)}m. Move somewhere with a clearer signal.`,
    };
  }

  if (elapsedSeconds <= 0) {
    return {
      label: "Waiting for GPS",
      countedMeters: 0,
      blockedReason: "Travel paused: waiting for the next GPS sample.",
    };
  }

  if (elapsedSeconds > maxTrackingGapSeconds) {
    return {
      label: "Tracking gap",
      countedMeters: 0,
      blockedReason: "Travel paused: GPS was inactive too long to count this jump.",
    };
  }

  if (meters < minCountedGpsMeters || speedMph <= movementSpeedThresholdMph) {
    return {
      label: "IDLE",
      countedMeters: 0,
      blockedReason: null,
    };
  }

  if (speedMph > maxHumanSpeedMph) {
    return {
      label: "Vehicle speed",
      countedMeters: 0,
      blockedReason: `Travel paused: ${speedMph.toFixed(1)} mph is too fast for walking progress.`,
    };
  }

  return {
    label: "MOVING",
    countedMeters: meters,
    blockedReason: null,
  };
}
