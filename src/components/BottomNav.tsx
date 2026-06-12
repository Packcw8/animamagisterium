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
  { key: "map", label: "Map", icon: "MP" },
  { key: "quests", label: "Quests / Training", icon: "QT" },
  { key: "social", label: "Social", icon: "SO" },
  { key: "settings", label: "Settings", icon: "ST" },
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
    height: 76,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#070909",
    paddingBottom: 4,
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
    fontSize: 9,
    lineHeight: 11,
    textAlign: "center",
  },
  active: {
    color: colors.gold,
  },
});
