import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { getLeaderboard, LeaderboardMetric, LeaderboardRow, leaderboardMetrics } from "../services/leaderboardService";

export function SocialScreen() {
  const [activeMetric, setActiveMetric] = useState<LeaderboardMetric>("total_distance_walked_meters");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadLeaderboard(activeMetric);
  }, [activeMetric]);

  const activeLabel = useMemo(() => leaderboardMetrics.find((metric) => metric.key === activeMetric)?.label ?? "Leaderboard", [activeMetric]);

  async function loadLeaderboard(metric: LeaderboardMetric) {
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await getLeaderboard(metric);
      setRows(data);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "Unable to load leaderboards. Confirm the Supabase leaderboard migration has run.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Social / Leaderboards</Text>
        </View>
      </View>

      <Frame style={styles.heroCard}>
        <Text style={styles.eyebrow}>All Players</Text>
        <Text style={styles.title}>{activeLabel} Leaderboard</Text>
        <Text style={styles.copy}>Rankings use saved character, training, event, and route progress data.</Text>
      </Frame>

      <View style={styles.metricTabs}>
        {leaderboardMetrics.map((metric) => (
          <Pressable key={metric.key} style={[styles.metricTab, activeMetric === metric.key && styles.metricTabActive]} onPress={() => setActiveMetric(metric.key)}>
            <Text style={[styles.metricTabText, activeMetric === metric.key && styles.metricTabTextActive]}>{metric.label}</Text>
          </Pressable>
        ))}
      </View>

      <Frame style={styles.board}>
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
        {isLoading ? <Text style={styles.copy}>Loading leaderboard...</Text> : null}
        {!isLoading && rows.length === 0 && !message ? <Text style={styles.copy}>No leaderboard entries yet.</Text> : null}
        {rows.map((row, index) => (
          <LeaderboardCard key={row.character_id} row={row} rank={index + 1} metric={activeMetric} />
        ))}
      </Frame>
    </Screen>
  );
}

function LeaderboardCard({ row, rank, metric }: { row: LeaderboardRow; rank: number; metric: LeaderboardMetric }) {
  return (
    <View style={[styles.rankCard, rank <= 3 && styles.topRankCard]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View style={styles.portraitWrap}>
        {row.portrait_url ? <Image source={{ uri: row.portrait_url }} style={styles.portrait} /> : <Text style={styles.initial}>{row.character_name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.name}>{row.character_name}</Text>
        <Text style={styles.copy}>{row.display_name}</Text>
        <View style={styles.statLine}>
          <Text style={styles.statPill}>Lv {row.level}</Text>
          <Text style={styles.statPill}>{row.xp.toLocaleString()} XP</Text>
          <Text style={styles.statPill}>{row.gold.toLocaleString()} Gold</Text>
        </View>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{formatMetricValue(row, metric)}</Text>
        <Text style={styles.scoreLabel}>{leaderboardMetrics.find((item) => item.key === metric)?.label}</Text>
      </View>
    </View>
  );
}

function formatMetricValue(row: LeaderboardRow, metric: LeaderboardMetric) {
  if (metric === "total_distance_walked_meters") {
    return formatDistance(row.total_distance_walked_meters);
  }

  return Number(row[metric] ?? 0).toLocaleString();
}

function formatDistance(meters: number) {
  if (meters < 160.9344) {
    return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
  }

  return `${(meters / 1609.344).toFixed(2)} mi`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  heroCard: {
    margin: 12,
    padding: 16,
    gap: 8,
  },
  eyebrow: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  metricTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  metricTab: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  metricTabActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  metricTabText: {
    color: colors.text,
    fontWeight: "800",
  },
  metricTabTextActive: {
    color: "#dff6ff",
  },
  board: {
    margin: 12,
    padding: 12,
    gap: 10,
  },
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.24)",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  topRankCard: {
    borderColor: "rgba(217, 170, 93, 0.64)",
    backgroundColor: "rgba(217, 170, 93, 0.08)",
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  rankText: {
    color: colors.gold,
    fontWeight: "900",
  },
  portraitWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061118",
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  statLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
  },
  statPill: {
    color: colors.muted,
    fontSize: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  scoreBox: {
    minWidth: 78,
    alignItems: "flex-end",
  },
  score: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  errorText: {
    color: "#ffb4aa",
    lineHeight: 20,
  },
});
