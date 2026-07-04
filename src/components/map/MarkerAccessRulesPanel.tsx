import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MapMarker, MapRoute, MarkerRouteLink } from "../../services/mapService";
import { colors, fonts } from "../theme";
import { LockPicker } from "./MarkerEditorControls";
import { MarkerPathRequirementEditor } from "./MarkerPathRequirementEditor";
import { MarkerStoryFlagVisibilityEditor } from "./MarkerStoryFlagVisibilityEditor";

type MarkerAccessRulesPanelProps = {
  markerType: string;
  storyFlagKeys: string[];
  visibleStoryFlagKey: string;
  visibleStoryFlagValue: boolean;
  markerLockType: MapMarker["lock_type"];
  markerLockMessage: string;
  markerInteractable: boolean;
  markerInitiallyUnlocked: boolean;
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
  onChangeMarkerLockType: (value: MapMarker["lock_type"]) => void;
  onChangeMarkerLockMessage: (value: string) => void;
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
  markerLockType,
  markerLockMessage,
  markerInteractable,
  markerInitiallyUnlocked,
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
  onChangeMarkerLockType,
  onChangeMarkerLockMessage,
  onToggleInteractable,
  onToggleInitiallyUnlocked,
  onToggleRoute,
  onSelectCompletionCondition,
}: MarkerAccessRulesPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Access Rules</Text>
      <Text style={styles.copy}>
        Control when this {markerType} marker appears and when the player can use it. Prefer one clear story flag for reveal, then path requirements only for gates, exits, clues, and entrances.
      </Text>

      <View style={styles.ruleBlock}>
        <Text style={styles.subTitle}>1. Reveal Rule</Text>
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

      <View style={styles.ruleBlock}>
        <Text style={styles.subTitle}>2. Use Rule</Text>
        <Text style={styles.copy}>Use lock text when the marker can be seen, but should explain why it cannot be opened yet.</Text>
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
        <Pressable style={[styles.secondaryButton, markerInitiallyUnlocked && styles.typeSelected]} onPress={onToggleInitiallyUnlocked}>
          <Text style={styles.secondaryText}>Base Unlock State: {markerInitiallyUnlocked ? "Unlocked" : "Hidden Until Unlocked"}</Text>
        </Pressable>
      </View>

      {showPathRequirements ? (
        <View style={styles.ruleBlock}>
          <Text style={styles.subTitle}>3. Linked Path Requirement</Text>
          <Text style={styles.copy}>Use this only when the marker should open at a trail start/end, like exits, area entrances, clue locations, and gates.</Text>
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

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
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
