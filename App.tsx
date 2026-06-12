import { ReactElement, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { BottomNav } from "./src/components/BottomNav";
import { BattleScreen } from "./src/screens/BattleScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InventoryScreen } from "./src/screens/InventoryScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { QuestsScreen } from "./src/screens/QuestsScreen";
import { SkillsScreen } from "./src/screens/SkillsScreen";
import { ScreenKey } from "./src/types";

const screens: Record<ScreenKey, () => ReactElement> = {
  home: HomeScreen,
  quests: QuestsScreen,
  battle: BattleScreen,
  map: MapScreen,
  profile: InventoryScreen,
};

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("home");
  const Active = useMemo(() => screens[activeScreen], [activeScreen]);

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
