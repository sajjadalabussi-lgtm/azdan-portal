import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#0f172a",
          },
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen name="login" />

        <Stack.Screen name="client/[id]" />

        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
          }}
        />
      </Stack>
    </>
  );
}