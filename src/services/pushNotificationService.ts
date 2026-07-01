import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export type PushPermissionState = {
  granted: boolean;
  status: string;
};

export async function requestPushNotificationPermission(): Promise<PushPermissionState> {
  if (Platform.OS === "web") {
    return { granted: false, status: "web-unavailable" };
  }

  const existing = await Notifications.getPermissionsAsync();
  const finalPermission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  return {
    granted: finalPermission.granted,
    status: finalPermission.status,
  };
}

export async function scheduleLocalNotification(title: string, body: string) {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}
