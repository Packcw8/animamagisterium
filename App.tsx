import { Component, ComponentType, ErrorInfo, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import type { Tables } from "./src/lib/supabase";
import type { CharacterWithDetails } from "./src/services/characterService";
import type { ScreenKey } from "./src/types";

declare const require: <T = unknown>(path: string) => T;

const colors = {
  gold: "#d9a441",
  muted: "#a89b83",
};

const loadedScreens = new Map<string, unknown>();

function loadScreen<T>(key: string, loader: () => T): T {
  if (!loadedScreens.has(key)) {
    loadedScreens.set(key, loader());
  }

  return loadedScreens.get(key) as T;
}

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
  const [activeUtilityScreen, setActiveUtilityScreen] = useState<"settings" | "inbox" | "admin" | null>(null);
  const [requestedMapAdminSection, setRequestedMapAdminSection] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [startupMessage, setStartupMessage] = useState("Starting Anima Magisterium...");
  const [error, setError] = useState<string | null>(null);

  async function loadMvpState(activeSession: Session | null) {
    const characterService = loadScreen<{
      createProfileIfMissing: (user: Session["user"]) => Promise<unknown>;
      getAvatarAssets: () => Promise<Tables["avatar_assets"][]>;
      getCharacter: () => Promise<CharacterWithDetails | null>;
    }>("characterService", () => require("./src/services/characterService"));

    setIsLoading(true);
    setError(null);

    try {
      if (!activeSession?.user) {
        setCharacter(null);
        setAvatarAssets([]);
        return;
      }

      await characterService.createProfileIfMissing(activeSession.user);
      const [loadedCharacter, loadedAssets] = await Promise.all([characterService.getCharacter(), characterService.getAvatarAssets()]);
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
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    async function boot() {
      try {
        setStartupMessage("Loading native runtime...");
        const supabaseModule = loadScreen<{
          supabase: {
            auth: {
              getSession: () => Promise<{ data: { session: Session | null } }>;
              onAuthStateChange: (
                callback: (event: string, nextSession: Session | null) => void,
              ) => { data: { subscription: { unsubscribe: () => void } } };
            };
          };
          testSupabaseConnection: () => Promise<{ ok: boolean; message: string }>;
        }>("supabaseModule", () => require("./src/lib/supabase"));

        setStartupMessage("Checking Supabase connection...");
        supabaseModule.testSupabaseConnection().then((result) => {
          if (mounted) {
            setConnectionStatus(result);
          }
        }).catch((connectionError) => {
          if (mounted) {
            setConnectionStatus({
              ok: false,
              message: connectionError instanceof Error ? connectionError.message : "Unable to test Supabase connection.",
            });
          }
        });

        setStartupMessage("Restoring your session...");
        const { data } = await supabaseModule.supabase.auth.getSession();
        if (!mounted) {
          return;
        }

        setSession(data.session);
        setIsBooting(false);
        await loadMvpState(data.session);

        const { data: listener } = supabaseModule.supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          void loadMvpState(nextSession);
        });
        authListener = listener;
      } catch (startupError) {
        if (!mounted) {
          return;
        }

        setError(startupError instanceof Error ? startupError.message : "Unable to start Anima Magisterium.");
        setIsBooting(false);
        setIsLoading(false);
      }
    }

    void boot();

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        {isBooting ? (
          <LoadingState message={startupMessage} />
        ) : !session ? (
          <AuthScreenView connectionStatus={connectionStatus} />
        ) : isLoading ? (
          <LoadingState message={startupMessage || "Opening your character ledger..."} />
        ) : error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : character ? (
          <AuthenticatedLayout
            activeScreen={activeScreen}
            onChangeScreen={(screen) => {
              setActiveUtilityScreen(null);
              setRequestedMapAdminSection(null);
              setActiveScreen(screen);
            }}
          >
            {activeUtilityScreen === "settings" ? (
              <SettingsScreenView character={character} onBack={() => setActiveUtilityScreen(null)} onOpenAdmin={() => setActiveUtilityScreen("admin")} />
            ) : activeUtilityScreen === "inbox" ? (
              <InboxScreenView character={character} onBack={() => setActiveUtilityScreen(null)} onCharacterUpdated={setCharacter} />
            ) : activeUtilityScreen === "admin" ? (
              <AdminScreenView
                onBack={() => setActiveUtilityScreen("settings")}
                onOpenHomeAdmin={() => {
                  setRequestedMapAdminSection(null);
                  setActiveUtilityScreen(null);
                  setActiveScreen("home");
                }}
                onOpenMapAdmin={(section?: string) => {
                  setRequestedMapAdminSection(section ?? "World Markers");
                  setActiveUtilityScreen(null);
                  setActiveScreen("map");
                }}
                onOpenTrainingAdmin={() => {
                  setRequestedMapAdminSection(null);
                  setActiveUtilityScreen(null);
                  setActiveScreen("quests");
                }}
                onOpenAchievementsAdmin={() => {
                  setRequestedMapAdminSection(null);
                  setActiveUtilityScreen(null);
                  setActiveScreen("badges");
                }}
              />
            ) : activeScreen === "home" ? (
              <HomeScreenView
                character={character}
                onCharacterUpdated={setCharacter}
                onOpenInbox={() => setActiveUtilityScreen("inbox")}
                onOpenSettings={() => setActiveUtilityScreen("settings")}
              />
            ) : activeScreen === "map" ? (
              <MapScreenView character={character} onCharacterUpdated={setCharacter} initialAdminSection={requestedMapAdminSection} />
            ) : activeScreen === "quests" ? (
              <QuestsScreenView character={character} onCharacterUpdated={setCharacter} />
            ) : activeScreen === "social" ? (
              <SocialScreenView />
            ) : (
              <BadgesScreenView character={character} />
            )}
          </AuthenticatedLayout>
        ) : (
          <AuthenticatedLayout activeScreen={activeScreen} onChangeScreen={setActiveScreen}>
            <CharacterCreationScreenView assets={avatarAssets} onCreated={setCharacter} />
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

function LoadingState({ message }: { message: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

function HomeScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("HomeScreen", () => require<{ HomeScreen: ComponentType<Record<string, unknown>> }>("./src/screens/HomeScreen").HomeScreen);
  return <Screen {...props} />;
}

function MapScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("MapScreen", () => require<{ MapScreen: ComponentType<Record<string, unknown>> }>("./src/screens/MapScreen").MapScreen);
  return <Screen {...props} />;
}

function QuestsScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("QuestsScreen", () => require<{ QuestsScreen: ComponentType<Record<string, unknown>> }>("./src/screens/QuestsScreen").QuestsScreen);
  return <Screen {...props} />;
}

function SocialScreenView() {
  const Screen = loadScreen<ComponentType>("SocialScreen", () => require<{ SocialScreen: ComponentType }>("./src/screens/SocialScreen").SocialScreen);
  return <Screen />;
}

function BadgesScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("BadgesScreen", () => require<{ BadgesScreen: ComponentType<Record<string, unknown>> }>("./src/screens/BadgesScreen").BadgesScreen);
  return <Screen {...props} />;
}

function SettingsScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("SettingsScreen", () => require<{ SettingsScreen: ComponentType<Record<string, unknown>> }>("./src/screens/SettingsScreen").SettingsScreen);
  return <Screen {...props} />;
}

function InboxScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("InboxScreen", () => require<{ InboxScreen: ComponentType<Record<string, unknown>> }>("./src/screens/InboxScreen").InboxScreen);
  return <Screen {...props} />;
}

function AdminScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("AdminScreen", () => require<{ AdminScreen: ComponentType<Record<string, unknown>> }>("./src/screens/AdminScreen").AdminScreen);
  return <Screen {...props} />;
}

function CharacterCreationScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>(
    "CharacterCreationScreen",
    () => require<{ CharacterCreationScreen: ComponentType<Record<string, unknown>> }>("./src/screens/CharacterCreationScreen").CharacterCreationScreen,
  );
  return <Screen {...props} />;
}

function AuthScreenView(props: Record<string, unknown>) {
  const Screen = loadScreen<ComponentType<Record<string, unknown>>>("AuthScreen", () => require<{ AuthScreen: ComponentType<Record<string, unknown>> }>("./src/screens/AuthScreen").AuthScreen);
  return <Screen {...props} />;
}

function BottomNavView(props: Record<string, unknown>) {
  const Nav = loadScreen<ComponentType<Record<string, unknown>>>("BottomNav", () => require<{ BottomNav: ComponentType<Record<string, unknown>> }>("./src/components/BottomNav").BottomNav);
  return <Nav {...props} />;
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
      <BottomNavView active={activeScreen} onChange={onChangeScreen} />
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
