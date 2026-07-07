import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "../admin/AdminImageUploadButton";
import { colors, fonts } from "../theme";
import type { MapMarker } from "../../services/mapService";
import {
  blankPuzzleDefinition,
  blankPuzzleZone,
  deletePuzzleZone,
  getPuzzleDefinitionsForMarker,
  getPuzzleZones,
  savePuzzleDefinition,
  savePuzzleZone,
  type PuzzleDefinition,
  type PuzzleTapZone,
} from "../../services/puzzleService";

type PuzzleDraft = ReturnType<typeof blankPuzzleDefinition> & { id?: string; created_by?: string | null };
type ZoneDraft = ReturnType<typeof blankPuzzleZone> & { id?: string };

export function PuzzleAdminPanel({
  marker,
  markers,
  clickedPercent,
  onMessage,
}: {
  marker: MapMarker;
  markers: MapMarker[];
  clickedPercent: { x: number; y: number } | null;
  onMessage: (message: string) => void;
}) {
  const [draft, setDraft] = useState<PuzzleDraft>(() => blankPuzzleDefinition(marker.id, marker.season_number, marker.chapter_number));
  const [zones, setZones] = useState<PuzzleTapZone[]>([]);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(() => blankPuzzleZone("", 1));
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const puzzleImage = resolvePuzzleImageUri(draft.image_url || marker.scene_background_image_url || marker.quest_image_url);
  const unlockTargets = useMemo(
    () => markers.filter((item) => item.id !== marker.id && item.season_number === marker.season_number && item.chapter_number === marker.chapter_number),
    [marker, markers],
  );

  useEffect(() => {
    void loadPuzzle();
  }, [marker.id]);

  async function loadPuzzle() {
    try {
      const [existing] = await getPuzzleDefinitionsForMarker(marker.id);
      const nextDraft = existing
        ? { ...existing }
        : blankPuzzleDefinition(marker.id, marker.season_number, marker.chapter_number);
      setDraft(nextDraft);
      const loadedZones = existing ? await getPuzzleZones(existing.id) : [];
      setZones(loadedZones);
      setZoneDraft(blankPuzzleZone(existing?.id ?? "", loadedZones.length + 1, clickedPercent ?? undefined));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to load puzzle.");
    }
  }

  async function savePuzzle() {
    try {
      const saved = await savePuzzleDefinition(draft);
      setDraft({ ...saved });
      if (!zoneDraft.puzzle_id) {
        setZoneDraft((current) => ({ ...current, puzzle_id: saved.id }));
      }
      onMessage("Puzzle saved.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save puzzle. Confirm the migration has run.");
    }
  }

  async function saveZone() {
    const puzzleId = draft.id;
    if (!puzzleId) {
      onMessage("Save the puzzle before adding tap zones.");
      return;
    }

    try {
      const saved = await savePuzzleZone({ ...zoneDraft, puzzle_id: puzzleId });
      setZones((current) => [saved, ...current.filter((zone) => zone.id !== saved.id)].sort((a, b) => a.sequence_order - b.sequence_order));
      setZoneDraft(blankPuzzleZone(puzzleId, zones.length + 2, clickedPercent ?? undefined));
      onMessage("Puzzle tap zone saved.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save tap zone.");
    }
  }

  async function removeZone(zoneId: string) {
    try {
      await deletePuzzleZone(zoneId);
      setZones((current) => current.filter((zone) => zone.id !== zoneId));
      onMessage("Puzzle tap zone removed.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to remove tap zone.");
    }
  }

  function editZone(zone: PuzzleTapZone) {
    setZoneDraft({ ...zone });
  }

  function setZoneFromPoint(point: { x: number; y: number }) {
    setZoneDraft((current) => ({
      ...current,
      x_percent: point.x,
      y_percent: point.y,
    }));
  }

  function handlePuzzleTap(event: unknown) {
    const point = getPercentPoint(event, imageSize);
    if (!point) {
      return;
    }
    setZoneFromPoint(point);
    onMessage(`Puzzle zone coordinates: X ${point.x}% / Y ${point.y}%`);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Sequence Puzzle Builder</Text>
      <Text style={styles.copy}>Save the puzzle, then tap the image to place each zone. Sequence order controls the correct player tap order.</Text>

      <TextInput value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} placeholder="Puzzle title" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draft.intro_text ?? ""} onChangeText={(intro_text) => setDraft((current) => ({ ...current, intro_text }))} placeholder="Puzzle intro text" placeholderTextColor={colors.muted} style={[styles.input, styles.textArea]} multiline />
      <TextInput value={draft.image_url ?? ""} onChangeText={(image_url) => setDraft((current) => ({ ...current, image_url }))} placeholder="Puzzle image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="puzzles" onUploaded={(image_url) => setDraft((current) => ({ ...current, image_url }))} onMessage={onMessage} />

      <View
        style={styles.preview}
        onLayout={(event) => setImageSize({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}
        {...(Platform.OS === "web"
          ? ({ onClick: handlePuzzleTap } as object)
          : ({ onTouchEnd: handlePuzzleTap } as object))}
      >
        {puzzleImage ? <Image source={{ uri: puzzleImage }} style={styles.previewImage} /> : <Text style={styles.copy}>No puzzle image set.</Text>}
        {zones.map((zone) => (
          <Pressable
            key={zone.id}
            style={[
              styles.zonePin,
              {
                left: `${zone.x_percent}%`,
                top: `${zone.y_percent}%`,
                width: `${zone.radius_percent * 2}%`,
                height: `${zone.radius_percent * 2}%`,
                borderRadius: 999,
              },
            ]}
            onPress={() => editZone(zone)}
          >
            <Text style={styles.zonePinText}>{zone.icon_label || zone.sequence_order}</Text>
          </Pressable>
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.zoneDraftPin,
            {
              left: `${zoneDraft.x_percent}%`,
              top: `${zoneDraft.y_percent}%`,
              width: `${zoneDraft.radius_percent * 2}%`,
              height: `${zoneDraft.radius_percent * 2}%`,
            },
          ]}
        />
      </View>

      <View style={styles.row}>
        <TextInput value={zoneDraft.label} onChangeText={(label) => setZoneDraft((current) => ({ ...current, label }))} placeholder="Zone label" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
        <TextInput value={String(zoneDraft.sequence_order)} onChangeText={(sequence_order) => setZoneDraft((current) => ({ ...current, sequence_order: Number(sequence_order) || 1 }))} placeholder="Order" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]} />
      </View>
      <TextInput value={zoneDraft.player_label ?? ""} onChangeText={(player_label) => setZoneDraft((current) => ({ ...current, player_label }))} placeholder="Player-facing label optional" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={zoneDraft.clue_text ?? ""} onChangeText={(clue_text) => setZoneDraft((current) => ({ ...current, clue_text }))} placeholder="Clue/feedback text optional" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        <TextInput value={String(zoneDraft.x_percent)} onChangeText={(x_percent) => setZoneDraft((current) => ({ ...current, x_percent: Number(x_percent) || 0 }))} placeholder="X %" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]} />
        <TextInput value={String(zoneDraft.y_percent)} onChangeText={(y_percent) => setZoneDraft((current) => ({ ...current, y_percent: Number(y_percent) || 0 }))} placeholder="Y %" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]} />
        <TextInput value={String(zoneDraft.radius_percent)} onChangeText={(radius_percent) => setZoneDraft((current) => ({ ...current, radius_percent: Number(radius_percent) || 6 }))} placeholder="Radius %" placeholderTextColor={colors.muted} style={[styles.input, styles.smallInput]} />
      </View>
      <TextInput value={zoneDraft.icon_label ?? ""} onChangeText={(icon_label) => setZoneDraft((current) => ({ ...current, icon_label }))} placeholder="Zone icon label, example 1 or moon" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={styles.secondaryButton} onPress={saveZone}>
        <Text style={styles.secondaryText}>{zoneDraft.id ? "Save Tap Zone" : "Add Tap Zone"}</Text>
      </Pressable>

      {zones.map((zone) => (
        <View key={zone.id} style={styles.zoneRow}>
          <View style={styles.zoneText}>
            <Text style={styles.zoneTitle}>{zone.sequence_order}. {zone.label}</Text>
            <Text style={styles.copy}>X {Math.round(zone.x_percent)} / Y {Math.round(zone.y_percent)} / Radius {Math.round(zone.radius_percent)}</Text>
          </View>
          <Pressable style={styles.rowButton} onPress={() => editZone(zone)}><Text style={styles.secondaryText}>Edit</Text></Pressable>
          <Pressable style={styles.deleteButton} onPress={() => void removeZone(zone.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
        </View>
      ))}

      <TextInput value={draft.success_text ?? ""} onChangeText={(success_text) => setDraft((current) => ({ ...current, success_text }))} placeholder="Success message" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draft.failure_text ?? ""} onChangeText={(failure_text) => setDraft((current) => ({ ...current, failure_text }))} placeholder="Failure message" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        <Pressable style={[styles.toggleButton, draft.reset_on_failure && styles.activeButton]} onPress={() => setDraft((current) => ({ ...current, reset_on_failure: !current.reset_on_failure }))}>
          <Text style={styles.secondaryText}>Reset On Failure: {draft.reset_on_failure ? "Yes" : "No"}</Text>
        </Pressable>
        <Pressable style={[styles.toggleButton, draft.complete_marker_on_success && styles.activeButton]} onPress={() => setDraft((current) => ({ ...current, complete_marker_on_success: !current.complete_marker_on_success }))}>
          <Text style={styles.secondaryText}>Complete Marker: {draft.complete_marker_on_success ? "Yes" : "No"}</Text>
        </Pressable>
      </View>
      <TextInput value={String(draft.max_attempts ?? 0)} onChangeText={(max_attempts) => setDraft((current) => ({ ...current, max_attempts: Number(max_attempts) || 0 }))} placeholder="Max attempts, 0 unlimited" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draft.set_story_flag_key ?? ""} onChangeText={(set_story_flag_key) => setDraft((current) => ({ ...current, set_story_flag_key }))} placeholder="Set story flag on success optional" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, !draft.unlock_marker_id && styles.routeChipActive]} onPress={() => setDraft((current) => ({ ...current, unlock_marker_id: null }))}><Text style={styles.routeChipText}>No Unlock Marker</Text></Pressable>
        {unlockTargets.map((target) => (
          <Pressable key={target.id} style={[styles.routeChip, draft.unlock_marker_id === target.id && styles.routeChipActive]} onPress={() => setDraft((current) => ({ ...current, unlock_marker_id: target.id }))}>
            <Text style={styles.routeChipText}>{target.title}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.primaryButton} onPress={savePuzzle}>
        <Text style={styles.primaryText}>{draft.id ? "Save Puzzle" : "Create Puzzle"}</Text>
      </Pressable>
    </View>
  );
}

function getPercentPoint(event: unknown, size: { width: number; height: number }) {
  const nativeEvent = (event as { nativeEvent?: { locationX?: number; locationY?: number } }).nativeEvent;
  const webEvent = event as { currentTarget?: { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number } }; clientX?: number; clientY?: number };
  if (nativeEvent?.locationX != null && nativeEvent?.locationY != null) {
    return {
      x: roundPercent((nativeEvent.locationX / size.width) * 100),
      y: roundPercent((nativeEvent.locationY / size.height) * 100),
    };
  }

  const rect = webEvent.currentTarget?.getBoundingClientRect?.();
  if (rect && webEvent.clientX != null && webEvent.clientY != null) {
    return {
      x: roundPercent(((webEvent.clientX - rect.left) / rect.width) * 100),
      y: roundPercent(((webEvent.clientY - rect.top) / rect.height) * 100),
    };
  }

  return null;
}

function roundPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
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
  activeButton: {
    backgroundColor: "rgba(30, 168, 236, 0.22)",
    borderColor: colors.blue,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  deleteButton: {
    borderColor: "rgba(255, 140, 140, 0.65)",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteText: {
    color: "#ffb0a8",
    fontFamily: fonts.title,
    fontSize: 12,
  },
  flexInput: {
    flex: 1,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  preview: {
    alignItems: "center",
    aspectRatio: 1.35,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  previewImage: {
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 14,
  },
  primaryText: {
    color: "#090704",
    fontFamily: fonts.title,
    fontSize: 13,
  },
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(30, 168, 236, 0.22)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  rowButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  smallInput: {
    minWidth: 76,
  },
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  textArea: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  toggleButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  zoneDraftPin: {
    borderColor: colors.blue,
    borderRadius: 999,
    borderWidth: 2,
    position: "absolute",
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  zonePin: {
    alignItems: "center",
    backgroundColor: "rgba(2, 7, 7, 0.62)",
    borderColor: colors.gold,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 28,
    position: "absolute",
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
  zonePinText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  zoneRow: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 8,
  },
  zoneText: {
    flex: 1,
  },
  zoneTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
