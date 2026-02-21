import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import "../global.css";

SplashScreen.preventAutoHideAsync();

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
  React.useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={({ route }) => ({ headerShown: !route.name?.startsWith("tempobook") })}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
