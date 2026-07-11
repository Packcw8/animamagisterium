import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { ExitTargetEditor, ItemPicker } from "../map/MarkerEditorControls";
import { colors } from "../theme";
import type { ItemDefinition } from "../../services/inventoryService";
import type { MapMarker, MiniMap } from "../../services/mapService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";
import { StoryFlagPicker } from "./StoryFlagPicker";

type Props = {
  action: string;
  rewardXp: string;
  rewardGold: string;
  rewardItemId: string | null;
  rewardItemQuantity: string;
  legacyRewardItem: string;
  itemDefinitions: ItemDefinition[];
  markers: MapMarker[];
  unlockMarkerId: string | null;
  updateTitle: string;
  updateBody: string;
  restoreHealth: boolean;
  restoreStamina: boolean;
  restoreMana: boolean;
  storyFlagKey: string;
  storyFlagValue: boolean;
  storyFlagKeys: string[];
  travelTargetType: MapMarker["exit_target_type"];
  travelTargetMarkerId: string | null;
  travelTargetMiniMapId: string | null;
  travelTargetSpawnMarkerId: string | null;
  miniMaps: MiniMap[];
  linkedBattleBuilder: ReactNode;
  onChangeRewardXp: (value: string) => void;
  onChangeRewardGold: (value: string) => void;
  onChangeRewardItemId: (value: string | null) => void;
  onChangeRewardItemQuantity: (value: string) => void;
  onChangeLegacyRewardItem: (value: string) => void;
  onChangeUnlockMarkerId: (value: string | null) => void;
  onChangeUpdateTitle: (value: string) => void;
  onChangeUpdateBody: (value: string) => void;
  onToggleRestoreHealth: () => void;
  onToggleRestoreStamina: () => void;
  onToggleRestoreMana: () => void;
  onChangeStoryFlagKey: (value: string) => void;
  onToggleStoryFlagValue: () => void;
  onChangeTravelTargetType: (value: MapMarker["exit_target_type"]) => void;
  onChangeTravelTargetMarkerId: (value: string | null) => void;
  onChangeTravelTargetMiniMapId: (value: string | null) => void;
  onChangeTravelTargetSpawnMarkerId: (value: string | null) => void;
};

export function DialogueChoiceEffectEditor({
  action,
  rewardXp,
  rewardGold,
  rewardItemId,
  rewardItemQuantity,
  legacyRewardItem,
  itemDefinitions,
  markers,
  unlockMarkerId,
  updateTitle,
  updateBody,
  restoreHealth,
  restoreStamina,
  restoreMana,
  storyFlagKey,
  storyFlagValue,
  storyFlagKeys,
  travelTargetType,
  travelTargetMarkerId,
  travelTargetMiniMapId,
  travelTargetSpawnMarkerId,
  miniMaps,
  linkedBattleBuilder,
  onChangeRewardXp,
  onChangeRewardGold,
  onChangeRewardItemId,
  onChangeRewardItemQuantity,
  onChangeLegacyRewardItem,
  onChangeUnlockMarkerId,
  onChangeUpdateTitle,
  onChangeUpdateBody,
  onToggleRestoreHealth,
  onToggleRestoreStamina,
  onToggleRestoreMana,
  onChangeStoryFlagKey,
  onToggleStoryFlagValue,
  onChangeTravelTargetType,
  onChangeTravelTargetMarkerId,
  onChangeTravelTargetMiniMapId,
  onChangeTravelTargetSpawnMarkerId,
}: Props) {
  const storyFlagEditor = <StoryFlagEffectEditor storyFlagKey={storyFlagKey} storyFlagValue={storyFlagValue} storyFlagKeys={storyFlagKeys} onChangeStoryFlagKey={onChangeStoryFlagKey} onToggleStoryFlagValue={onToggleStoryFlagValue} />;

  if (action === "travel_to_marker") {
    return (
      <>
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Travel Target</Text>
          <Text style={styles.copy}>Move the player after this choice. Use this for Point of Interest doors, secret passages, shrines, and area transitions.</Text>
          <ExitTargetEditor
            targetType={travelTargetType}
            setTargetType={onChangeTravelTargetType}
            targetMarkerId={travelTargetMarkerId}
            setTargetMarkerId={onChangeTravelTargetMarkerId}
            targetMiniMapId={travelTargetMiniMapId}
            setTargetMiniMapId={onChangeTravelTargetMiniMapId}
            targetSpawnMarkerId={travelTargetSpawnMarkerId}
            setTargetSpawnMarkerId={onChangeTravelTargetSpawnMarkerId}
            worldMarkers={markers.filter((marker) => !marker.mini_map_id)}
            miniMaps={miniMaps}
            spawnMarkers={markers}
          />
        </View>
        <MarkerUnlockEditor
          markers={markers}
          selectedId={unlockMarkerId}
          updateTitle={updateTitle}
          updateBody={updateBody}
          onSelect={onChangeUnlockMarkerId}
          onChangeUpdateTitle={onChangeUpdateTitle}
          onChangeUpdateBody={onChangeUpdateBody}
        />
        {storyFlagEditor}
      </>
    );
  }

  if (action === "start_battle") {
    return (
      <>
        {linkedBattleBuilder}
        <MarkerUnlockEditor
          markers={markers}
          selectedId={unlockMarkerId}
          updateTitle={updateTitle}
          updateBody={updateBody}
          onSelect={onChangeUnlockMarkerId}
          onChangeUpdateTitle={onChangeUpdateTitle}
          onChangeUpdateBody={onChangeUpdateBody}
        />
        <ResourceRestoreEditor restoreHealth={restoreHealth} restoreStamina={restoreStamina} restoreMana={restoreMana} onToggleRestoreHealth={onToggleRestoreHealth} onToggleRestoreStamina={onToggleRestoreStamina} onToggleRestoreMana={onToggleRestoreMana} />
        {storyFlagEditor}
      </>
    );
  }

  if (action !== "give_reward") {
    return (
      <>
        <MarkerUnlockEditor
          markers={markers}
          selectedId={unlockMarkerId}
          updateTitle={updateTitle}
          updateBody={updateBody}
          onSelect={onChangeUnlockMarkerId}
          onChangeUpdateTitle={onChangeUpdateTitle}
          onChangeUpdateBody={onChangeUpdateBody}
        />
        <ResourceRestoreEditor restoreHealth={restoreHealth} restoreStamina={restoreStamina} restoreMana={restoreMana} onToggleRestoreHealth={onToggleRestoreHealth} onToggleRestoreStamina={onToggleRestoreStamina} onToggleRestoreMana={onToggleRestoreMana} />
        {storyFlagEditor}
      </>
    );
  }

  return (
    <>
      <View style={styles.storyEditor}>
        <Text style={styles.selectedTitle}>Choice Effects</Text>
        <Text style={styles.copy}>Current effect support: give XP, gold, and an item. Multi-effect consequences can layer onto this component next.</Text>
        <TextInput value={rewardXp} onChangeText={onChangeRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={rewardGold} onChangeText={onChangeRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
        <ItemPicker label="Reward item" items={itemDefinitions} selectedId={rewardItemId} onSelect={onChangeRewardItemId} />
        <TextInput value={rewardItemQuantity} onChangeText={onChangeRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={legacyRewardItem} onChangeText={onChangeLegacyRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
      </View>
      <MarkerUnlockEditor
        markers={markers}
        selectedId={unlockMarkerId}
        updateTitle={updateTitle}
        updateBody={updateBody}
        onSelect={onChangeUnlockMarkerId}
        onChangeUpdateTitle={onChangeUpdateTitle}
        onChangeUpdateBody={onChangeUpdateBody}
      />
      <ResourceRestoreEditor restoreHealth={restoreHealth} restoreStamina={restoreStamina} restoreMana={restoreMana} onToggleRestoreHealth={onToggleRestoreHealth} onToggleRestoreStamina={onToggleRestoreStamina} onToggleRestoreMana={onToggleRestoreMana} />
      {storyFlagEditor}
    </>
  );
}

function StoryFlagEffectEditor({
  storyFlagKey,
  storyFlagValue,
  storyFlagKeys,
  onChangeStoryFlagKey,
  onToggleStoryFlagValue,
}: {
  storyFlagKey: string;
  storyFlagValue: boolean;
  storyFlagKeys: string[];
  onChangeStoryFlagKey: (value: string) => void;
  onToggleStoryFlagValue: () => void;
}) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Story Flag</Text>
      <Text style={styles.copy}>Set a per-player story flag after this choice. Later choices can require this flag.</Text>
      <StoryFlagPicker flags={storyFlagKeys} selectedKey={storyFlagKey} onSelect={onChangeStoryFlagKey} />
      <TextInput value={storyFlagKey} onChangeText={onChangeStoryFlagKey} placeholder="Flag key, example sided_with_elara" placeholderTextColor={colors.muted} style={styles.input} />
      {storyFlagKey.trim() ? (
        <Pressable style={[styles.secondaryButton, storyFlagValue && styles.typeSelected]} onPress={onToggleStoryFlagValue}>
          <Text style={styles.secondaryText}>Set Flag Value: {storyFlagValue ? "True" : "False"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ResourceRestoreEditor({
  restoreHealth,
  restoreStamina,
  restoreMana,
  onToggleRestoreHealth,
  onToggleRestoreStamina,
  onToggleRestoreMana,
}: {
  restoreHealth: boolean;
  restoreStamina: boolean;
  restoreMana: boolean;
  onToggleRestoreHealth: () => void;
  onToggleRestoreStamina: () => void;
  onToggleRestoreMana: () => void;
}) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Rest / Recovery</Text>
      <Text style={styles.copy}>Use this for innkeepers, campfires, healers, and rest dialogue choices.</Text>
      <View style={styles.modeRow}>
        <Pressable style={[styles.secondaryButtonFlex, restoreHealth && styles.typeSelected]} onPress={onToggleRestoreHealth}>
          <Text style={styles.secondaryText}>Health: {restoreHealth ? "Full" : "No"}</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButtonFlex, restoreStamina && styles.typeSelected]} onPress={onToggleRestoreStamina}>
          <Text style={styles.secondaryText}>Stamina: {restoreStamina ? "Full" : "No"}</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButtonFlex, restoreMana && styles.typeSelected]} onPress={onToggleRestoreMana}>
          <Text style={styles.secondaryText}>Mana: {restoreMana ? "Full" : "No"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MarkerUnlockEditor({
  markers,
  selectedId,
  updateTitle,
  updateBody,
  onSelect,
  onChangeUpdateTitle,
  onChangeUpdateBody,
}: {
  markers: MapMarker[];
  selectedId: string | null;
  updateTitle: string;
  updateBody: string;
  onSelect: (value: string | null) => void;
  onChangeUpdateTitle: (value: string) => void;
  onChangeUpdateBody: (value: string) => void;
}) {
  const selectableMarkers = markers
    .filter((marker) => !["Player Spawn", "World Spawn"].includes(marker.type))
    .sort((a, b) => `${a.story_order}-${a.title}`.localeCompare(`${b.story_order}-${b.title}`));

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Map Update</Text>
      <Text style={styles.copy}>Optionally reveal a hidden quest/story marker for this player after this choice succeeds.</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, !selectedId && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {selectableMarkers.map((marker) => (
          <Pressable key={marker.id} style={[styles.routeChip, selectedId === marker.id && styles.routeChipActive]} onPress={() => onSelect(marker.id)}>
            <Text style={styles.routeChipText}>{marker.story_order ? `${marker.story_order}. ` : ""}{marker.title}</Text>
            <Text style={styles.debugLine}>{marker.type}{marker.mini_map_id ? " / Mini Map" : " / World"}</Text>
          </Pressable>
        ))}
      </View>
      {selectedId ? (
        <>
          <TextInput value={updateTitle} onChangeText={onChangeUpdateTitle} placeholder="Toast title, example Quest Updated" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={updateBody} onChangeText={onChangeUpdateBody} placeholder="Toast message shown to the player" placeholderTextColor={colors.muted} style={styles.input} />
        </>
      ) : null}
    </View>
  );
}
