import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenKey } from "../types";
import { colors } from "./theme";

type Item = {
  key: ScreenKey;
  label: string;
  icon: string;
};

const items: Item[] = [
  { key: "home", label: "Home", icon: "HM" },
  { key: "quests", label: "Quests", icon: "QS" },
  { key: "battle", label: "Battle", icon: "BT" },
  { key: "map", label: "Map", icon: "MP" },
  { key: "profile", label: "Profile", icon: "PF" },
];

type BottomNavProps = {
  active: ScreenKey;
  onChange: (screen: ScreenKey) => void;
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable key={item.key} style={styles.item} onPress={() => onChange(item.key)}>
            <Text style={[styles.icon, selected && styles.active]}>{item.icon}</Text>
            <Text style={[styles.label, selected && styles.active]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 70,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#070706",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  icon: {
    color: colors.goldSoft,
    fontWeight: "700",
    fontSize: 12,
  },
  label: {
    color: colors.goldSoft,
    fontSize: 11,
  },
  active: {
    color: colors.gold,
  },
});
