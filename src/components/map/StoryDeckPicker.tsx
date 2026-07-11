import { StyleSheet, Text, View } from "react-native";
import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { formatStoryDeckLabel, type StoryDeck } from "../../services/storyDeckService";
import { colors, fonts } from "../theme";

type StoryDeckPickerProps = {
  decks: StoryDeck[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  label?: string;
  helper?: string;
  seasonNumber?: number;
  chapterNumber?: number;
};

export function StoryDeckPicker({ decks, selectedId, onSelect, label = "Story Card Deck", helper, seasonNumber, chapterNumber }: StoryDeckPickerProps) {
  const scopedDecks = decks
    .filter((deck) => deck.is_active)
    .filter((deck) => seasonNumber == null || Number(deck.season_number ?? 1) === seasonNumber)
    .filter((deck) => chapterNumber == null || Number(deck.chapter_number ?? 1) === chapterNumber)
    .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0) || left.title.localeCompare(right.title));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <View style={styles.chips}>
        <Pressable style={[styles.chip, !selectedId && styles.activeChip]} onPress={() => onSelect(null)}>
          <Text style={styles.chipText}>None</Text>
        </Pressable>
        {scopedDecks.map((deck) => (
          <Pressable key={deck.id} style={[styles.chip, selectedId === deck.id && styles.activeChip]} onPress={() => onSelect(deck.id)}>
            <Text style={styles.chipText}>{deck.title}</Text>
            <Text style={styles.metaText}>{formatStoryDeckLabel(deck.deck_type)} / {formatStoryDeckLabel(deck.trigger_type)}</Text>
          </Pressable>
        ))}
      </View>
      {scopedDecks.length === 0 ? <Text style={styles.helper}>No active story decks for this season/chapter yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 8,
  },
  label: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  helper: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    maxWidth: "100%",
  },
  activeChip: {
    borderColor: colors.blue,
    backgroundColor: "rgba(0, 174, 255, 0.24)",
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
});
