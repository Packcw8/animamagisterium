import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { colors } from "./src/components/theme";
import { supabase, testSupabaseConnection } from "./src/lib/supabase";
import { AuthScreen } from "./src/screens/AuthScreen";
import { CharacterCreationScreen } from "./src/screens/CharacterCreationScreen";
import { CharacterSheetScreen } from "./src/screens/CharacterSheetScreen";
import { CharacterWithDetails, createProfileIfMissing, getAvatarAssets, getCharacter } from "./src/services/characterService";
import { Tables } from "./src/lib/supabase";

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [character, setCharacter] = useState<CharacterWithDetails | null>(null);
  const [avatarAssets, setAvatarAssets] = useState<Tables["avatar_assets"][]>([]);
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
          <CharacterSheetScreen character={character} onRefresh={() => void loadMvpState(session)} />
        ) : (
          <CharacterCreationScreen assets={avatarAssets} onCreated={setCharacter} />
        )}
      </View>
    </SafeAreaView>
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
});
