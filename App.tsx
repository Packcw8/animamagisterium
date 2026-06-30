import { Session } from "@supabase/supabase-js";
import { Component, ErrorInfo, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "./src/components/BottomNav";
import { colors } from "./src/components/theme";
import { supabase, testSupabaseConnection } from "./src/lib/supabase";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BadgesScreen } from "./src/screens/BadgesScreen";
import { CharacterCreationScreen } from "./src/screens/CharacterCreationScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { QuestsScreen } from "./src/screens/QuestsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SocialScreen } from "./src/screens/SocialScreen";
import { CharacterWithDetails, createProfileIfMissing, getAvatarAssets, getCharacter } from "./src/services/characterService";
import { Tables } from "./src/lib/supabase";
import { ScreenKey } from "./src/types";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

function AppShell() {
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [character, setCharacter] = useState<CharacterWithDetails | null>(null);
  const [avatarAssets, setAvatarAssets] = useState<Tables["avatar_assets"][]>([]);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("home");
  const [activeUtilityScreen, setActiveUtilityScreen] = useState<"settings" | "inbox" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMvpState(activeSession: Session | null) {
    setIsLoading(true);
    setError(null);

    try {
      if (!activeSession?.user) {
        setCharacter(null);
        setAvatarAssets([]);
        return;
      }

      await createProfileIfMissing(activeSession.user);
      const [loadedCharacter, loadedAssets] = await Promise.all([getCharacter(), getAvatarAssets()]);
      setCharacter(loadedCharacter);
      setAvatarAssets(loadedAssets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Animamagisterium.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    testSupabaseConnection().then((result) => {
      if (mounted) {
        setConnectionStatus(result);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      void loadMvpState(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadMvpState(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        {!session ? (
          <AuthScreen connectionStatus={connectionStatus} />
        ) : isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Opening your character ledger...</Text>
          </View>
        ) : error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : character ? (
          <AuthenticatedLayout
            activeScreen={activeScreen}
            onChangeScreen={(screen) => {
              setActiveUtilityScreen(null);
              setActiveScreen(screen);
            }}
          >
            {activeUtilityScreen === "settings" ? (
              <SettingsScreen character={character} onBack={() => setActiveUtilityScreen(null)} />
            ) : activeUtilityScreen === "inbox" ? (
              <InboxScreen character={character} onBack={() => setActiveUtilityScreen(null)} onCharacterUpdated={setCharacter} />
            ) : activeScreen === "home" ? (
              <HomeScreen
                character={character}
                onCharacterUpdated={setCharacter}
                onOpenInbox={() => setActiveUtilityScreen("inbox")}
                onOpenSettings={() => setActiveUtilityScreen("settings")}
              />
            ) : activeScreen === "map" ? (
              <MapScreen character={character} onCharacterUpdated={setCharacter} />
            ) : activeScreen === "quests" ? (
              <QuestsScreen character={character} onCharacterUpdated={setCharacter} />
            ) : activeScreen === "social" ? (
              <SocialScreen />
            ) : (
              <BadgesScreen character={character} />
            )}
          </AuthenticatedLayout>
        ) : (
          <AuthenticatedLayout activeScreen={activeScreen} onChangeScreen={setActiveScreen}>
            <CharacterCreationScreen assets={avatarAssets} onCreated={setCharacter} />
          </AuthenticatedLayout>
        )}
      </View>
    </SafeAreaView>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : "The app hit an unknown startup error.",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[app] startup render error", error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Anima Magisterium could not open.</Text>
          <Text style={styles.errorText}>{this.state.error}</Text>
        </View>
      </SafeAreaView>
    );
  }
}

function AuthenticatedLayout({
  activeScreen,
  onChangeScreen,
  children,
}: {
  activeScreen: ScreenKey;
  onChangeScreen: (screen: ScreenKey) => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.authenticated}>
      <View style={styles.authenticatedContent}>{children}</View>
      <BottomNav active={activeScreen} onChange={onChangeScreen} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#040606",
  },
  shell: {
    flex: 1,
    backgroundColor: "#040606",
  },
  authenticated: {
    flex: 1,
  },
  authenticatedContent: {
    flex: 1,
    paddingBottom: 0,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
  },
  error: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: "#ffb4aa",
    textAlign: "center",
    lineHeight: 22,
  },
  errorTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
});
