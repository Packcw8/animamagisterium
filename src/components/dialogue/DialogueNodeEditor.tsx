import { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import type { StoryDialogueNode } from "../../services/mapService";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type Props = {
  nodes: StoryDialogueNode[];
  editingNode: StoryDialogueNode | null;
  selectedNodeId: string | null;
  title: string;
  nodeKey: string;
  npcName: string;
  npcPortrait: string;
  backgroundImage: string;
  dialogue: string;
  sortOrder: string;
  isStart: boolean;
  isEnding: boolean;
  allowEndChat: boolean;
  endCompletesEvent: boolean;
  selectedDialogueEventId: string | null;
  renderNpcPicker: ReactNode;
  renderNpcPortraitUploader: ReactNode;
  renderBackgroundUploader: ReactNode;
  onChangeTitle: (value: string) => void;
  onChangeNodeKey: (value: string) => void;
  onChangeNpcName: (value: string) => void;
  onChangeNpcPortrait: (value: string) => void;
  onChangeBackgroundImage: (value: string) => void;
  onChangeDialogue: (value: string) => void;
  onChangeSortOrder: (value: string) => void;
  onToggleStart: () => void;
  onToggleEnding: () => void;
  onToggleAllowEndChat: () => void;
  onToggleEndCompletesEvent: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onSelectNode: (nodeId: string) => void;
  onEditNode: (node: StoryDialogueNode) => void;
  onStartChoice: (node: StoryDialogueNode) => void;
  onDeleteNode: (nodeId: string) => void;
  getNodeChoiceCount: (nodeId: string) => number;
};

export function DialogueNodeEditor({
  nodes,
  editingNode,
  selectedNodeId,
  title,
  nodeKey,
  npcName,
  npcPortrait,
  backgroundImage,
  dialogue,
  sortOrder,
  isStart,
  isEnding,
  allowEndChat,
  endCompletesEvent,
  selectedDialogueEventId,
  renderNpcPicker,
  renderNpcPortraitUploader,
  renderBackgroundUploader,
  onChangeTitle,
  onChangeNodeKey,
  onChangeNpcName,
  onChangeNpcPortrait,
  onChangeBackgroundImage,
  onChangeDialogue,
  onChangeSortOrder,
  onToggleStart,
  onToggleEnding,
  onToggleAllowEndChat,
  onToggleEndCompletesEvent,
  onSave,
  onCancelEdit,
  onSelectNode,
  onEditNode,
  onStartChoice,
  onDeleteNode,
  getNodeChoiceCount,
}: Props) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Dialogue Node Editor</Text>
      <TextInput value={title} onChangeText={onChangeTitle} placeholder="Dialogue step title / internal label" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={nodeKey} onChangeText={onChangeNodeKey} placeholder="Optional node key" placeholderTextColor={colors.muted} style={styles.input} />
      {renderNpcPicker}
      <TextInput value={npcName} onChangeText={onChangeNpcName} placeholder="NPC name" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={npcPortrait} onChangeText={onChangeNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
      {renderNpcPortraitUploader}
      <TextInput value={backgroundImage} onChangeText={onChangeBackgroundImage} placeholder="Background image URL optional" placeholderTextColor={colors.muted} style={styles.input} />
      {renderBackgroundUploader}
      <TextInput value={dialogue} onChangeText={onChangeDialogue} placeholder="NPC dialogue text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
      <TextInput value={sortOrder} onChangeText={onChangeSortOrder} placeholder="Dialogue step order" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.typeGrid}>
        <Pressable style={[styles.typeButton, isStart && styles.typeSelected]} onPress={onToggleStart}><Text style={styles.typeText}>Start Step</Text></Pressable>
        <Pressable style={[styles.typeButton, isEnding && styles.typeSelected]} onPress={onToggleEnding}><Text style={styles.typeText}>Ending Step</Text></Pressable>
        <Pressable style={[styles.typeButton, allowEndChat && styles.typeSelected]} onPress={onToggleAllowEndChat}><Text style={styles.typeText}>Allow End Chat</Text></Pressable>
        <Pressable style={[styles.typeButton, endCompletesEvent && styles.typeSelected]} onPress={onToggleEndCompletesEvent}><Text style={styles.typeText}>End Completes</Text></Pressable>
      </View>
      <Pressable style={styles.primaryButton} onPress={onSave} disabled={!selectedDialogueEventId || !title.trim()}>
        <Text style={styles.primaryText}>{editingNode ? "Update Dialogue Step" : "Add Dialogue Step"}</Text>
      </Pressable>
      {editingNode ? <Pressable style={styles.secondaryButton} onPress={onCancelEdit}><Text style={styles.secondaryText}>Cancel Step Edit</Text></Pressable> : null}
      <Text style={styles.selectedTitle}>Dialogue Nodes</Text>
      {nodes.map((node) => (
        <View key={node.id} style={[styles.storyCard, selectedNodeId === node.id && styles.storyCardActive]}>
          <Text style={styles.flowStepTitle}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
          <Text style={styles.copy}>{node.dialogue_text || "No dialogue yet."}</Text>
          <Text style={styles.debugLine}>{getNodeChoiceCount(node.id)} choice{getNodeChoiceCount(node.id) === 1 ? "" : "s"}</Text>
          <View style={styles.modeRow}>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onSelectNode(node.id)}><Text style={styles.secondaryText}>Select</Text></Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onEditNode(node)}><Text style={styles.secondaryText}>Edit</Text></Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onStartChoice(node)}><Text style={styles.secondaryText}>Add Choice</Text></Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onDeleteNode(node.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
