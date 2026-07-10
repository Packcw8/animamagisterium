import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type AdminContentScopeBarProps = {
  season: number;
  chapter: number;
  onChangeSeason: (value: number) => void;
  onChangeChapter: (value: number) => void;
};

const seasonOptions = [1, 2, 3, 4];
const chapterOptions = [1, 2, 3, 4, 5, 6];

export function AdminContentScopeBar({ season, chapter, onChangeSeason, onChangeChapter }: AdminContentScopeBarProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Content Scope</Text>
      <Text style={styles.copy}>New admin items, abilities, enemies, and NPCs save to the selected season and chapter.</Text>
      <Text style={styles.label}>Season</Text>
      <View style={styles.row}>
        {seasonOptions.map((item) => (
          <Pressable key={item} style={[styles.chip, season === item && styles.chipActive]} onPress={() => onChangeSeason(item)}>
            <Text style={styles.chipText}>Season {item}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Chapter</Text>
      <View style={styles.row}>
        {chapterOptions.map((item) => (
          <Pressable key={item} style={[styles.chip, chapter === item && styles.chipActive]} onPress={() => onChangeChapter(item)}>
            <Text style={styles.chipText}>Chapter {item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function isInAdminContentScope(item: { season_number?: number | null; chapter_number?: number | null }, season: number, chapter: number) {
  return Number(item.season_number ?? 1) === season && Number(item.chapter_number ?? 1) === chapter;
}

const styles = StyleSheet.create({
  chip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  copy: {
    color: colors.muted,
    lineHeight: 18,
  },
  label: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
    textTransform: "uppercase",
  },
  panel: {
    borderColor: "rgba(218, 164, 65, 0.3)",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 15,
  },
});
