import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { ItemDefinition } from "../../services/inventoryService";
import type { MapMarker, MapRoute, MarkerRouteLink } from "../../services/mapService";
import { colors, fonts } from "../theme";
import { ItemPicker, LockPicker } from "./MarkerEditorControls";
import { MarkerPathRequirementEditor } from "./MarkerPathRequirementEditor";
import { MarkerStoryFlagVisibilityEditor } from "./MarkerStoryFlagVisibilityEditor";

type MarkerAccessRulesPanelProps = {
  markerType: string;
  storyFlagKeys: string[];
  visibleStoryFlagKey: string;
  visibleStoryFlagValue: boolean;
  victoryStoryFlagKey: string;
  victoryStoryFlagValue: boolean;
  markerLockType: MapMarker["lock_type"];
  markerLockMessage: string;
  markerAccessRule: MapMarker["access_rule"];
  markerRequiredItemId: string | null;
  markerRequiredItemQuantity: string;
  markerAccessHint: string;
  markerInteractable: boolean;
  markerInitiallyUnlocked: boolean;
  itemDefinitions: ItemDefinition[];
  showPathRequirements: boolean;
  pathRequirementTitle?: string;
  pathRequirementDescription: string;
  routes: MapRoute[];
  selectedRouteIds: string[];
  completionCondition: MarkerRouteLink["completion_condition"];
  emptyPathText: string;
  saveHint?: string;
  onChangeVisibleStoryFlagKey: (value: string) => void;
  onToggleVisibleStoryFlagValue: () => void;
  onClearVisibleStoryFlag: () => void;
  onChangeVictoryStoryFlagKey: (value: string) => void;
  onToggleVictoryStoryFlagValue: () => void;
  onClearVictoryStoryFlag: () => void;
  onChangeMarkerLockType: (value: MapMarker["lock_type"]) => void;
  onChangeMarkerLockMessage: (value: string) => void;
  onChangeMarkerAccessRule: (value: MapMarker["access_rule"]) => void;
  onChangeRequiredItemId: (value: string | null) => void;
  onChangeRequiredItemQuantity: (value: string) => void;
  onChangeAccessHint: (value: string) => void;
  onToggleInteractable: () => void;
  onToggleInitiallyUnlocked: () => void;
  onToggleRoute: (routeId: string) => void;
  onSelectCompletionCondition: (value: MarkerRouteLink["completion_condition"]) => void;
};

export function MarkerAccessRulesPanel({
  markerType,
  storyFlagKeys,
  visibleStoryFlagKey,
  visibleStoryFlagValue,
  victoryStoryFlagKey,
  victoryStoryFlagValue,
  markerLockType,
  markerLockMessage,
  markerAccessRule,
  markerRequiredItemId,
  markerRequiredItemQuantity,
  markerAccessHint,
  markerInteractable,
  markerInitiallyUnlocked,
  itemDefinitions,
  showPathRequirements,
  pathRequirementTitle = "Required Completed Paths",
  pathRequirementDescription,
  routes,
  selectedRouteIds,
  completionCondition,
  emptyPathText,
  saveHint,
  onChangeVisibleStoryFlagKey,
  onToggleVisibleStoryFlagValue,
  onClearVisibleStoryFlag,
  onChangeVictoryStoryFlagKey,
  onToggleVictoryStoryFlagValue,
  onClearVictoryStoryFlag,
  onChangeMarkerLockType,
  onChangeMarkerLockMessage,
  onChangeMarkerAccessRule,
  onChangeRequiredItemId,
  onChangeRequiredItemQuantity,
  onChangeAccessHint,
  onToggleInteractable,
  onToggleInitiallyUnlocked,
  onToggleRoute,
  onSelectCompletionCondition,
}: MarkerAccessRulesPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Access Rules</Text>
      <Text style={styles.copy}>
        Control when this {markerType} marker appears and when the player can use it. Prefer Story Flag, Puzzle Unlock, or Item Required. Use linked path requirements only for older endpoint gates and special cases.
      </Text>

      <View style={styles.ruleBlock}>
        <Text style={styles.subTitle}>1. Simple Unlock Type</Text>
        <Text style={styles.copy}>Choose the one main reason this marker appears or opens.</Text>
        <View style={styles.choiceGrid}>
          {accessRuleOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.ruleChoice, markerAccessRule === option.value && styles.typeSelected]}
              onPress={() => onChangeMarkerAccessRule(option.value)}
            >
              <Text style={styles.secondaryText}>{option.label}</Text>
              <Text style={styles.choiceDescription}>{option.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {markerAccessRule === "story_flag" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>2. Story Flag Reveal</Text>
          <Text style={styles.copy}>Use this when an NPC choice or story event should make the marker appear for one player.</Text>
          <MarkerStoryFlagVisibilityEditor
            storyFlagKeys={storyFlagKeys}
            visibleStoryFlagKey={visibleStoryFlagKey}
            visibleStoryFlagValue={visibleStoryFlagValue}
            onChangeVisibleStoryFlagKey={onChangeVisibleStoryFlagKey}
            onToggleVisibleStoryFlagValue={onToggleVisibleStoryFlagValue}
            onClear={onClearVisibleStoryFlag}
          />
        </View>
      ) : null}

      {markerAccessRule === "puzzle_unlock" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>2. Puzzle Unlock</Text>
          <Text style={styles.copy}>Set Base Unlock State to Hidden Until Unlocked. A completed puzzle can reveal this marker for that player.</Text>
          <Pressable style={[styles.secondaryButton, markerInitiallyUnlocked && styles.typeSelected]} onPress={onToggleInitiallyUnlocked}>
            <Text style={styles.secondaryText}>Base Unlock State: {markerInitiallyUnlocked ? "Unlocked" : "Hidden Until Unlocked"}</Text>
          </Pressable>
        </View>
      ) : null}

      {markerAccessRule === "item_required" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>2. Item Requirement</Text>
          <Text style={styles.copy}>Marker stays visible, but cannot be opened until the player owns the required item.</Text>
          <ItemPicker label="Required item" items={itemDefinitions} selectedId={markerRequiredItemId} onSelect={onChangeRequiredItemId} />
          <TextInput
            value={markerRequiredItemQuantity}
            onChangeText={onChangeRequiredItemQuantity}
            placeholder="Required quantity"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            value={markerAccessHint}
            onChangeText={onChangeAccessHint}
            placeholder="Optional message, example Requires Old Iron Key"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
      ) : null}

      {markerAccessRule === "admin_only" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>2. Admin Only</Text>
          <Text style={styles.copy}>Players will not see this marker. Use this for tests, drafts, and staging.</Text>
        </View>
      ) : null}

      {markerAccessRule === "always" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>2. Always Available</Text>
          <Text style={styles.copy}>This marker uses only proximity and the interaction toggle.</Text>
        </View>
      ) : null}

      {markerAccessRule !== "story_flag" ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>Optional Story Flag</Text>
          <Text style={styles.copy}>Leave blank for the selected unlock type. Use only if you need an extra story gate.</Text>
          <MarkerStoryFlagVisibilityEditor
            storyFlagKeys={storyFlagKeys}
            visibleStoryFlagKey={visibleStoryFlagKey}
            visibleStoryFlagValue={visibleStoryFlagValue}
            onChangeVisibleStoryFlagKey={onChangeVisibleStoryFlagKey}
            onToggleVisibleStoryFlagValue={onToggleVisibleStoryFlagValue}
            onClear={onClearVisibleStoryFlag}
          />
        </View>
      ) : null}

      {isBattleMarkerType(markerType) ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>Battle Victory Result</Text>
          <Text style={styles.copy}>
            This is not a visibility rule. Use it when winning this battle should update story progress, reveal another marker, or permanently close this battle for that player.
          </Text>
          <MarkerStoryFlagVisibilityEditor
            storyFlagKeys={storyFlagKeys}
            visibleStoryFlagKey={victoryStoryFlagKey}
            visibleStoryFlagValue={victoryStoryFlagValue}
            title="After Victory, Set This Flag"
            description="Choose the per-player story flag this battle writes after victory. Set the value to True to unlock/reveal something, or False to turn a story gate off."
            placeholder="Flag set after victory, example trophy_bear_defeated"
            valueLabel="Set Flag Value"
            clearLabel="Clear Victory Flag"
            emptyText="No victory flag. Winning this battle only gives rewards, drops, trophy records, and completion state."
            onChangeVisibleStoryFlagKey={onChangeVictoryStoryFlagKey}
            onToggleVisibleStoryFlagValue={onToggleVictoryStoryFlagValue}
            onClear={onClearVictoryStoryFlag}
          />
          <Text style={styles.hintText}>
            Common setup: Battle marker visible by Story Flag, Hide When Completed enabled, Victory Flag set to True for the next quest step.
          </Text>
        </View>
      ) : null}

      <View style={styles.ruleBlock}>
        <Text style={styles.subTitle}>Use Rule</Text>
        <Text style={styles.copy}>Most markers should stay Public. Use locked text only when players should see the marker but not open it yet.</Text>
        <LockPicker label="Marker use state" value={markerLockType} onSelect={onChangeMarkerLockType} />
        {markerLockType !== "public" ? (
          <TextInput
            value={markerLockMessage}
            onChangeText={onChangeMarkerLockMessage}
            placeholder="Lock message shown to players"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        ) : null}
        <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={onToggleInteractable}>
          <Text style={styles.secondaryText}>Can Be Used When In Range: {markerInteractable ? "Yes" : "No"}</Text>
        </Pressable>
        {markerAccessRule !== "puzzle_unlock" ? (
          <Pressable style={[styles.secondaryButton, markerInitiallyUnlocked && styles.typeSelected]} onPress={onToggleInitiallyUnlocked}>
            <Text style={styles.secondaryText}>Base Unlock State: {markerInitiallyUnlocked ? "Unlocked" : "Hidden Until Unlocked"}</Text>
          </Pressable>
        ) : null}
      </View>

      {showPathRequirements ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>Legacy Linked Path Requirement</Text>
          <Text style={styles.copy}>Use sparingly. Prefer story flags, puzzles, or item requirements for new content.</Text>
          <MarkerPathRequirementEditor
            title={pathRequirementTitle}
            description={pathRequirementDescription}
            routes={routes}
            selectedRouteIds={selectedRouteIds}
            completionCondition={completionCondition}
            onToggleRoute={onToggleRoute}
            onSelectCompletionCondition={onSelectCompletionCondition}
            emptyText={emptyPathText}
            saveHint={saveHint}
          />
        </View>
      ) : null}
    </View>
  );
}

const accessRuleOptions: Array<{ value: MapMarker["access_rule"]; label: string; description: string }> = [
  { value: "always", label: "Always", description: "Visible and usable by proximity." },
  { value: "story_flag", label: "Story Flag", description: "Hidden until dialogue/story sets a flag." },
  { value: "puzzle_unlock", label: "Puzzle Unlock", description: "Hidden until a puzzle reveals it." },
  { value: "item_required", label: "Item Required", description: "Visible, but needs an item to open." },
  { value: "admin_only", label: "Admin Only", description: "Hidden from players." },
];

function isBattleMarkerType(type: string) {
  return type === "Battle" || type === "Battle Zone" || type === "NPC";
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  choiceDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  hintText: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 16,
  },
  panel: {
    borderColor: colors.gold,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  ruleBlock: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  ruleChoice: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 4,
    minWidth: 140,
    padding: 10,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  subTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 14,
    textTransform: "uppercase",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
});
