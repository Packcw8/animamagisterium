import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
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
  repeatable: boolean;
  hideAfterSelected: boolean;
  disableAfterSelected: boolean;
  selectedMessage: string;
  choiceGroupKey: string;
  choiceGroupLockMessage: string;
  hideWhenGroupLocked: boolean;
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
  onToggleRepeatable: () => void;
  onToggleHideAfterSelected: () => void;
  onToggleDisableAfterSelected: () => void;
  onChangeSelectedMessage: (value: string) => void;
  onChangeChoiceGroupKey: (value: string) => void;
  onChangeChoiceGroupLockMessage: (value: string) => void;
  onToggleHideWhenGroupLocked: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onEditChoice: (choice: StoryDialogueChoice) => void;
  onDeleteChoice: (choiceId: string) => void;
};

const choiceActions: StoryDialogueChoice["action"][] = ["go_to_node", "start_battle", "start_quest", "complete_event", "unlock_next_event", "give_reward", "travel_to_marker", "end_conversation", "return_to_map"];

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
  repeatable,
  hideAfterSelected,
  disableAfterSelected,
  selectedMessage,
  choiceGroupKey,
  choiceGroupLockMessage,
  hideWhenGroupLocked,
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
  onToggleRepeatable,
  onToggleHideAfterSelected,
  onToggleDisableAfterSelected,
  onChangeSelectedMessage,
  onChangeChoiceGroupKey,
  onChangeChoiceGroupLockMessage,
  onToggleHideWhenGroupLocked,
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
      <View style={styles.storyEditor}>
        <Text style={styles.selectedTitle}>Choice Memory</Text>
        <Text style={styles.copy}>Use this for quest-start, take-item, or one-time decision choices. This is saved per player, not globally.</Text>
        <Pressable style={[styles.secondaryButton, repeatable && styles.typeSelected]} onPress={onToggleRepeatable}>
          <Text style={styles.secondaryText}>Repeatable: {repeatable ? "Yes" : "No"}</Text>
        </Pressable>
        {!repeatable ? (
          <>
            <View style={styles.modeRow}>
              <Pressable style={[styles.secondaryButtonFlex, hideAfterSelected && styles.typeSelected]} onPress={onToggleHideAfterSelected}>
                <Text style={styles.secondaryText}>Hide After Selected: {hideAfterSelected ? "Yes" : "No"}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButtonFlex, disableAfterSelected && styles.typeSelected]} onPress={onToggleDisableAfterSelected}>
                <Text style={styles.secondaryText}>Disable After Selected: {disableAfterSelected ? "Yes" : "No"}</Text>
              </Pressable>
            </View>
            <TextInput value={selectedMessage} onChangeText={onChangeSelectedMessage} placeholder="Message if disabled, example Quest already started." placeholderTextColor={colors.muted} style={styles.input} />
          </>
        ) : null}
        <TextInput value={choiceGroupKey} onChangeText={onChangeChoiceGroupKey} placeholder="Exclusive choice group key, example elara_harlen_choice" placeholderTextColor={colors.muted} style={styles.input} />
        {choiceGroupKey.trim() ? (
          <>
            <TextInput value={choiceGroupLockMessage} onChangeText={onChangeChoiceGroupLockMessage} placeholder="Message for locked alternate choices" placeholderTextColor={colors.muted} style={styles.input} />
            <Pressable style={[styles.secondaryButton, hideWhenGroupLocked && styles.typeSelected]} onPress={onToggleHideWhenGroupLocked}>
              <Text style={styles.secondaryText}>Hide Other Group Choices: {hideWhenGroupLocked ? "Yes" : "No"}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
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
          {choice.choice_group_key ? <Text style={styles.debugLine}>Exclusive group: {choice.choice_group_key}</Text> : null}
          {choice.set_story_flag_key ? <Text style={styles.debugLine}>Sets flag: {choice.set_story_flag_key} = {choice.set_story_flag_value ? "true" : "false"}</Text> : null}
          {!choice.repeatable ? <Text style={styles.debugLine}>{choice.hide_after_selected ? "One-time / hides after selected" : "One-time / disables after selected"}</Text> : null}
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
