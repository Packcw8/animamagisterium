import { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import type { StoryDialogueChoice, StoryDialogueNode } from "../../services/mapService";
import { choiceActionLabel, getAttributeCheckSummary, getRequirementSummary } from "../../utils/dialogueFlow";
import type { ItemDefinition } from "../../services/inventoryService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type Props = {
  nodes: StoryDialogueNode[];
  selectedChoiceNode: StoryDialogueNode | null;
  selectedNodeChoices: StoryDialogueChoice[];
  editingChoice: StoryDialogueChoice | null;
  nodeId: string | null;
  buttonText: string;
  playerText: string;
  action: StoryDialogueChoice["action"];
  nextNodeId: string | null;
  sortOrder: string;
  itemDefinitions: ItemDefinition[];
  effectEditor: ReactNode;
  requirementEditor: ReactNode;
  checkEditor: ReactNode;
  onSelectNode: (nodeId: string) => void;
  onChangeButtonText: (value: string) => void;
  onChangePlayerText: (value: string) => void;
  onChangeAction: (value: StoryDialogueChoice["action"]) => void;
  onChangeNextNodeId: (value: string | null) => void;
  onChangeSortOrder: (value: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onEditChoice: (choice: StoryDialogueChoice) => void;
  onDeleteChoice: (choiceId: string) => void;
};

const choiceActions: StoryDialogueChoice["action"][] = ["go_to_node", "start_battle", "complete_event", "unlock_next_event", "give_reward", "end_conversation", "return_to_map"];

export function DialogueChoiceEditor({
  nodes,
  selectedChoiceNode,
  selectedNodeChoices,
  editingChoice,
  nodeId,
  buttonText,
  playerText,
  action,
  nextNodeId,
  sortOrder,
  itemDefinitions,
  effectEditor,
  requirementEditor,
  checkEditor,
  onSelectNode,
  onChangeButtonText,
  onChangePlayerText,
  onChangeAction,
  onChangeNextNodeId,
  onChangeSortOrder,
  onSave,
  onCancelEdit,
  onEditChoice,
  onDeleteChoice,
}: Props) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Dialogue Choice Editor{selectedChoiceNode ? `: ${selectedChoiceNode.title}` : ""}</Text>
      <Text style={styles.copy}>{selectedChoiceNode ? "Create choices for the selected dialogue step. Choices can move the conversation, start battle, reward the player, or return to the map." : "Select a dialogue step first."}</Text>
      <View style={styles.storyRoutePicker}>
        {nodes.map((node) => (
          <Pressable key={node.id} style={[styles.routeChip, nodeId === node.id && styles.routeChipActive]} onPress={() => onSelectNode(node.id)}>
            <Text style={styles.routeChipText}>{node.sort_order}. {node.title}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={buttonText} onChangeText={onChangeButtonText} placeholder="Player button text" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={playerText} onChangeText={onChangePlayerText} placeholder="Optional player dialogue text" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.typeGrid}>
        {choiceActions.map((choiceAction) => (
          <Pressable key={choiceAction} style={[styles.typeButton, action === choiceAction && styles.typeSelected]} onPress={() => onChangeAction(choiceAction)}>
            <Text style={styles.typeText}>{choiceActionLabel(choiceAction)}</Text>
          </Pressable>
        ))}
      </View>
      {action === "go_to_node" ? (
        <View style={styles.storyRoutePicker}>
          {nodes.map((node) => (
            <Pressable key={node.id} style={[styles.routeChip, nextNodeId === node.id && styles.routeChipActive]} onPress={() => onChangeNextNodeId(node.id)}>
              <Text style={styles.routeChipText}>Next: {node.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {effectEditor}
      {requirementEditor}
      {checkEditor}
      <TextInput value={sortOrder} onChangeText={onChangeSortOrder} placeholder="Choice order" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={styles.primaryButton} onPress={onSave} disabled={!nodeId || !buttonText.trim()}>
        <Text style={styles.primaryText}>{editingChoice ? "Update Player Choice" : "Add Player Choice"}</Text>
      </Pressable>
      {editingChoice ? <Pressable style={styles.secondaryButton} onPress={onCancelEdit}><Text style={styles.secondaryText}>Cancel Choice Edit</Text></Pressable> : null}
      {selectedNodeChoices.map((choice) => (
        <View key={choice.id} style={styles.storyCard}>
          <Text style={styles.flowStepTitle}>{choice.button_text}</Text>
          <Text style={styles.copy}>{choiceActionLabel(choice.action)}{choice.player_dialogue_text ? ` - "${choice.player_dialogue_text}"` : ""}</Text>
          {(choice.requirement_type ?? "none") !== "none" ? <Text style={styles.debugLine}>{getRequirementSummary(choice, itemDefinitions)}</Text> : null}
          {getAttributeCheckSummary(choice) ? <Text style={styles.debugLine}>{getAttributeCheckSummary(choice)}</Text> : null}
          <View style={styles.modeRow}>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onEditChoice(choice)}><Text style={styles.secondaryText}>Edit Choice</Text></Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onDeleteChoice(choice.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
