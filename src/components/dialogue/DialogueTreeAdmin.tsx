import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { ReactNode, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import type { MapEvent, StoryDialogueChoice, StoryDialogueNode } from "../../services/mapService";
import { eventTypeName, getAttributeCheckSummary, getChoiceTargetSummary, getRequirementSummary } from "../../utils/dialogueFlow";
import type { ItemDefinition } from "../../services/inventoryService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type Props = {
  events: MapEvent[];
  selectedEventId: string | null;
  selectedEvent: MapEvent | null;
  title?: string;
  description?: string;
  emptyText?: string;
  showEventPicker?: boolean;
  sourceSummary?: string | null;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  itemDefinitions: ItemDefinition[];
  nodeEditor: ReactNode;
  choiceEditor: ReactNode;
  onSelectEvent: (eventId: string) => void;
  onStartNewNode: () => void;
  onEditChoice: (choice: StoryDialogueChoice) => void;
};

export function DialogueTreeAdmin({
  events,
  selectedEventId,
  selectedEvent,
  title,
  description,
  emptyText,
  showEventPicker = true,
  sourceSummary,
  nodes,
  choices,
  itemDefinitions,
  nodeEditor,
  choiceEditor,
  onSelectEvent,
  onStartNewNode,
  onEditChoice,
}: Props) {
  const [search, setSearch] = useState("");
  const filteredEvents = useMemo(
    () => events.filter((event) => event.event_type !== "battle" && event.title.toLowerCase().includes(search.trim().toLowerCase())),
    [events, search],
  );
  const warnings = useMemo(() => validateDialogueTree(nodes, choices), [choices, nodes]);

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{title ?? "Dialogue Tree Admin"}</Text>
      <Text style={styles.copy}>{description ?? "Manage branching conversations, requirements, checks, and rewards from one place."}</Text>
      {showEventPicker ? (
        <>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search dialogue trees" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.storyRoutePicker}>
            {filteredEvents.map((event) => (
              <Pressable key={event.id} style={[styles.routeChip, selectedEventId === event.id && styles.routeChipActive]} onPress={() => onSelectEvent(event.id)}>
                <Text style={styles.routeChipText}>{event.title}</Text>
                <Text style={styles.debugLine}>S{event.season_number} / C{event.chapter_number} / {eventTypeName(event.event_type)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {selectedEvent ? (
        <View style={styles.storyCard}>
          <Text style={styles.selectedTitle}>Editing: {selectedEvent.title}</Text>
          <Text style={styles.copy}>{sourceSummary ?? `Season ${selectedEvent.season_number} / Chapter ${selectedEvent.chapter_number}`}</Text>
          <Text style={styles.copy}>{nodes.length} dialogue steps - {choices.length} player choices</Text>
          <Text style={styles.debugLine}>Status: Draft workflow foundation. Validation and preview are active; publish gating can be added after a published flag migration.</Text>
        </View>
      ) : (
        <Text style={styles.adminMessage}>{emptyText ?? "Select a dialogue, clue, or reward event before adding steps."}</Text>
      )}
      <Pressable style={styles.secondaryButton} onPress={onStartNewNode} disabled={!selectedEvent}>
        <Text style={styles.secondaryText}>New Dialogue Step</Text>
      </Pressable>
      {selectedEvent ? (
        <>
          <DialogueGraphPreview nodes={nodes} choices={choices} events={events} itemDefinitions={itemDefinitions} onEditChoice={onEditChoice} />
          <DialogueValidationPanel warnings={warnings} />
          {nodeEditor}
          {choiceEditor}
        </>
      ) : null}
    </View>
  );
}

function DialogueGraphPreview({
  nodes,
  choices,
  events,
  itemDefinitions,
  onEditChoice,
}: {
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  events: MapEvent[];
  itemDefinitions: ItemDefinition[];
  onEditChoice: (choice: StoryDialogueChoice) => void;
}) {
  return (
    <View style={styles.flowPreview}>
      <Text style={styles.selectedTitle}>Dialogue Graph View</Text>
      {nodes.length === 0 ? (
        <Text style={styles.copy}>No dialogue steps yet. Add a start step first.</Text>
      ) : (
        nodes.map((node) => {
          const nodeChoices = choices.filter((choice) => choice.node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <View key={`preview-${node.id}`} style={styles.flowStep}>
              <Text style={styles.flowStepTitle}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
              <Text style={styles.flowDialogue}>{node.npc_name ? `${node.npc_name}: ` : ""}{node.dialogue_text || "No NPC dialogue entered."}</Text>
              {nodeChoices.length === 0 ? (
                <Text style={styles.flowWarning}>No choices connected to this step.</Text>
              ) : (
                nodeChoices.map((choice) => {
                  const target = getChoiceTargetSummary(choice, nodes, events);
                  return (
                    <Pressable key={`preview-choice-${choice.id}`} style={styles.flowChoice} onPress={() => onEditChoice(choice)}>
                      <Text style={styles.flowChoiceText}>If player chooses: {choice.button_text}</Text>
                      {choice.player_dialogue_text ? <Text style={styles.flowDialogue}>Player says: {choice.player_dialogue_text}</Text> : null}
                      {(choice.requirement_type ?? "none") !== "none" ? <Text style={styles.debugLine}>{getRequirementSummary(choice, itemDefinitions)}</Text> : null}
                      {getAttributeCheckSummary(choice) ? <Text style={styles.debugLine}>{getAttributeCheckSummary(choice)}</Text> : null}
                      <Text style={[styles.flowTarget, target.isBroken && styles.flowWarning]}>{target.label}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function DialogueValidationPanel({ warnings }: { warnings: string[] }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Validation</Text>
      {warnings.length === 0 ? <Text style={styles.copy}>No validation warnings found.</Text> : null}
      {warnings.map((warning) => (
        <Text key={warning} style={styles.flowWarning}>{warning}</Text>
      ))}
    </View>
  );
}

function validateDialogueTree(nodes: StoryDialogueNode[], choices: StoryDialogueChoice[]) {
  const warnings: string[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (nodes.length > 0 && !nodes.some((node) => node.is_start)) {
    warnings.push("No start node is marked.");
  }

  for (const node of nodes) {
    if (!node.dialogue_text.trim()) {
      warnings.push(`Node "${node.title}" has empty dialogue text.`);
    }
  }

  for (const choice of choices) {
    if (choice.action === "go_to_node" && (!choice.next_node_id || !nodeIds.has(choice.next_node_id))) {
      warnings.push(`Choice "${choice.button_text}" has a missing destination node.`);
    }
    if (choice.check_enabled && choice.check_success_node_id && !nodeIds.has(choice.check_success_node_id)) {
      warnings.push(`Choice "${choice.button_text}" has a missing success node.`);
    }
    if (choice.check_enabled && choice.check_failure_node_id && !nodeIds.has(choice.check_failure_node_id)) {
      warnings.push(`Choice "${choice.button_text}" has a missing failure node.`);
    }
    if ((choice.requirement_type ?? "none") !== "none" && !choice.requirement_value && choice.requirement_type !== "gold") {
      warnings.push(`Choice "${choice.button_text}" has an incomplete requirement.`);
    }
  }

  return warnings;
}
