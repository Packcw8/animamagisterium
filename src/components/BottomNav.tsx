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
  { key: "quests", label: "Training", icon: "TR" },
  { key: "map", label: "Map", icon: "MP" },
  { key: "social", label: "Social", icon: "SO" },
  { key: "badges", label: "Badges", icon: "BD" },
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
          <Pressable key={item.key} style={[styles.item, item.key === "map" && styles.centerItem]} onPress={() => onChange(item.key)}>
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
  centerItem: {
    marginTop: -18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 42,
    backgroundColor: "#10100f",
    height: 82,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  icon: {
    color: colors.goldSoft,
    fontWeight: "900",
    fontSize: 18,
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
