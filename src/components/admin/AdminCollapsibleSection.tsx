import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type AdminCollapsibleSectionProps = {
  title: string;
  summary?: string;
  warningCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function AdminCollapsibleSection({ title, summary, warningCount = 0, isOpen, onToggle, children }: AdminCollapsibleSectionProps) {
  return (
    <View style={styles.panel}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {warningCount > 0 ? <Text style={styles.warning}>{warningCount} warning{warningCount === 1 ? "" : "s"}</Text> : null}
          </View>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text style={styles.toggle}>{isOpen ? "Hide" : "Show"}</Text>
      </Pressable>
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  panel: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  summary: {
    color: colors.muted,
    lineHeight: 18,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
    textTransform: "uppercase",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggle: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  warning: {
    color: colors.red,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
