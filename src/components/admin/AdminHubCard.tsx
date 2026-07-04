import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type AdminHubCardProps = {
  title: string;
  eyebrow: string;
  description: string;
  status?: string;
  actionLabel: string;
  onPress: () => void;
};

export function AdminHubCard({ title, eyebrow, description, status, actionLabel, onPress }: AdminHubCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: "center",
  },
  buttonText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  card: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(5, 8, 8, 0.74)",
    gap: 10,
    padding: 12,
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  iconBadge: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconText: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  status: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
  },
});
