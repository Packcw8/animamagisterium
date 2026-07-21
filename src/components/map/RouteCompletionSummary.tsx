import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";
import type { RouteCompletionSummary as RouteCompletionSummaryData } from "../../utils/routeFindings";

type RouteCompletionSummaryProps = {
  summary: RouteCompletionSummaryData | null;
  rarityLabels: Record<string, string>;
  onDismiss: () => void;
};

export function RouteCompletionSummary({ summary, rarityLabels, onDismiss }: RouteCompletionSummaryProps) {
  if (!summary) {
    return null;
  }

  const totalItemQuantity = summary.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          {summary.iconUrl ? (
            <Image source={{ uri: summary.iconUrl }} style={styles.icon} />
          ) : null}
          <View style={styles.headerCopy}>
            <Text style={styles.overline}>Route Summary</Text>
            <Text style={styles.title}>{summary.routeName}</Text>
            <Text style={styles.subtitle}>{summary.subtitle}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.totalFindings}</Text>
            <Text style={styles.statLabel}>Finds</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalItemQuantity}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.battleCount}</Text>
            <Text style={styles.statLabel}>Battles</Text>
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {summary.items.map((item) => (
            <View key={item.key} style={styles.row}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={styles.fallbackIcon}>
                  <Text style={styles.fallbackText}>{item.findingType === "battle" ? "!" : "+"}</Text>
                </View>
              )}
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.percent}>{Math.round(item.progressPercent)}%</Text>
                <Text style={styles.rarity}>{rarityLabels[item.rarity] ?? item.rarity}</Text>
                {item.quantity > 1 ? <Text style={styles.quantity}>x{item.quantity}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable style={styles.button} onPress={onDismiss}>
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 10,
    right: 10,
    zIndex: 998,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 74,
    paddingBottom: 118,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "82%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.55)",
    backgroundColor: "rgba(5, 8, 9, 0.97)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.48,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.5)",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  overline: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 21,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  stats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.22)",
    backgroundColor: "rgba(217, 164, 65, 0.07)",
    paddingVertical: 8,
    alignItems: "center",
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 2,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.24)",
    backgroundColor: "rgba(11, 10, 7, 0.78)",
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  itemImage: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.42)",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  fallbackIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(24, 178, 242, 0.48)",
    backgroundColor: "rgba(24, 178, 242, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: colors.blue,
    fontSize: 18,
    fontWeight: "900",
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  itemMessage: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  itemMeta: {
    alignItems: "flex-end",
    minWidth: 58,
  },
  percent: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
  },
  rarity: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 3,
  },
  quantity: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
  },
  button: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#080705",
    fontSize: 15,
    fontWeight: "900",
  },
});
