import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useMemo, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import type { MapMarker } from "../../services/mapService";
import type { PlayerPuzzleProgress, PuzzleDefinition, PuzzleTapZone } from "../../services/puzzleService";

export type PuzzleTapResult = {
  zone: PuzzleTapZone;
  correct: boolean;
  completed: boolean;
  nextIndex: number;
  attempts: number;
};

export function PuzzleSceneScreen({
  marker,
  puzzle,
  zones,
  progress,
  message,
  onExit,
  onTapZone,
}: {
  marker: MapMarker;
  puzzle: PuzzleDefinition;
  zones: PuzzleTapZone[];
  progress: PlayerPuzzleProgress | null;
  message: string | null;
  onExit: () => void;
  onTapZone: (result: PuzzleTapResult) => void;
}) {
  const orderedZones = useMemo(() => zones.filter((zone) => zone.is_active).sort((a, b) => a.sequence_order - b.sequence_order), [zones]);
  const completed = Boolean(progress?.completed_at);
  const [localIndex, setLocalIndex] = useState(completed ? orderedZones.length : Math.max(0, Number(progress?.current_index) || 0));
  const [attempts, setAttempts] = useState(Math.max(0, Number(progress?.attempts) || 0));
  const [localMessage, setLocalMessage] = useState<string | null>(completed ? puzzle.success_text || "Puzzle complete." : null);
  const imageUri = resolvePuzzleImageUri(puzzle.image_url || marker.scene_background_image_url || marker.quest_image_url);
  const progressLabel = `${Math.min(localIndex, orderedZones.length)} / ${orderedZones.length}`;

  function handleZonePress(zone: PuzzleTapZone) {
    if (completed || orderedZones.length === 0) {
      return;
    }

    const expected = orderedZones[localIndex];
    const correct = expected?.id === zone.id;
    const completedNow = correct && localIndex + 1 >= orderedZones.length;
    const nextAttempts = correct ? attempts : attempts + 1;
    const nextIndex = correct ? localIndex + 1 : puzzle.reset_on_failure ? 0 : localIndex;
    const lockedOut = !correct && Number(puzzle.max_attempts) > 0 && nextAttempts >= Number(puzzle.max_attempts);

    setAttempts(nextAttempts);
    setLocalIndex(nextIndex);
    setLocalMessage(
      correct
        ? completedNow
          ? puzzle.success_text || "The sequence settles into place."
          : zone.clue_text || "That symbol answers."
        : lockedOut
          ? "The puzzle refuses another attempt."
          : puzzle.failure_text || "That does not feel right.",
    );

    onTapZone({
      zone,
      correct,
      completed: completedNow,
      nextIndex,
      attempts: nextAttempts,
    });
  }

  return (
    <Screen>
      <Frame style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{puzzle.title || marker.title}</Text>
            <Text style={styles.copy}>{marker.title}</Text>
          </View>
          <Pressable style={styles.exitButton} onPress={onExit}>
            <Text style={styles.exitText}>Exit</Text>
          </Pressable>
        </View>
        {puzzle.intro_text ? <Text style={styles.dialogue}>{puzzle.intro_text}</Text> : null}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Sequence {progressLabel}</Text>
          <Text style={styles.copy}>{Number(puzzle.max_attempts) > 0 ? `Attempts ${attempts}/${puzzle.max_attempts}` : "Attempts unlimited"}</Text>
        </View>
        <View style={styles.puzzleImageWrap}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.puzzleImage} /> : <Text style={styles.copy}>No puzzle image set.</Text>}
          {orderedZones.map((zone, index) => {
            const found = index < localIndex;
            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                accessibilityLabel={zone.player_label || zone.label}
                style={[
                  styles.tapZone,
                  found && styles.tapZoneFound,
                  {
                    left: `${zone.x_percent}%`,
                    top: `${zone.y_percent}%`,
                    width: `${Math.max(8, zone.radius_percent * 2)}%`,
                    height: `${Math.max(8, zone.radius_percent * 2)}%`,
                  },
                ]}
                onPress={() => handleZonePress(zone)}
              >
                <Text style={styles.tapZoneText}>{found ? "✓" : zone.icon_label || "?"}</Text>
              </Pressable>
            );
          })}
        </View>
        {localMessage || message ? <Text style={styles.feedback}>{message || localMessage}</Text> : null}
        {orderedZones.length === 0 ? <Text style={styles.feedback}>This puzzle has no tap zones yet.</Text> : null}
      </Frame>
    </Screen>
  );
}

function resolvePuzzleImageUri(path?: string | null) {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  dialogue: {
    backgroundColor: "rgba(0,0,0,0.42)",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
  },
  exitButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  exitText: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  feedback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 14,
    textTransform: "uppercase",
  },
  puzzleImage: {
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  puzzleImageWrap: {
    alignItems: "center",
    aspectRatio: 1.25,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    maxHeight: Platform.OS === "web" ? 560 : 460,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  screen: {
    gap: 14,
  },
  tapZone: {
    alignItems: "center",
    backgroundColor: "rgba(5, 8, 8, 0.3)",
    borderColor: "rgba(218, 164, 65, 0.55)",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 34,
    position: "absolute",
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  tapZoneFound: {
    backgroundColor: "rgba(30, 168, 236, 0.26)",
    borderColor: colors.blue,
  },
  tapZoneText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
});
