import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

const CHANNEL_ID = "azdan-updates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function prepareAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "تحديثات أزدان",
    description: "إشعارات المشروع والصور والملفات والدفعات",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#d4a94e",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export async function registerClientPushToken(clientId: number) {
  if (!Number.isFinite(clientId) || clientId <= 0) {
    throw new Error("رقم العميل غير صحيح");
  }

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return null;
  }

  await prepareAndroidChannel();

  const currentPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    console.warn("Notification permission was not granted.");
    return null;
  }

  const projectId = getProjectId();

  if (!projectId) {
    throw new Error("EAS projectId غير موجود في app.json");
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const expoPushToken = tokenResponse.data;

  const { error } = await supabase
    .from("client_push_tokens")
    .upsert(
      {
        client_id: clientId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        device_name: Device.deviceName ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "expo_push_token",
      }
    );

  if (error) throw error;

  return expoPushToken;
}

export async function deactivateClientPushToken(expoPushToken: string) {
  const { error } = await supabase
    .from("client_push_tokens")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("expo_push_token", expoPushToken);

  if (error) throw error;
}
