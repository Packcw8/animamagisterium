import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { EnemyDefinition, NpcDefinition, resolveEnemyImageUri } from "../../services/combatAdminService";
import { BattleEventCombatant, MarkerBattleCombatant } from "../../services/battlefieldService";
import { colors, fonts } from "../theme";
import { EnemyPicker, NpcPicker } from "../map/MarkerEditorControls";

type BattlefieldLayoutEditorProps = {
  eventId: string | null;
  title?: string;
  emptyText?: string;
  backgroundImageUrl: string | null;
  combatants: Array<BattleEventCombatant | MarkerBattleCombatant>;
  enemies: EnemyDefinition[];
  npcs: NpcDefinition[];
  onSave: (combatant: Partial<BattleEventCombatant> & { event_id: string }) => Promise<void>;
  onDelete: (combatantId: string) => Promise<void>;
  onMessage: (message: string) => void;
};

const sides: BattleEventCombatant["side"][] = ["enemy", "companion", "player", "player_summon", "enemy_summon"];

export function BattlefieldLayoutEditor({
  eventId,
  title = "Battlefield Layout",
  emptyText = "Save this battle event first, then place enemies, bosses, companions, or player start markers on the battle image.",
  backgroundImageUrl,
  combatants,
  enemies,
  npcs,
  onSave,
  onDelete,
  onMessage,
}: BattlefieldLayoutEditorProps) {
  const [editing, setEditing] = useState<BattleEventCombatant | MarkerBattleCombatant | null>(null);
  const [side, setSide] = useState<BattleEventCombatant["side"]>("enemy");
  const [enemyId, setEnemyId] = useState<string | null>(null);
  const [npcId, setNpcId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [xPercent, setXPercent] = useState("75");
  const [yPercent, setYPercent] = useState("30");
  const [sizePercent, setSizePercent] = useState("14");
  const [sortOrder, setSortOrder] = useState("1");
  const [isBoss, setIsBoss] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const backgroundUri = resolveBattlefieldImageUri(backgroundImageUrl);

  useEffect(() => {
    if (!editing) {
      return;
    }

    setSide(editing.side);
    setEnemyId(editing.enemy_id);
    setNpcId(editing.npc_id);
    setLabel(editing.label ?? "");
    setXPercent(String(editing.x_percent));
    setYPercent(String(editing.y_percent));
    setSizePercent(String(editing.size_percent));
    setSortOrder(String(editing.sort_order));
    setIsBoss(editing.is_boss);
    setIsActive(editing.is_active);
  }, [editing]);

  const selectedName = useMemo(() => {
    if (enemyId) {
      return enemies.find((enemy) => enemy.id === enemyId)?.name ?? "Enemy";
    }

    if (npcId) {
      return npcs.find((npc) => npc.id === npcId)?.name ?? "NPC";
    }

    return label.trim() || getSideLabel(side);
  }, [enemyId, enemies, label, npcId, npcs, side]);

  if (!eventId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{emptyText}</Text>
      </View>
    );
  }

  function handleBattlefieldPress(event: any) {
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
      onMessage("Unable to read battlefield size. Try tapping the image again.");
      return;
    }

    setXPercent(formatPercent((nextX / width) * 100));
    setYPercent(formatPercent((nextY / height) * 100));
  }

  function clearForm() {
    setEditing(null);
    setSide("enemy");
    setEnemyId(null);
    setNpcId(null);
    setLabel("");
    setXPercent("75");
    setYPercent("30");
    setSizePercent("14");
    setSortOrder(String(Math.max(1, combatants.length + 1)));
    setIsBoss(false);
    setIsActive(true);
  }

  async function saveCurrent() {
    if (side === "enemy" && !enemyId && !npcId && !label.trim()) {
      onMessage("Choose an enemy, NPC, or label for this battlefield marker.");
      return;
    }

    await onSave({
      id: editing?.id,
      event_id: eventId!,
      side,
      enemy_id: enemyId,
      npc_id: npcId,
      label: label.trim() || selectedName,
      x_percent: Number(xPercent) || 0,
      y_percent: Number(yPercent) || 0,
      size_percent: Number(sizePercent) || 14,
      sort_order: Number(sortOrder) || 1,
      is_boss: isBoss,
      is_active: isActive,
    });
    clearForm();
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>Tap the battleground image to place actors by percentage coordinates.</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={clearForm}>
          <Text style={styles.buttonText}>New</Text>
        </Pressable>
      </View>

      <Pressable style={styles.battlefield} onPress={handleBattlefieldPress}>
        {backgroundUri ? <Image source={{ uri: backgroundUri }} style={styles.battlefieldImage} /> : <View style={styles.emptyBattlefield}><Text style={styles.copy}>Add a battleground image above for placement preview.</Text></View>}
        {combatants.map((combatant) => (
          <Pressable
            key={combatant.id}
            style={[
              styles.combatantPin,
              combatant.side === "player" && styles.playerPin,
              combatant.side === "companion" && styles.companionPin,
              combatant.side === "player_summon" && styles.playerSummonPin,
              combatant.side === "enemy_summon" && styles.enemySummonPin,
              combatant.is_boss && styles.bossPin,
              {
                left: `${combatant.x_percent}%`,
                top: `${combatant.y_percent}%`,
                width: `${combatant.size_percent}%`,
                aspectRatio: 1,
                transform: [{ translateX: -12 }, { translateY: -12 }],
              } as object,
            ]}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation?.();
              setEditing(combatant);
            }}
          >
            <Text style={styles.combatantPinText}>{getCombatantInitial(combatant, enemies, npcs)}</Text>
          </Pressable>
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.ghostPin,
            {
              left: `${Number(xPercent) || 0}%`,
              top: `${Number(yPercent) || 0}%`,
              width: `${Number(sizePercent) || 14}%`,
              aspectRatio: 1,
              transform: [{ translateX: -12 }, { translateY: -12 }],
            } as object,
          ]}
        >
          <Text style={styles.ghostPinText}>+</Text>
        </View>
      </Pressable>

      <Text style={styles.debugLine}>Placement: x {xPercent}% / y {yPercent}% / size {sizePercent}%</Text>
      <View style={styles.chipRow}>
        {sides.map((option) => (
          <Pressable key={option} style={[styles.chip, side === option && styles.chipActive]} onPress={() => setSide(option)}>
            <Text style={styles.chipText}>{getSideLabel(option)}</Text>
          </Pressable>
        ))}
      </View>

      <EnemyPicker enemies={enemies} selectedId={enemyId} onSelect={(id) => { setEnemyId(id); if (id) setNpcId(null); }} />
      <NpcPicker label="Or choose an NPC combatant" npcs={npcs} selectedId={npcId} onSelect={(id) => { setNpcId(id); if (id) setEnemyId(null); }} battleOnly />
      <TextInput value={label} onChangeText={setLabel} placeholder="Label override optional" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.gridRow}>
        <TextInput value={xPercent} onChangeText={setXPercent} placeholder="X %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
        <TextInput value={yPercent} onChangeText={setYPercent} placeholder="Y %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
      </View>
      <View style={styles.gridRow}>
        <TextInput value={sizePercent} onChangeText={setSizePercent} placeholder="Size %" placeholderTextColor={colors.muted} style={styles.inputFlex} />
        <TextInput value={sortOrder} onChangeText={setSortOrder} placeholder="Turn order" placeholderTextColor={colors.muted} style={styles.inputFlex} />
      </View>
      <View style={styles.gridRow}>
        <Pressable style={[styles.toggle, isBoss && styles.toggleActive]} onPress={() => setIsBoss((current) => !current)}>
          <Text style={styles.buttonText}>Boss: {isBoss ? "Yes" : "No"}</Text>
        </Pressable>
        <Pressable style={[styles.toggle, isActive && styles.toggleActive]} onPress={() => setIsActive((current) => !current)}>
          <Text style={styles.buttonText}>Active: {isActive ? "Yes" : "No"}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.primaryButton} onPress={() => void saveCurrent()}>
        <Text style={styles.primaryText}>{editing ? "Update Combatant" : "Add Combatant"}</Text>
      </Pressable>

      {combatants.map((combatant) => (
        <View key={`row-${combatant.id}`} style={styles.rowCard}>
          <View>
            <Text style={styles.rowTitle}>{getCombatantName(combatant, enemies, npcs)}</Text>
            <Text style={styles.copy}>{getSideLabel(combatant.side)} / x {combatant.x_percent}% / y {combatant.y_percent}% / size {combatant.size_percent}%</Text>
          </View>
          <View style={styles.rowActions}>
            <Pressable style={styles.smallButton} onPress={() => setEditing(combatant)}>
              <Text style={styles.buttonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => void onDelete(combatant.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

type AnyBattlefieldCombatant = BattleEventCombatant | MarkerBattleCombatant;

export function getCombatantName(combatant: AnyBattlefieldCombatant, enemies: EnemyDefinition[], npcs: NpcDefinition[]) {
  if (combatant.enemy_id) {
    return enemies.find((enemy) => enemy.id === combatant.enemy_id)?.name ?? combatant.label ?? "Enemy";
  }

  if (combatant.npc_id) {
    return npcs.find((npc) => npc.id === combatant.npc_id)?.name ?? combatant.label ?? "NPC";
  }

  return combatant.label || getSideLabel(combatant.side);
}

export function getCombatantImage(combatant: AnyBattlefieldCombatant, enemies: EnemyDefinition[], npcs: NpcDefinition[]) {
  const imagePath = combatant.enemy_id
    ? enemies.find((enemy) => enemy.id === combatant.enemy_id)?.image_url
    : combatant.npc_id
      ? npcs.find((npc) => npc.id === combatant.npc_id)?.image_url
      : null;

  return resolveEnemyImageUri(imagePath);
}

function getCombatantInitial(combatant: AnyBattlefieldCombatant, enemies: EnemyDefinition[], npcs: NpcDefinition[]) {
  if (combatant.side === "player_summon") {
    return "S+";
  }

  if (combatant.side === "enemy_summon") {
    return "E+";
  }

  return getCombatantName(combatant, enemies, npcs).slice(0, 1).toUpperCase();
}

function getSideLabel(side: BattleEventCombatant["side"]) {
  switch (side) {
    case "player":
      return "Player Start";
    case "companion":
      return "Companion";
    case "player_summon":
      return "Player Summon Slot";
    case "enemy_summon":
      return "Enemy Summon Slot";
    default:
      return "Enemy";
  }
}

function resolveBattlefieldImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed.replaceAll("\\", "/")}`;
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
  battlefield: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(5,8,8,0.78)",
  },
  battlefieldImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  emptyBattlefield: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  combatantPin: {
    position: "absolute",
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.red,
    backgroundColor: "rgba(40,8,8,0.76)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerPin: {
    borderColor: colors.blue,
    backgroundColor: "rgba(5,31,52,0.78)",
  },
  companionPin: {
    borderColor: colors.gold,
    backgroundColor: "rgba(56,37,10,0.78)",
  },
  playerSummonPin: {
    borderColor: colors.blue,
    borderStyle: "dashed",
    backgroundColor: "rgba(54,171,224,0.14)",
  },
  enemySummonPin: {
    borderColor: "#ff9b66",
    borderStyle: "dashed",
    backgroundColor: "rgba(80,22,10,0.24)",
  },
  bossPin: {
    borderWidth: 3,
    shadowColor: colors.red,
    shadowOpacity: 0.75,
    shadowRadius: 12,
  },
  combatantPinText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 11,
  },
  ghostPin: {
    position: "absolute",
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostPinText: {
    color: colors.blue,
    fontWeight: "900",
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
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.24)",
  },
  chipText: {
    color: colors.text,
    fontWeight: "900",
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputFlex: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
  },
  toggle: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.22)",
  },
  smallButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#100d08",
    fontWeight: "900",
  },
  rowCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    gap: 8,
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
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffb4aa",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
});
