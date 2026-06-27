import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { resolveEnemyImageUri, type NpcDefinition } from "../../services/combatAdminService";
import { resolveInventoryImageUri, type ItemDefinition } from "../../services/inventoryService";
import type { DialogueChoiceReward, MapEvent, StoryDialogueChoice, StoryDialogueNode } from "../../services/mapService";
import { getAttributeCheckSummary, getDialogueSceneState, type DialogueChoiceAvailability } from "../../utils/dialogueFlow";

type DialogueSceneScreenProps = {
  event: MapEvent;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  npcs: NpcDefinition[];
  activeNodeId: string | null;
  dialogueLog: string[];
  previewMode?: boolean;
  onLegacyChoice: (action: MapEvent["choices"][number]["action"]) => void;
  onChoice: (choice: StoryDialogueChoice) => void;
  onEndChat: (completeEvent: boolean) => void;
  onExitPreview?: () => void;
  choiceAvailability?: Record<string, DialogueChoiceAvailability>;
  choiceRewards?: DialogueChoiceReward[];
  itemDefinitions?: ItemDefinition[];
  pendingRewardChoice?: StoryDialogueChoice | null;
  onClaimPendingReward?: (choice: StoryDialogueChoice) => void;
};

export function DialogueSceneScreen({
  event,
  nodes,
  choices,
  npcs,
  activeNodeId,
  dialogueLog,
  previewMode = false,
  onLegacyChoice,
  onChoice,
  onEndChat,
  onExitPreview,
  choiceAvailability = {},
  choiceRewards = [],
  itemDefinitions = [],
  pendingRewardChoice = null,
  onClaimPendingReward,
}: DialogueSceneScreenProps) {
  const { activeNode, nodeChoices, legacyChoices, npcName, npcPortrait, backgroundImageUrl, dialogueText } =
    getDialogueSceneState({ event, nodes, choices, npcs, activeNodeId });
  const visibleNodeChoices = nodeChoices.filter((choice) => {
    const availability = choiceAvailability[choice.id] ?? { met: true, hidden: false, disabled: false, message: null };
    return !availability.hidden;
  });
  const pendingRewardPreview = pendingRewardChoice
    ? getChoiceRewardPreview(pendingRewardChoice, choiceRewards, itemDefinitions)
    : [];

  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        {previewMode ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>Admin Preview - no rewards or progress will be saved.</Text>
            <Pressable style={styles.previewExitButton} onPress={onExitPreview}>
              <Text style={styles.secondaryText}>Exit Preview</Text>
            </Pressable>
          </View>
        ) : null}
        {backgroundImageUrl ? (
          <Image source={{ uri: backgroundImageUrl }} style={styles.eventImage} />
        ) : (
          <View style={styles.eventImagePlaceholder} />
        )}
        {npcPortrait ? <Image source={{ uri: resolveEnemyImageUri(npcPortrait) ?? npcPortrait }} style={styles.npcPortrait} /> : null}
        <Text style={styles.sectionTitle}>{event.title}</Text>
        {npcName ? <Text style={styles.selectedTitle}>{npcName}</Text> : null}
        <DialogueTypewriterText text={dialogueText} />
        {dialogueLog.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.copy}>
            {line}
          </Text>
        ))}
        {pendingRewardChoice && pendingRewardPreview.length > 0 ? (
          <View style={styles.lootPanel}>
            <Text style={styles.lootEyebrow}>Found Supplies</Text>
            <Text style={styles.lootTitle}>Take what you found</Text>
            <View style={styles.lootGroup}>
              <View style={styles.rewardPreview}>
                {pendingRewardPreview.map((reward) => (
                  <View key={reward.key} style={styles.rewardChip}>
                    {reward.imageUri ? <Image source={{ uri: reward.imageUri }} style={styles.rewardImage} /> : <View style={styles.rewardIconFallback} />}
                    <View style={styles.rewardTextWrap}>
                      <Text style={styles.rewardName}>{reward.label}</Text>
                      {reward.quantity ? <Text style={styles.rewardQuantity}>x{reward.quantity}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
              <Pressable style={styles.takeButton} onPress={() => onClaimPendingReward?.(pendingRewardChoice)}>
                <Text style={styles.takeButtonText}>Take Items</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.choiceStack}>
          {activeNode ? (
            <>
              {visibleNodeChoices.map((choice) => {
                const availability = choiceAvailability[choice.id] ?? { met: true, hidden: false, disabled: false, message: null };
                return (
                  <Pressable
                    key={choice.id}
                    style={[styles.primaryButton, availability.disabled && styles.lockedButton]}
                    onPress={() => onChoice(choice)}
                    disabled={availability.disabled}
                  >
                    {getAttributeCheckSummary(choice) ? <Text style={styles.checkBadge}>{getAttributeCheckSummary(choice)}</Text> : null}
                    <Text style={[styles.primaryText, availability.disabled && styles.lockedText]}>{choice.button_text}</Text>
                    {availability.disabled && availability.message ? <Text style={styles.requirementText}>{availability.message}</Text> : null}
                  </Pressable>
                );
              })}
              {visibleNodeChoices.length === 0 || activeNode.is_ending ? (
                <Pressable style={styles.primaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.primaryText}>{activeNode.end_completes_event ? "Complete Event" : "Return to Map"}</Text>
                </Pressable>
              ) : null}
              {activeNode.allow_end_chat ? (
                <Pressable style={styles.secondaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.secondaryText}>End Chat</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            legacyChoices.map((choice, index) => (
              <Pressable key={`${choice.label}-${index}`} style={styles.primaryButton} onPress={() => onLegacyChoice(choice.action)}>
                <Text style={styles.primaryText}>{choice.label}</Text>
              </Pressable>
            ))
          )}
        </View>
      </Frame>
    </Screen>
  );
}

function getChoiceRewardPreview(choice: StoryDialogueChoice, rewards: DialogueChoiceReward[], itemDefinitions: ItemDefinition[]) {
  if (choice.action !== "give_reward") {
    return [];
  }

  const preview: Array<{ key: string; label: string; quantity?: number; imageUri?: string | null }> = [];

  const legacyGold = Math.max(0, Number(choice.reward_gold) || 0);
  const legacyXp = Math.max(0, Number(choice.reward_xp) || 0);
  if (legacyGold > 0) {
    preview.push({ key: `${choice.id}-legacy-gold`, label: `${legacyGold} Gold` });
  }
  if (legacyXp > 0) {
    preview.push({ key: `${choice.id}-legacy-xp`, label: `${legacyXp} XP` });
  }
  if (choice.reward_item_id) {
    const item = itemDefinitions.find((definition) => definition.id === choice.reward_item_id);
    preview.push({
      key: `${choice.id}-legacy-item`,
      label: item?.name ?? choice.reward_item ?? "Item",
      quantity: Math.max(1, Number(choice.reward_item_quantity) || 1),
      imageUri: item?.image_path ? resolveInventoryImageUri(item.image_path) : null,
    });
  }

  rewards
    .filter((reward) => reward.choice_id === choice.id)
    .forEach((reward) => {
      if (reward.reward_type === "gold") {
        preview.push({ key: reward.id, label: `${Math.max(0, Number(reward.amount) || 0)} Gold` });
        return;
      }
      if (reward.reward_type === "xp") {
        preview.push({ key: reward.id, label: `${Math.max(0, Number(reward.amount) || 0)} XP` });
        return;
      }
      const item = itemDefinitions.find((definition) => definition.id === reward.item_id);
      preview.push({
        key: reward.id,
        label: item?.name ?? "Item",
        quantity: Math.max(1, Number(reward.quantity) || 1),
        imageUri: item?.image_path ? resolveInventoryImageUri(item.image_path) : null,
      });
    });

  return preview;
}

function DialogueTypewriterText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState(text);

  useEffect(() => {
    setVisibleText("");
    if (!text) {
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [text]);

  return <Text style={styles.dialogueText}>{visibleText}</Text>;
}

const styles = StyleSheet.create({
  eventScreen: {
    margin: 12,
    padding: 14,
    gap: 12,
  },
  previewBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.42)",
    padding: 10,
    gap: 8,
  },
  previewText: {
    color: colors.text,
    fontWeight: "800",
    lineHeight: 18,
  },
  previewExitButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  eventImage: {
    width: "100%",
    height: 220,
    borderRadius: 8,
  },
  eventImagePlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.35)",
  },
  npcPortrait: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    textTransform: "uppercase",
  },
  selectedTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  dialogueText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  lootPanel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0, 8, 10, 0.68)",
    padding: 12,
    gap: 10,
  },
  lootEyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  lootTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  lootGroup: {
    gap: 8,
  },
  choiceStack: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rewardPreview: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    justifyContent: "center",
  },
  rewardChip: {
    minHeight: 54,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rewardImage: {
    width: 42,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  rewardIconFallback: {
    width: 42,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.35)",
  },
  rewardTextWrap: {
    minWidth: 0,
  },
  rewardName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  rewardQuantity: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  takeButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  takeButtonText: {
    color: "#110b04",
    fontWeight: "900",
    textAlign: "center",
  },
  primaryText: {
    color: "#110b04",
    fontWeight: "900",
    textAlign: "center",
  },
  lockedButton: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  lockedText: {
    color: colors.muted,
  },
  requirementText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  checkBadge: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
    textAlign: "center",
  },
});
