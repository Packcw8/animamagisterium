import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";

export type PedometerDistanceSample = {
  steps: number;
  distanceMeters: number;
};

export type PedometerSubscription = {
  remove: () => void;
};

const averageStepLengthMeters = 0.762;

export async function isNativePedometerAvailable() {
  if (Platform.OS === "web") {
    return false;
  }

  return Pedometer.isAvailableAsync();
}

export async function requestPedometerPermission() {
  if (Platform.OS === "web") {
    return false;
  }

  const permission = await Pedometer.requestPermissionsAsync();
  return permission.granted;
}

export function watchPedometerDistance(onSample: (sample: PedometerDistanceSample) => void): PedometerSubscription {
  if (Platform.OS === "web") {
    return { remove: () => undefined };
  }

  return Pedometer.watchStepCount((result) => {
    const steps = Math.max(0, Number(result.steps) || 0);
    onSample({
      steps,
      distanceMeters: steps * averageStepLengthMeters,
    });
  });
}

export async function getTodayPedometerDistance(): Promise<PedometerDistanceSample> {
  if (Platform.OS === "web") {
    return { steps: 0, distanceMeters: 0 };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await Pedometer.getStepCountAsync(start, new Date());
  const steps = Math.max(0, Number(result.steps) || 0);
  return {
    steps,
    distanceMeters: steps * averageStepLengthMeters,
  };
}
