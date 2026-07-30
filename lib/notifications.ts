import * as Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const ANDROID_CHANNEL_ID = "azdan-updates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type RegisterPushOptions = {
  clientId: number;
};

export async function registerClientForPushNotifications({
  clientId,
}: RegisterPushOptions): Promise<string | null> {
  if (!Number.isFinite(clientId) || clientId <= 0) {
    throw new Error("رقم العميل غير صحيح");
  }

  if (!Device.isDevice) {
    throw new Error(
      "الإشعارات الخارجية تعمل على هاتف حقيقي فقط"
    );
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      ANDROID_CHANNEL_ID,
      {
        name: "تحديثات أزدان",
        description:
          "إشعارات المشروع والصور والملفات والدفعات",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#d4a94e",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      }
    );
  }

  const currentPermission =
    await Notifications.getPermissionsAsync();

  let permissionStatus = currentPermission.status;

  if (permissionStatus !== "granted") {
    const requestedPermission =
      await Notifications.requestPermissionsAsync();

    permissionStatus = requestedPermission.status;
  }

  if (permissionStatus !== "granted") {
    throw new Error(
      "لم يتم السماح لتطبيق أزدان بإرسال الإشعارات"
    );
  }

  const projectId =
    Constants.default.expoConfig?.extra?.eas?.projectId ??
    Constants.default.easConfig?.projectId;

  if (!projectId) {
    throw new Error(
      "لم يتم العثور على EAS projectId داخل إعدادات التطبيق"
    );
  }

  const tokenResult =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  const expoPushToken = tokenResult.data;

  if (!expoPushToken) {
    throw new Error(
      "تعذر الحصول على رمز إشعارات الجهاز"
    );
  }

  const { error } = await supabase
    .from("client_push_tokens")
    .upsert(
      {
        client_id: clientId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "expo_push_token",
      }
    );

  if (error) {
    throw error;
  }

  console.log("Push token saved:", expoPushToken);

  return expoPushToken;
}