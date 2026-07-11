import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, StyleSheet, Text, View } from "react-native";
import type { JourneyJournalEntry } from "../../services/journeyJournalService";
import { colors, fonts } from "../theme";

type JourneyJournalPageProps = {
  entries: JourneyJournalEntry[];
  message?: string | null;
  onRefresh: () => void;
  onReplayStoryDeck?: (deckId: string) => void;
};

export function JourneyJournalPage({ entries, message, onRefresh, onReplayStoryDeck }: JourneyJournalPageProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Journey</Text>
          <Text style={styles.title}>Story Journal</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      <Text style={styles.copy}>Completed story markers and walking paths appear here in the order set by admin.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {entries.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No journal entries unlocked yet.</Text>
          <Text style={styles.copy}>Finish story markers or authored walking paths to reveal this character's journey.</Text>
        </View>
      ) : (
        <View style={styles.entryList}>
          {entries.map((entry, index) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryTop}>
                <Text style={styles.entryNumber}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.entryTitleWrap}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryMeta}>Season {entry.seasonNumber} / Chapter {entry.chapterNumber} / {getEntryTypeLabel(entry)}</Text>
                </View>
              </View>
              {resolveJournalImageUri(entry.imageUrl) ? <Image source={{ uri: resolveJournalImageUri(entry.imageUrl)! }} style={styles.entryImage} /> : null}
              {entry.body ? <Text style={styles.entryBody}>{entry.body}</Text> : null}
              {entry.sourceType === "story_deck" && entry.storyDeckId && onReplayStoryDeck ? (
                <Pressable style={styles.replayButton} onPress={() => onReplayStoryDeck(entry.storyDeckId!)}>
                  <Text style={styles.replayButtonText}>Replay Story Cards</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getEntryTypeLabel(entry: JourneyJournalEntry) {
  if (entry.sourceType === "route") return "Path";
  if (entry.sourceType === "story_deck") return "Story Deck";
  return "Story";
}

function resolveJournalImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  emptyPanel: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  entryBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  entryCard: {
    backgroundColor: "rgba(4, 6, 6, 0.74)",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  entryImage: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 150,
    width: "100%",
  },
  entryList: {
    gap: 12,
  },
  entryMeta: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  entryNumber: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    minWidth: 34,
  },
  entryTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  entryTitleWrap: {
    flex: 1,
    gap: 2,
  },
  entryTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  message: {
    color: colors.gold,
    fontWeight: "800",
  },
  refreshButton: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshText: {
    color: colors.blue,
    fontWeight: "900",
  },
  replayButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  replayButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
  },
});
