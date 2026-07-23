import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Frame } from "../Frame";
import { colors, fonts } from "../theme";

type PlayerMapTravelHeaderProps = {
  statusText: string;
  gold: number;
  primaryLabel: string;
  primaryActive: boolean;
  onPrimary: () => void;
  turnLabel: string;
  canTurnBack: boolean;
  turnActive: boolean;
  onTurnBack: () => void;
  children?: ReactNode;
};

export function PlayerMapTravelHeader({
  statusText,
  gold,
  primaryLabel,
  primaryActive,
  onPrimary,
  turnLabel,
  canTurnBack,
  turnActive,
  onTurnBack,
  children,
}: PlayerMapTravelHeaderProps) {
  return (
    <Frame style={styles.shell}>
      <View style={styles.statusRow}>
        <View style={styles.statusCopy}>
          <Text style={styles.statusLabel}>Travel</Text>
          <Text style={styles.statusText} numberOfLines={2}>{statusText}</Text>
        </View>
        <View style={styles.goldPill}>
          <Text style={styles.goldIcon}>◎</Text>
          <Text style={styles.goldValue}>{gold.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.primaryButton, primaryActive && styles.primaryActive]} onPress={onPrimary}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, turnActive && styles.secondaryActive, !canTurnBack && styles.disabled]}
          onPress={onTurnBack}
          disabled={!canTurnBack}
        >
          <Text style={styles.secondaryText}>{turnLabel}</Text>
        </Pressable>
      </View>

      {children}
    </Frame>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    gap: 10,
    borderColor: "rgba(218, 164, 65, 0.42)",
    backgroundColor: "rgba(5, 8, 9, 0.96)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusText: {
    color: colors.goldSoft,
    marginTop: 2,
    lineHeight: 18,
  },
  goldPill: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.55)",
    backgroundColor: "rgba(218, 164, 65, 0.12)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  goldIcon: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: "900",
  },
  goldValue: {
    color: colors.text,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryActive: {
    backgroundColor: colors.blue,
  },
  primaryText: {
    color: "#120e08",
    fontFamily: fonts.title,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  secondaryButton: {
    minWidth: 104,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  secondaryActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(24, 178, 242, 0.16)",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.45,
  },
});
