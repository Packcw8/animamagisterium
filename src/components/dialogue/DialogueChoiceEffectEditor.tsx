import { ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { ItemPicker } from "../map/MarkerEditorControls";
import { colors } from "../theme";
import type { ItemDefinition } from "../../services/inventoryService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type Props = {
  action: string;
  rewardXp: string;
  rewardGold: string;
  rewardItemId: string | null;
  rewardItemQuantity: string;
  legacyRewardItem: string;
  itemDefinitions: ItemDefinition[];
  linkedBattleBuilder: ReactNode;
  onChangeRewardXp: (value: string) => void;
  onChangeRewardGold: (value: string) => void;
  onChangeRewardItemId: (value: string | null) => void;
  onChangeRewardItemQuantity: (value: string) => void;
  onChangeLegacyRewardItem: (value: string) => void;
};

export function DialogueChoiceEffectEditor({
  action,
  rewardXp,
  rewardGold,
  rewardItemId,
  rewardItemQuantity,
  legacyRewardItem,
  itemDefinitions,
  linkedBattleBuilder,
  onChangeRewardXp,
  onChangeRewardGold,
  onChangeRewardItemId,
  onChangeRewardItemQuantity,
  onChangeLegacyRewardItem,
}: Props) {
  if (action === "start_battle") {
    return <>{linkedBattleBuilder}</>;
  }

  if (action !== "give_reward") {
    return null;
  }

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Choice Effects</Text>
      <Text style={styles.copy}>Current effect support: give XP, gold, and an item. Multi-effect consequences can layer onto this component next.</Text>
      <TextInput value={rewardXp} onChangeText={onChangeRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={rewardGold} onChangeText={onChangeRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
      <ItemPicker label="Reward item" items={itemDefinitions} selectedId={rewardItemId} onSelect={onChangeRewardItemId} />
      <TextInput value={rewardItemQuantity} onChangeText={onChangeRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={legacyRewardItem} onChangeText={onChangeLegacyRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}
