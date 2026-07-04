import { AppState, Platform } from "react-native";
import type { NotificationBehavior } from "expo-notifications";

export type PushPermissionState = {
  granted: boolean;
  status: string;
};

type NotificationsModule = typeof import("expo-notifications");

let notificationHandlerConfigured = false;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return await import("expo-notifications");
  } catch (error) {
    console.warn("[notifications] native module unavailable", error);
    return null;
  }
}

async function configureNotificationHandler(Notifications: NotificationsModule) {
  if (notificationHandlerConfigured) {
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      } as NotificationBehavior),
    });
    notificationHandlerConfigured = true;
  } catch (error) {
    console.warn("[notifications] foreground handler unavailable", error);
  }
}

export async function requestPushNotificationPermission(): Promise<PushPermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return {
      granted: false,
      status: Platform.OS === "web" ? "web-unavailable" : "module-unavailable",
    };
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    const finalPermission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    return {
      granted: finalPermission.granted,
      status: finalPermission.status,
    };
  } catch (error) {
    console.warn("[notifications] permission unavailable", error);
    return { granted: false, status: "permission-error" };
  }
}

export async function scheduleLocalNotification(title: string, body: string) {
  if (Platform.OS !== "web" && AppState.currentState === "active") {
    return null;
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return null;
  }

  await configureNotificationHandler(Notifications);

  const permission = await requestPushNotificationPermission();
  if (!permission.granted) {
    return null;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("[notifications] schedule unavailable", error);
    return null;
  }
}
