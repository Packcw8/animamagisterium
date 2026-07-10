import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Map, ScrollText, Shield, Trophy, Users } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { ScreenKey } from "../types";
import { colors } from "./theme";

type Item = {
  key: ScreenKey;
  label: string;
  Icon: typeof Shield;
};

const items: Item[] = [
  { key: "home", label: "Home", Icon: Shield },
  { key: "quests", label: "Training", Icon: ScrollText },
  { key: "map", label: "Map", Icon: Map },
  { key: "social", label: "Social", Icon: Users },
  { key: "badges", label: "Achievements", Icon: Trophy },
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
        const Icon = item.Icon;
        return (
          <Pressable key={item.key} style={[styles.item, item.key === "map" && styles.centerItem]} onPress={() => onChange(item.key)}>
            <Icon size={23} color={selected ? colors.gold : colors.goldSoft} strokeWidth={2.3} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.label, selected && styles.active]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 84,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#070909",
    paddingBottom: 10,
    paddingHorizontal: 2,
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
  label: {
    color: colors.goldSoft,
    fontSize: 9,
    lineHeight: 11,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
  active: {
    color: colors.gold,
  },
});
