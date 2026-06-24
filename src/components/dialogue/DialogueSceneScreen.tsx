import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../Frame";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { resolveEnemyImageUri, type NpcDefinition } from "../../services/combatAdminService";
import type { MapEvent, StoryDialogueChoice, StoryDialogueNode } from "../../services/mapService";
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
}: DialogueSceneScreenProps) {
  const { activeNode, nodeChoices, legacyChoices, npcName, npcPortrait, backgroundImageUrl, dialogueText } =
    getDialogueSceneState({ event, nodes, choices, npcs, activeNodeId });

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
        <View style={styles.choiceStack}>
          {activeNode ? (
            <>
              {nodeChoices.map((choice) => {
                const availability = choiceAvailability[choice.id] ?? { met: true, hidden: false, disabled: false, message: null };
                if (availability.hidden) {
                  return null;
                }
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
              {nodeChoices.length === 0 || activeNode.is_ending ? (
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
