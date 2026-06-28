import { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ItemPicker } from "../map/MarkerEditorControls";
import { colors } from "../theme";
import type { ItemDefinition } from "../../services/inventoryService";
import type { MapMarker } from "../../services/mapService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

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
  linkedBattleBuilder: ReactNode;
  onChangeRewardXp: (value: string) => void;
  onChangeRewardGold: (value: string) => void;
  onChangeRewardItemId: (value: string | null) => void;
  onChangeRewardItemQuantity: (value: string) => void;
  onChangeLegacyRewardItem: (value: string) => void;
  onChangeUnlockMarkerId: (value: string | null) => void;
  onChangeUpdateTitle: (value: string) => void;
  onChangeUpdateBody: (value: string) => void;
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
  linkedBattleBuilder,
  onChangeRewardXp,
  onChangeRewardGold,
  onChangeRewardItemId,
  onChangeRewardItemQuantity,
  onChangeLegacyRewardItem,
  onChangeUnlockMarkerId,
  onChangeUpdateTitle,
  onChangeUpdateBody,
}: Props) {
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
      </>
    );
  }

  if (action !== "give_reward") {
    return (
      <MarkerUnlockEditor
        markers={markers}
        selectedId={unlockMarkerId}
        updateTitle={updateTitle}
        updateBody={updateBody}
        onSelect={onChangeUnlockMarkerId}
        onChangeUpdateTitle={onChangeUpdateTitle}
        onChangeUpdateBody={onChangeUpdateBody}
      />
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
    </>
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
