import { Platform } from "react-native";

export type PedometerDistanceSample = {
  steps: number;
  distanceMeters: number;
};

export type PedometerSubscription = {
  remove: () => void;
};

export const averageStepLengthMeters = 0.762;

type PedometerModule = typeof import("expo-sensors").Pedometer;

async function loadPedometer(): Promise<PedometerModule | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const Sensors = await import("expo-sensors");
    return Sensors.Pedometer ?? null;
  } catch (error) {
    console.warn("[pedometer] native module unavailable", error);
    return null;
  }
}

export async function isNativePedometerAvailable() {
  if (Platform.OS === "web") {
    return false;
  }

  const Pedometer = await loadPedometer();
  if (!Pedometer) {
    return false;
  }

  try {
    return await Pedometer.isAvailableAsync();
  } catch (error) {
    console.warn("[pedometer] availability check failed", error);
    return false;
  }
}

export async function requestPedometerPermission() {
  if (Platform.OS === "web") {
    return false;
  }

  const Pedometer = await loadPedometer();
  if (!Pedometer) {
    return false;
  }

  try {
    const existing = await Pedometer.getPermissionsAsync();
    if (existing.status === "denied") {
      return false;
    }

    // Avoid Pedometer.requestPermissionsAsync on iOS for now. The live watcher can
    // use an existing grant, and this keeps the Motion permission prompt out of the
    // native crash path while preserving step tracking for granted devices.
    return true;
  } catch (error) {
    console.warn("[pedometer] permission check failed", error);
    return true;
  }
}

export async function watchPedometerDistance(onSample: (sample: PedometerDistanceSample) => void): Promise<PedometerSubscription> {
  if (Platform.OS === "web") {
    return { remove: () => undefined };
  }

  const Pedometer = await loadPedometer();
  if (!Pedometer) {
    return { remove: () => undefined };
  }

  try {
    const permission = await Pedometer.getPermissionsAsync();
    if (permission.status === "denied") {
      console.warn("[pedometer] step watcher not started because permission is denied");
      return { remove: () => undefined };
    }

    return Pedometer.watchStepCount((result) => {
      const steps = Math.max(0, Number(result.steps) || 0);
      onSample({
        steps,
        distanceMeters: steps * averageStepLengthMeters,
      });
    });
  } catch (error) {
    console.warn("[pedometer] live watcher failed", error);
    return { remove: () => undefined };
  }
}

export async function getTodayPedometerDistance(): Promise<PedometerDistanceSample> {
  if (Platform.OS === "web") {
    return { steps: 0, distanceMeters: 0 };
  }

  const Pedometer = await loadPedometer();
  if (!Pedometer) {
    return { steps: 0, distanceMeters: 0 };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    const result = await Pedometer.getStepCountAsync(start, new Date());
    const steps = Math.max(0, Number(result.steps) || 0);
    return {
      steps,
      distanceMeters: steps * averageStepLengthMeters,
    };
  } catch (error) {
    console.warn("[pedometer] step count failed", error);
    return { steps: 0, distanceMeters: 0 };
  }
}

export async function getPedometerDistanceBetween(start: Date, end = new Date()): Promise<PedometerDistanceSample> {
  if (Platform.OS === "web") {
    return { steps: 0, distanceMeters: 0 };
  }

  const Pedometer = await loadPedometer();
  if (!Pedometer) {
    return { steps: 0, distanceMeters: 0 };
  }

  try {
    const result = await Pedometer.getStepCountAsync(start, end);
    const steps = Math.max(0, Number(result.steps) || 0);
    return {
      steps,
      distanceMeters: steps * averageStepLengthMeters,
    };
  } catch (error) {
    console.warn("[pedometer] ranged step count failed", error);
    return { steps: 0, distanceMeters: 0 };
  }
}

export async function startPedometerDistancePolling(
  onSample: (sample: PedometerDistanceSample) => void,
  intervalMs = 5000,
): Promise<PedometerSubscription> {
  if (Platform.OS === "web") {
    return { remove: () => undefined };
  }

  let active = true;
  let baseline = await getTodayPedometerDistance();
  onSample({ steps: 0, distanceMeters: 0 });

  const interval = setInterval(() => {
    void getTodayPedometerDistance().then((sample) => {
      if (!active) {
        return;
      }

      onSample({
        steps: Math.max(0, sample.steps - baseline.steps),
        distanceMeters: Math.max(0, sample.distanceMeters - baseline.distanceMeters),
      });
    });
  }, intervalMs);

  return {
    remove: () => {
      active = false;
      clearInterval(interval);
      baseline = { steps: 0, distanceMeters: 0 };
    },
  };
}
