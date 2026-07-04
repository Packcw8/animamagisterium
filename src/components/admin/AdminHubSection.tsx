import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type AdminHubSectionProps = PropsWithChildren<{
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
}>;

export function AdminHubSection({ title, summary, open, onToggle, children }: AdminHubSectionProps) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <Text style={styles.toggle}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
    paddingTop: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  section: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(18, 15, 11, 0.92)",
    padding: 12,
  },
  summary: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: 2,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  toggle: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
});
