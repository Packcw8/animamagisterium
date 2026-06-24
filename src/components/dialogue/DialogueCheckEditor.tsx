import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import type { StoryDialogueChoice, StoryDialogueNode } from "../../services/mapService";
import { formatAttributeName } from "../../utils/dialogueFlow";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type Props = {
  enabled: boolean;
  attribute: NonNullable<StoryDialogueChoice["check_attribute"]>;
  dc: string;
  successNodeId: string | null;
  failureNodeId: string | null;
  successText: string;
  failureText: string;
  attributes: readonly NonNullable<StoryDialogueChoice["check_attribute"]>[];
  nodes: StoryDialogueNode[];
  onToggleEnabled: () => void;
  onChangeAttribute: (value: NonNullable<StoryDialogueChoice["check_attribute"]>) => void;
  onChangeDc: (value: string) => void;
  onChangeSuccessNodeId: (value: string | null) => void;
  onChangeFailureNodeId: (value: string | null) => void;
  onChangeSuccessText: (value: string) => void;
  onChangeFailureText: (value: string) => void;
};

export function DialogueCheckEditor({
  enabled,
  attribute,
  dc,
  successNodeId,
  failureNodeId,
  successText,
  failureText,
  attributes,
  nodes,
  onToggleEnabled,
  onChangeAttribute,
  onChangeDc,
  onChangeSuccessNodeId,
  onChangeFailureNodeId,
  onChangeSuccessText,
  onChangeFailureText,
}: Props) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Attribute Check</Text>
      <Text style={styles.copy}>Optional d20 + attribute roll. Success and failure can branch to different dialogue steps.</Text>
      <Pressable style={[styles.secondaryButton, enabled && styles.typeSelected]} onPress={onToggleEnabled}>
        <Text style={styles.secondaryText}>Check Enabled: {enabled ? "Yes" : "No"}</Text>
      </Pressable>
      {enabled ? (
        <>
          <View style={styles.storyRoutePicker}>
            {attributes.map((item) => (
              <Pressable key={item} style={[styles.routeChip, attribute === item && styles.routeChipActive]} onPress={() => onChangeAttribute(item)}>
                <Text style={styles.routeChipText}>{formatAttributeName(item)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={dc} onChangeText={onChangeDc} placeholder="Difficulty Class (DC), example 15" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.copy}>Success branch</Text>
          <View style={styles.storyRoutePicker}>
            <Pressable style={[styles.routeChip, !successNodeId && styles.routeChipActive]} onPress={() => onChangeSuccessNodeId(null)}>
              <Text style={styles.routeChipText}>Continue action</Text>
            </Pressable>
            {nodes.map((node) => (
              <Pressable key={node.id} style={[styles.routeChip, successNodeId === node.id && styles.routeChipActive]} onPress={() => onChangeSuccessNodeId(node.id)}>
                <Text style={styles.routeChipText}>{node.sort_order}. {node.title}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.copy}>Failure branch</Text>
          <View style={styles.storyRoutePicker}>
            <Pressable style={[styles.routeChip, !failureNodeId && styles.routeChipActive]} onPress={() => onChangeFailureNodeId(null)}>
              <Text style={styles.routeChipText}>Stay here</Text>
            </Pressable>
            {nodes.map((node) => (
              <Pressable key={node.id} style={[styles.routeChip, failureNodeId === node.id && styles.routeChipActive]} onPress={() => onChangeFailureNodeId(node.id)}>
                <Text style={styles.routeChipText}>{node.sort_order}. {node.title}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={successText} onChangeText={onChangeSuccessText} placeholder="Success text, example: Success! The guard steps aside." placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={failureText} onChangeText={onChangeFailureText} placeholder="Failure text, example: Failure. The guard refuses." placeholderTextColor={colors.muted} style={styles.input} />
        </>
      ) : null}
    </View>
  );
}
