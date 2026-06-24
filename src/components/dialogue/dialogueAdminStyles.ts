import { StyleSheet } from "react-native";
import { colors, fonts } from "../theme";

export const dialogueAdminStyles = StyleSheet.create({
  adminMessage: {
    color: colors.gold,
    fontWeight: "800",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  dangerText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
  debugLine: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  disabledAction: {
    opacity: 0.5,
  },
  flowChoice: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 8,
  },
  flowChoiceText: {
    color: colors.text,
    fontWeight: "900",
  },
  flowDialogue: {
    color: colors.muted,
    lineHeight: 18,
  },
  flowPreview: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  flowStep: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  flowStepTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
  },
  flowTarget: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
  },
  flowWarning: {
    color: "#ffb4aa",
    fontSize: 12,
    fontWeight: "900",
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  multiInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 14,
  },
  primaryText: {
    color: colors.bg,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryButtonFlex: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
    textAlign: "center",
  },
  selectedTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  storyCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  storyCardActive: {
    backgroundColor: "rgba(21, 157, 220, 0.12)",
    borderColor: colors.blue,
  },
  storyEditor: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 44,
    padding: 10,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  typeText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
    textAlign: "center",
  },
});
