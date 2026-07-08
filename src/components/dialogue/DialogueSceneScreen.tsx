import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
  const [choicesRevealed, setChoicesRevealed] = useState(false);
  const fadeValue = useRef(new Animated.Value(1)).current;
  const restoredPulse = useRef(new Animated.Value(0)).current;
  const latestLogLine = dialogueLog[0] ?? "";
  const restoredLine = latestLogLine.startsWith("Restored ") ? latestLogLine : null;
  const visibleNodeChoices = nodeChoices.filter((choice) => {
    const availability = choiceAvailability[choice.id] ?? { met: true, hidden: false, disabled: false, message: null };
    return !availability.hidden;
  });
  const pendingRewardPreview = pendingRewardChoice
    ? getChoiceRewardPreview(pendingRewardChoice, choiceRewards, itemDefinitions)
    : [];
  const shouldPaceChoices = Boolean(activeNode && dialogueText.trim() && !pendingRewardChoice);
  const canShowChoices = !shouldPaceChoices || choicesRevealed;

  useEffect(() => {
    setChoicesRevealed(false);
    fadeValue.setValue(0);
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeNodeId, dialogueText, fadeValue]);

  useEffect(() => {
    if (!restoredLine) {
      return;
    }

    restoredPulse.setValue(0);
    Animated.sequence([
      Animated.timing(restoredPulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(restoredPulse, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [restoredLine, restoredPulse]);

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
        <View style={styles.sceneHero}>
          {backgroundImageUrl ? (
            <Image source={{ uri: backgroundImageUrl }} style={styles.eventImage} />
          ) : (
            <View style={styles.eventImagePlaceholder} />
          )}
          <View style={styles.heroShade} />
        </View>
        {restoredLine ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.restorePulse,
              {
                opacity: restoredPulse,
                transform: [
                  {
                    scale: restoredPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.restorePulseTitle}>Rested</Text>
            <Text style={styles.restorePulseText}>{restoredLine}</Text>
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.scenePanel, { opacity: fadeValue }]}>
          <View style={styles.sceneHeader}>
            <View style={styles.npcPortraitWrap}>
              {npcPortrait ? (
                <Image source={{ uri: resolveEnemyImageUri(npcPortrait) ?? npcPortrait }} style={styles.npcPortrait} />
              ) : (
                <Text style={styles.npcInitial}>{(npcName || event.title || "?").slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.sceneTitleWrap}>
              <Text style={styles.sectionTitle}>{npcName || event.title}</Text>
            </View>
          </View>
          <Pressable style={styles.dialoguePanel} onPress={() => setChoicesRevealed(true)} disabled={!shouldPaceChoices || choicesRevealed}>
            <Text style={styles.dialogueText}>{dialogueText}</Text>
            {shouldPaceChoices && !choicesRevealed ? <Text style={styles.tapHint}>Tap to continue</Text> : null}
          </Pressable>
        </Animated.View>
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
        <View style={[styles.choiceStack, !canShowChoices && styles.choiceStackHidden]}>
          {activeNode ? (
            <>
              {canShowChoices ? visibleNodeChoices.map((choice) => {
                const availability = choiceAvailability[choice.id] ?? { met: true, hidden: false, disabled: false, message: null };
                const checkSummary = getAttributeCheckSummary(choice);
                const hasRequirement = (choice.requirement_type ?? "none") !== "none" || Boolean(checkSummary);
                return (
                  <Pressable
                    key={choice.id}
                    style={[styles.choiceButton, availability.disabled && styles.lockedButton]}
                    onPress={() => onChoice(choice)}
                    disabled={availability.disabled}
                  >
                    <View style={styles.choiceRow}>
                      <View style={[styles.choiceIcon, availability.disabled && styles.choiceIconLocked]}>
                        <Text style={[styles.choiceIconText, availability.disabled && styles.lockedText]}>{availability.disabled ? "!" : hasRequirement ? "?" : "..."}</Text>
                      </View>
                      <View style={styles.choiceTextWrap}>
                        {checkSummary ? <Text style={styles.checkBadge}>{checkSummary}</Text> : null}
                        <Text style={[styles.choiceText, availability.disabled && styles.lockedText]}>{choice.button_text}</Text>
                        {availability.disabled && availability.message ? <Text style={styles.requirementText}>{availability.message}</Text> : null}
                      </View>
                      <Text style={[styles.choiceArrow, availability.disabled && styles.lockedText]}>{">"}</Text>
                    </View>
                  </Pressable>
                );
              }) : null}
              {canShowChoices && (visibleNodeChoices.length === 0 || activeNode.is_ending) ? (
                <Pressable style={styles.primaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.primaryText}>{activeNode.end_completes_event ? "Complete Event" : "Return to Map"}</Text>
                </Pressable>
              ) : null}
              {canShowChoices && activeNode.allow_end_chat ? (
                <Pressable style={styles.secondaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.secondaryText}>End Chat</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            legacyChoices.map((choice, index) => (
              <Pressable key={`${choice.label}-${index}`} style={styles.choiceButton} onPress={() => onLegacyChoice(choice.action)}>
                <View style={styles.choiceRow}>
                  <View style={styles.choiceIcon}>
                    <Text style={styles.choiceIconText}>...</Text>
                  </View>
                  <Text style={styles.choiceText}>{choice.label}</Text>
                  <Text style={styles.choiceArrow}>{">"}</Text>
                </View>
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
  sceneHero: {
    position: "relative",
    minHeight: 214,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    backgroundColor: "rgba(4, 10, 10, 0.82)",
  },
  eventImage: {
    width: "100%",
    height: 250,
  },
  eventImagePlaceholder: {
    width: "100%",
    height: 220,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.35)",
  },
  heroShade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  restorePulse: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 132,
    zIndex: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(64, 210, 68, 0.66)",
    backgroundColor: "rgba(4, 28, 19, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.green,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  restorePulseTitle: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  restorePulseText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  scenePanel: {
    marginTop: -44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(3, 5, 5, 0.92)",
    padding: 12,
    gap: 12,
  },
  sceneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  npcPortraitWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  npcPortrait: {
    width: "100%",
    height: "100%",
  },
  npcInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 26,
    fontWeight: "900",
  },
  sceneTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 24,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
    textTransform: "uppercase",
  },
  selectedTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  dialoguePanel: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.48)",
    gap: 10,
  },
  dialogueText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
  },
  tapHint: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
    textTransform: "uppercase",
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
  choiceStackHidden: {
    minHeight: 48,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.54)",
    backgroundColor: "rgba(2, 5, 5, 0.72)",
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
    color: colors.gold,
    fontWeight: "900",
    textAlign: "center",
  },
  choiceButton: {
    minHeight: 58,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.45)",
    backgroundColor: "rgba(2, 5, 5, 0.74)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  choiceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.42)",
    backgroundColor: "rgba(217, 170, 93, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconLocked: {
    borderColor: colors.red,
    backgroundColor: "rgba(120, 22, 22, 0.22)",
  },
  choiceIconText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
  },
  choiceTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  choiceText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  choiceArrow: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: "900",
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
