import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { KeyboardAvoidingView, LogBox, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

// expo-splash-screen uses expo-keep-awake; "Unable to activate keep awake" can fail on web or when device is locked during init
const ignoreKeepAwakeError = (err: unknown) => {
  if (err != null && String(err).includes("keep awake")) return;
  if (__DEV__) console.warn("SplashScreen", err);
};
SplashScreen.preventAutoHideAsync?.()?.catch?.(ignoreKeepAwakeError);

// Suppress the keep-awake error in React Native's error overlay (Android/iOS)
LogBox.ignoreLogs(["Unable to activate keep awake", "Unable to activate keep awake."]);

function ErrorFallback({ error }: { error: Error | null }) {
  const { width } = useWindowDimensions();
  const padding = Math.max(16, Math.min(24, width * 0.06));
  const fontSize = Math.max(14, Math.min(18, width * 0.045));
  const smallSize = Math.max(11, Math.min(13, width * 0.035));
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding, backgroundColor: "#f8fafc" }}>
      <Text style={{ fontSize, color: "#1e293b", textAlign: "center" }}>
        Something went wrong. Restart the app.
      </Text>
      {__DEV__ && error && (
        <Text style={{ marginTop: 12, fontSize: smallSize, color: "#64748b", textAlign: "center", paddingHorizontal: 16 }}>
          {error.message}
        </Text>
      )}
    </View>
  );
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    // hideAsync can reject when keep-awake fails (e.g. web, or Android lock during bundle)
    SplashScreen.hideAsync?.()?.catch?.((err: unknown) => {
      if (String(err).includes("keep awake")) return;
      if (__DEV__) console.warn("SplashScreen.hideAsync", err);
    });
  }, []);

  // Ignore unhandled "Unable to activate keep awake" from expo-keep-awake (used by splash screen)
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent | { reason?: unknown }) => {
      const reason = event?.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      const isIgnorable =
        msg.includes("Unable to activate keep awake") ||
        msg.includes("keep awake") ||
        msg.includes("message channel closed") ||
        msg.includes("asynchronous response");
      if (isIgnorable) {
        const e = event as { preventDefault?: () => void; stopPropagation?: () => void };
        e.preventDefault?.();
        e.stopPropagation?.();
      }
    };
    if (typeof globalThis !== "undefined" && "addEventListener" in globalThis) {
      (globalThis as unknown as { addEventListener: (t: string, f: (e: PromiseRejectionEvent) => void) => void }).addEventListener?.("unhandledrejection", onUnhandledRejection as (e: PromiseRejectionEvent) => void);
      return () => {
        (globalThis as unknown as { removeEventListener: (t: string, f: (e: PromiseRejectionEvent) => void) => void }).removeEventListener?.("unhandledrejection", onUnhandledRejection as (e: PromiseRejectionEvent) => void);
      };
    }
    return undefined;
  }, []);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={DefaultTheme}>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <Stack screenOptions={({ route }) => ({ headerShown: !route.name?.startsWith("tempobook") })}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </KeyboardAvoidingView>
        </ThemeProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
