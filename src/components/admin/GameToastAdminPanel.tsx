import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "./AdminImageUploadButton";
import { colors, fonts } from "../theme";
import {
  blankGameToastDefinition,
  deleteGameToast,
  gameToastTriggerTypes,
  getGameToasts,
  resolveToastAssetUri,
  saveGameToast,
  type GameToastDefinition,
  type GameToastTriggerType,
} from "../../services/gameToastService";

type GameToastDraft = ReturnType<typeof blankGameToastDefinition> & { id?: string };

export function GameToastAdminPanel() {
  const [toasts, setToasts] = useState<GameToastDefinition[]>([]);
  const [draft, setDraft] = useState<GameToastDraft>(blankGameToastDefinition());
  const [selectedTrigger, setSelectedTrigger] = useState<GameToastTriggerType>("entering_area");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredToasts = useMemo(
    () => toasts.filter((toast) => toast.trigger_type === selectedTrigger),
    [selectedTrigger, toasts],
  );
  const previewImage = resolveToastAssetUri(draft.icon_image_url);

  useEffect(() => {
    void loadToasts();
  }, []);

  async function loadToasts() {
    setLoading(true);
    try {
      setToasts(await getGameToasts());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load authored toasts.");
    } finally {
      setLoading(false);
    }
  }

  function editToast(toast: GameToastDefinition) {
    setSelectedTrigger(toast.trigger_type);
    setDraft({
      id: toast.id,
      trigger_type: toast.trigger_type,
      trigger_key: toast.trigger_key,
      title: toast.title,
      body: toast.body,
      icon_image_url: toast.icon_image_url,
      sound_url: toast.sound_url,
      button_text: toast.button_text,
      display_once: toast.display_once,
      trigger_condition: toast.trigger_condition,
      sort_order: toast.sort_order,
      season_number: toast.season_number,
      chapter_number: toast.chapter_number,
      is_active: toast.is_active,
    });
  }

  function resetDraft(nextTrigger = selectedTrigger) {
    setDraft({ ...blankGameToastDefinition(), trigger_type: nextTrigger });
  }

  async function saveDraft() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMessage("Toast title and body are required.");
      return;
    }

    try {
      const saved = await saveGameToast(draft);
      setToasts((current) => [saved, ...current.filter((toast) => toast.id !== saved.id)].sort(sortToasts));
      resetDraft(saved.trigger_type);
      setMessage("Toast saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save toast. Confirm the migration has run.");
    }
  }

  async function removeToast(toastId: string) {
    try {
      await deleteGameToast(toastId);
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
      if (draft.id === toastId) {
        resetDraft();
      }
      setMessage("Toast deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete toast.");
    }
  }

  function changeTrigger(trigger: GameToastTriggerType) {
    setSelectedTrigger(trigger);
    setDraft((current) => ({ ...current, trigger_type: trigger }));
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Authored Messages</Text>
          <Text style={styles.title}>Toast Builder</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={() => resetDraft()}>
          <Text style={styles.smallButtonText}>New</Text>
        </Pressable>
      </View>
      <Text style={styles.copy}>Create player-facing messages for area entry, path events, rewards, unlocks, and chapter transitions. Sound URLs should point to Supabase Storage files.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.chips}>
        {gameToastTriggerTypes.map((trigger) => (
          <Pressable key={trigger} style={[styles.chip, selectedTrigger === trigger && styles.activeChip]} onPress={() => changeTrigger(trigger)}>
            <Text style={[styles.chipText, selectedTrigger === trigger && styles.activeChipText]}>{formatTrigger(trigger)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.form}>
        <TextInput value={draft.title} onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={draft.body} onChangeText={(value) => setDraft((current) => ({ ...current, body: value }))} placeholder="Body text" placeholderTextColor={colors.muted} style={[styles.input, styles.textArea]} multiline />
        <TextInput value={draft.trigger_key ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, trigger_key: value }))} placeholder="Trigger key optional, example fresh_start or marker id" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={draft.trigger_condition ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, trigger_condition: value }))} placeholder="Trigger condition notes optional" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={draft.icon_image_url ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, icon_image_url: value }))} placeholder="Icon/image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
        <AdminImageUploadButton folder="toast-images" onUploaded={(url) => setDraft((current) => ({ ...current, icon_image_url: url }))} onMessage={setMessage} />
        {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} /> : null}
        <TextInput value={draft.sound_url ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, sound_url: value }))} placeholder="Sound URL from Supabase bucket optional" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={draft.button_text} onChangeText={(value) => setDraft((current) => ({ ...current, button_text: value }))} placeholder="Button text" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.grid}>
          <TextInput value={String(draft.season_number)} onChangeText={(value) => setDraft((current) => ({ ...current, season_number: Number(value) || 1 }))} placeholder="Season" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={String(draft.chapter_number)} onChangeText={(value) => setDraft((current) => ({ ...current, chapter_number: Number(value) || 1 }))} placeholder="Chapter" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={String(draft.sort_order)} onChangeText={(value) => setDraft((current) => ({ ...current, sort_order: Number(value) || 0 }))} placeholder="Sort" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <View style={styles.toggleRow}>
          <Toggle label={`Display Once: ${draft.display_once ? "Yes" : "No"}`} active={draft.display_once} onPress={() => setDraft((current) => ({ ...current, display_once: !current.display_once }))} />
          <Toggle label={`Active: ${draft.is_active ? "Yes" : "No"}`} active={draft.is_active} onPress={() => setDraft((current) => ({ ...current, is_active: !current.is_active }))} />
        </View>
        <Pressable style={styles.saveButton} onPress={() => void saveDraft()}>
          <Text style={styles.saveButtonText}>{draft.id ? "Save Toast" : "Create Toast"}</Text>
        </Pressable>
      </View>

      <Text style={styles.listTitle}>{loading ? "Loading toasts..." : `${formatTrigger(selectedTrigger)} Toasts`}</Text>
      {filteredToasts.length === 0 ? <Text style={styles.copy}>No authored toasts for this trigger yet.</Text> : null}
      {filteredToasts.map((toast) => (
        <View key={toast.id} style={styles.toastRow}>
          <View style={styles.toastText}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastMeta}>S{toast.season_number} / C{toast.chapter_number} {toast.trigger_key ? `/ ${toast.trigger_key}` : ""}</Text>
          </View>
          <Pressable style={styles.rowButton} onPress={() => editToast(toast)}>
            <Text style={styles.rowButtonText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => void removeToast(toast.id)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatTrigger(trigger: string) {
  return trigger.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function sortToasts(a: GameToastDefinition, b: GameToastDefinition) {
  return Number(a.season_number) - Number(b.season_number)
    || Number(a.chapter_number) - Number(b.chapter_number)
    || a.trigger_type.localeCompare(b.trigger_type)
    || Number(a.sort_order) - Number(b.sort_order);
}

const styles = StyleSheet.create({
  activeChip: {
    backgroundColor: "rgba(0, 174, 255, 0.2)",
    borderColor: colors.blue,
  },
  activeChipText: {
    color: colors.blue,
  },
  chip: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  deleteButton: {
    alignItems: "center",
    borderColor: colors.red,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  deleteButtonText: {
    color: colors.red,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  form: {
    gap: 10,
  },
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  input: {
    flex: 1,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  message: {
    color: colors.blue,
    fontWeight: "900",
  },
  panel: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(5, 8, 8, 0.74)",
    gap: 12,
    padding: 12,
  },
  previewImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  rowButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  saveButtonText: {
    color: colors.bg,
    fontFamily: fonts.title,
  },
  smallButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  textArea: {
    minHeight: 94,
    textAlignVertical: "top",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  toastMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  toastRow: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    color: colors.text,
    fontFamily: fonts.title,
  },
  toggle: {
    flex: 1,
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toggleActive: {
    backgroundColor: "rgba(0, 174, 255, 0.18)",
    borderColor: colors.blue,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleText: {
    color: colors.text,
    fontWeight: "900",
  },
  toggleTextActive: {
    color: colors.blue,
  },
});
