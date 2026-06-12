import { ReactElement, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { BottomNav } from "./src/components/BottomNav";
import { BattleScreen } from "./src/screens/BattleScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { InventoryScreen } from "./src/screens/InventoryScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { QuestsScreen } from "./src/screens/QuestsScreen";
import { testSupabaseConnection } from "./src/lib/supabase";
import { ScreenKey } from "./src/types";

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("home");
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const screens: Record<ScreenKey, () => ReactElement> = useMemo(
    () => ({
      home: () => <DashboardScreen connectionStatus={connectionStatus} />,
      quests: QuestsScreen,
      battle: BattleScreen,
      map: MapScreen,
      profile: InventoryScreen,
    }),
    [connectionStatus],
  );
  const Active = useMemo(() => screens[activeScreen], [activeScreen]);

  useEffect(() => {
    let mounted = true;

    testSupabaseConnection()
      .then((result) => {
        if (mounted) {
          setConnectionStatus(result);
        }
      })
      .catch((error) => {
        if (mounted) {
          setConnectionStatus({
            ok: false,
            message: error instanceof Error ? error.message : "Unable to connect to Supabase.",
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shell}>
        <Active />
        <BottomNav active={activeScreen} onChange={setActiveScreen} />
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
});
