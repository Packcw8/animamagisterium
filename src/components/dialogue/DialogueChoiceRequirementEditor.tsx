import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Text, TextInput, View } from "react-native";
import { EventPicker, ItemPicker, MarkerPicker } from "../map/MarkerEditorControls";
import { colors } from "../theme";
import type { ItemDefinition } from "../../services/inventoryService";
import type { MapEvent, MapMarker, StoryDialogueChoice, TutorialStep } from "../../services/mapService";
import { requirementTypeLabel } from "../../utils/dialogueFlow";
import { isStoryQuestMarker } from "../../utils/mapVisibility";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";
import { StoryFlagPicker } from "./StoryFlagPicker";

type Props = {
  requirementTypes: readonly StoryDialogueChoice["requirement_type"][];
  operators: readonly StoryDialogueChoice["requirement_operator"][];
  attributeKeys: readonly string[];
  requirementType: StoryDialogueChoice["requirement_type"];
  requirementValue: string;
  requirementQuantity: string;
  requirementOperator: StoryDialogueChoice["requirement_operator"];
  hideIfUnmet: boolean;
  disableIfUnmet: boolean;
  consumeRequiredItem: boolean;
  failureMessage: string;
  itemDefinitions: ItemDefinition[];
  markers: MapMarker[];
  events: MapEvent[];
  tutorialSteps: TutorialStep[];
  storyFlagKeys: string[];
  onChangeType: (value: StoryDialogueChoice["requirement_type"]) => void;
  onChangeValue: (value: string) => void;
  onChangeQuantity: (value: string) => void;
  onChangeOperator: (value: StoryDialogueChoice["requirement_operator"]) => void;
  onToggleHide: () => void;
  onToggleDisable: () => void;
  onToggleConsumeRequiredItem: () => void;
  onChangeFailureMessage: (value: string) => void;
};

export function DialogueChoiceRequirementEditor({
  requirementTypes,
  operators,
  attributeKeys,
  requirementType,
  requirementValue,
  requirementQuantity,
  requirementOperator,
  hideIfUnmet,
  disableIfUnmet,
  consumeRequiredItem,
  failureMessage,
  itemDefinitions,
  markers,
  events,
  tutorialSteps,
  storyFlagKeys,
  onChangeType,
  onChangeValue,
  onChangeQuantity,
  onChangeOperator,
  onToggleHide,
  onToggleDisable,
  onToggleConsumeRequiredItem,
  onChangeFailureMessage,
}: Props) {
  const showQuantity = requirementType === "gold" || requirementType === "item" || requirementType === "attribute_level";
  const showOperator = requirementType === "gold" || requirementType === "attribute_level";

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Choice Requirement</Text>
      <Text style={styles.copy}>Gate this choice behind gold, items, story progress, tutorial completion, known abilities, or attribute levels.</Text>
      <View style={styles.typeGrid}>
        {requirementTypes.map((type) => (
          <Pressable key={type} style={[styles.typeButton, requirementType === type && styles.typeSelected]} onPress={() => onChangeType(type)}>
            <Text style={styles.typeText}>{requirementTypeLabel(type)}</Text>
          </Pressable>
        ))}
      </View>
      {requirementType === "item" ? (
        <ItemPicker label="Required item" items={itemDefinitions} selectedId={requirementValue || null} onSelect={(id) => onChangeValue(id ?? "")} />
      ) : null}
      {requirementType === "completed_marker" ? (
        <MarkerPicker label="Required completed marker" markers={markers.filter(isStoryQuestMarker)} selectedId={requirementValue || null} onSelect={(id) => onChangeValue(id ?? "")} />
      ) : null}
      {requirementType === "completed_event" ? (
        <EventPicker label="Required completed event" events={events} selectedId={requirementValue || null} onSelect={(id) => onChangeValue(id ?? "")} />
      ) : null}
      {requirementType === "tutorial_step" ? (
        <View style={styles.storyRoutePicker}>
          {tutorialSteps.map((step) => (
            <Pressable key={step.id} style={[styles.routeChip, requirementValue === step.id && styles.routeChipActive]} onPress={() => onChangeValue(step.id)}>
              <Text style={styles.routeChipText}>{step.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {requirementType === "attribute_level" ? (
        <View style={styles.storyRoutePicker}>
          {attributeKeys.map((attribute) => (
            <Pressable key={attribute} style={[styles.routeChip, requirementValue === attribute && styles.routeChipActive]} onPress={() => onChangeValue(attribute)}>
              <Text style={styles.routeChipText}>{attribute}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {requirementType === "story_flag" ? <StoryFlagPicker flags={storyFlagKeys} selectedKey={requirementValue} onSelect={onChangeValue} /> : null}
      {requirementType !== "none" && !["item", "completed_marker", "completed_event", "tutorial_step", "attribute_level"].includes(requirementType) ? (
        <TextInput value={requirementValue} onChangeText={onChangeValue} placeholder="Requirement value, key, ability id/name, or amount" placeholderTextColor={colors.muted} style={styles.input} />
      ) : null}
      {requirementType === "story_flag" ? (
        <Pressable style={[styles.secondaryButton, Number(requirementQuantity || 1) !== 0 && styles.typeSelected]} onPress={() => onChangeQuantity(Number(requirementQuantity || 1) === 0 ? "1" : "0")}>
          <Text style={styles.secondaryText}>Required Flag Value: {Number(requirementQuantity || 1) === 0 ? "False" : "True"}</Text>
        </Pressable>
      ) : null}
      {showQuantity ? (
        <TextInput value={requirementQuantity} onChangeText={onChangeQuantity} placeholder={requirementType === "gold" ? "Required gold amount" : requirementType === "attribute_level" ? "Required attribute level" : "Required quantity"} placeholderTextColor={colors.muted} style={styles.input} />
      ) : null}
      {requirementType === "item" ? (
        <Pressable style={[styles.secondaryButton, consumeRequiredItem && styles.typeSelected]} onPress={onToggleConsumeRequiredItem}>
          <Text style={styles.secondaryText}>Take Required Item On Success: {consumeRequiredItem ? "Yes" : "No"}</Text>
        </Pressable>
      ) : null}
      {showOperator ? (
        <View style={styles.storyRoutePicker}>
          {operators.map((operator) => (
            <Pressable key={operator} style={[styles.routeChip, requirementOperator === operator && styles.routeChipActive]} onPress={() => onChangeOperator(operator)}>
              <Text style={styles.routeChipText}>{operator}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {requirementType !== "none" ? (
        <>
          <TextInput value={failureMessage} onChangeText={onChangeFailureMessage} placeholder="Failure message, example: Requires 100 Gold" placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable style={[styles.secondaryButton, hideIfUnmet && styles.typeSelected]} onPress={onToggleHide}>
            <Text style={styles.secondaryText}>Hide If Not Met: {hideIfUnmet ? "Yes" : "No"}</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, disableIfUnmet && styles.typeSelected]} onPress={onToggleDisable}>
            <Text style={styles.secondaryText}>Disable If Not Met: {disableIfUnmet ? "Yes" : "No"}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
