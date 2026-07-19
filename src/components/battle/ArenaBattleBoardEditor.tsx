import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { ArenaBattleSlot, ArenaBattleSlotType, arenaBattleSlotTypes, getArenaSlotLabel } from "../../services/arenaBattleBoardService";
import { ArenaSpot } from "../../services/arenaService";
import { resolveGameAssetUri } from "../../utils/assetResolver";
import { colors, fonts } from "../theme";

type ArenaBattleBoardEditorProps = {
  arena: ArenaSpot | null;
  backgroundImageUrl: string | null;
  slots: ArenaBattleSlot[];
  onSave: (slot: Partial<ArenaBattleSlot> & { arena_id: string }) => Promise<void>;
  onDelete: (slotId: string) => Promise<void>;
  onMessage: (message: string) => void;
};

export function ArenaBattleBoardEditor({
  arena,
  backgroundImageUrl,
  slots,
  onSave,
  onDelete,
  onMessage,
}: ArenaBattleBoardEditorProps) {
  const [editing, setEditing] = useState<ArenaBattleSlot | null>(null);
  const [slotType, setSlotType] = useState<ArenaBattleSlotType>("holder_start");
  const [label, setLabel] = useState("");
  const [xPercent, setXPercent] = useState("70");
  const [yPercent, setYPercent] = useState("30");
  const [sizePercent, setSizePercent] = useState("16");
  const [sortOrder, setSortOrder] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const backgroundUri = resolveBattlefieldImageUri(backgroundImageUrl);

  useEffect(() => {
    if (!editing) {
      return;
    }

    setSlotType(editing.slot_type);
    setLabel(editing.label ?? "");
    setXPercent(String(editing.x_percent));
    setYPercent(String(editing.y_percent));
    setSizePercent(String(editing.size_percent));
    setSortOrder(String(editing.sort_order));
    setIsActive(editing.is_active);
  }, [editing]);

  if (!arena) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Arena Battle Board</Text>
        <Text style={styles.copy}>Create or save this Arena marker first, then place the challenger and holder on its battleground.</Text>
      </View>
    );
  }

  function handleBoardPress(event: any) {
    const native = event?.nativeEvent ?? {};
    let nextX = Number(native.locationX ?? NaN);
    let nextY = Number(native.locationY ?? NaN);
    let width = Number(native.target?.clientWidth ?? native.layout?.width ?? NaN);
    let height = Number(native.target?.clientHeight ?? native.layout?.height ?? NaN);

    const rect = event?.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      nextX = Number(native.clientX ?? event.clientX ?? 0) - rect.left;
      nextY = Number(native.clientY ?? event.clientY ?? 0) - rect.top;
      width = rect.width;
      height = rect.height;
    }

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      onMessage("Unable to read arena board size. Try tapping the image again.");
      return;
    }

    setXPercent(formatPercent((nextX / width) * 100));
    setYPercent(formatPercent((nextY / height) * 100));
  }

  function clearForm() {
    setEditing(null);
    setSlotType("holder_start");
    setLabel("");
    setXPercent("70");
    setYPercent("30");
    setSizePercent("16");
    setSortOrder(String(Math.max(1, slots.length + 1)));
    setIsActive(true);
  }

  async function saveCurrent() {
    await onSave({
      id: editing?.id,
      arena_id: arena!.id,
      slot_type: slotType,
      label: label.trim() || getArenaSlotLabel(slotType),
      x_percent: Number(xPercent) || 0,
      y_percent: Number(yPercent) || 0,
      size_percent: Number(sizePercent) || 16,
      sort_order: Number(sortOrder) || 1,
      is_active: isActive,
    });
    clearForm();
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Arena Battle Board</Text>
          <Text style={styles.copy}>Tap the arena image to place the challenger and holder. These slots only affect Arena challenges.</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={clearForm}>
          <Text style={styles.buttonText}>New</Text>
        </Pressable>
      </View>

      <Pressable style={styles.board} onPress={handleBoardPress}>
        {backgroundUri ? <Image source={{ uri: backgroundUri }} style={styles.boardImage} /> : <View style={styles.emptyBoard}><Text style={styles.copy}>Add a marker scene background image to preview the arena board.</Text></View>}
        {slots.map((slot) => (
          <Pressable
            key={slot.id}
            style={[
              styles.slotPin,
              slot.slot_type === "challenger_start" && styles.challengerPin,
              !slot.is_active && styles.inactivePin,
              {
                left: `${slot.x_percent}%`,
                top: `${slot.y_percent}%`,
                width: `${slot.size_percent}%`,
                aspectRatio: 1,
                transform: [{ translateX: -12 }, { translateY: -12 }],
              } as object,
            ]}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation?.();
              setEditing(slot);
            }}
          >
            <Text style={styles.pinText}>{slot.slot_type === "challenger_start" ? "C" : "H"}</Text>
          </Pressable>
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.ghostPin,
            slotType === "challenger_start" && styles.challengerPin,
            {
              left: `${Number(xPercent) || 0}%`,
              top: `${Number(yPercent) || 0}%`,
              width: `${Number(sizePercent) || 16}%`,
              aspectRatio: 1,
              transform: [{ translateX: -12 }, { translateY: -12 }],
            } as object,
          ]}
        >
          <Text style={styles.pinText}>+</Text>
        </View>
      </Pressable>

      <Text style={styles.debugLine}>Placement: x {xPercent}% / y {yPercent}% / size {sizePercent}%</Text>
      <View style={styles.chipRow}>
        {arenaBattleSlotTypes.map((type) => (
          <Pressable key={type.key} style={[styles.chip, slotType === type.key && styles.chipActive]} onPress={() => setSlotType(type.key)}>
            <Text style={styles.chipText}>{type.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={label} onChangeText={setLabel} placeholder="Label override optional" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.gridRow}>
        <TextInput value={xPercent} onChangeText={setXPercent} placeholder="X %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
        <TextInput value={yPercent} onChangeText={setYPercent} placeholder="Y %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
      </View>
      <View style={styles.gridRow}>
        <TextInput value={sizePercent} onChangeText={setSizePercent} placeholder="Size %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
        <TextInput value={sortOrder} onChangeText={setSortOrder} placeholder="Order" placeholderTextColor={colors.muted} style={styles.inputFlex} />
      </View>
      <Pressable style={[styles.toggle, isActive && styles.toggleActive]} onPress={() => setIsActive((value) => !value)}>
        <Text style={styles.buttonText}>Active: {isActive ? "Yes" : "No"}</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={() => void saveCurrent()}>
        <Text style={styles.primaryText}>{editing ? "Update Arena Slot" : "Add Arena Slot"}</Text>
      </Pressable>

      {slots.map((slot) => (
        <View key={`row-${slot.id}`} style={styles.rowCard}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{slot.label || getArenaSlotLabel(slot.slot_type)}</Text>
            <Text style={styles.copy}>{getArenaSlotLabel(slot.slot_type)} / x {slot.x_percent}% / y {slot.y_percent}% / size {slot.size_percent}%</Text>
          </View>
          <View style={styles.rowActions}>
            <Pressable style={styles.smallButton} onPress={() => setEditing(slot)}>
              <Text style={styles.buttonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => void onDelete(slot.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function resolveBattlefieldImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "scene");
}

function formatPercent(value: number) {
  return String(Math.max(0, Math.min(100, value)).toFixed(2));
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  copy: {
    color: colors.muted,
    lineHeight: 19,
  },
  board: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(5,8,8,0.78)",
  },
  boardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  emptyBoard: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  slotPin: {
    position: "absolute",
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.red,
    backgroundColor: "rgba(40,8,8,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  challengerPin: {
    borderColor: colors.blue,
    backgroundColor: "rgba(5,31,52,0.78)",
  },
  inactivePin: {
    opacity: 0.45,
  },
  ghostPin: {
    position: "absolute",
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 11,
  },
  debugLine: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(0,160,240,0.22)",
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputFlex: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  toggle: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  toggleActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(0,160,240,0.22)",
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  primaryButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#0d0904",
    fontWeight: "900",
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  rowCopy: {
    gap: 3,
  },
  rowTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteText: {
    color: colors.red,
    fontWeight: "900",
  },
});
