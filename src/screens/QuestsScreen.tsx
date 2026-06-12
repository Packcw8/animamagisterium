import { StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors } from "../components/theme";
import { quests } from "../data/mockData";

export function QuestsScreen() {
  return (
    <Screen>
      <Header title="Quests / Training" />
      <View style={styles.tabs}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>Daily</Text>
          <Text style={styles.badge}>3</Text>
        </View>
        <Text style={styles.tabText}>Weekly</Text>
        <Text style={styles.tabText}>Achievements</Text>
      </View>
      <View style={styles.list}>
        {quests.map((quest) => (
          <Frame key={quest.id} style={styles.quest}>
            <View style={[styles.questIcon, { borderColor: quest.color }]}>
              <Text style={[styles.questIconText, { color: quest.color }]}>{quest.icon}</Text>
            </View>
            <View style={styles.questBody}>
              <Text style={styles.questTitle}>{quest.title}</Text>
              <Text style={styles.questDescription}>{quest.description}</Text>
              <View style={styles.rewardRow}>
                <Text style={styles.reward}>+{quest.xp} XP</Text>
                <Text style={styles.reward}>+{quest.coins}</Text>
                <Text style={[styles.progressText, { color: quest.color }]}>{quest.progress.toLocaleString()} / {quest.target.toLocaleString()}</Text>
              </View>
              {quest.target > 1 ? (
                <View style={styles.progress}>
                  <ProgressBar value={quest.progress} max={quest.target} color={quest.color} height={5} />
                </View>
              ) : null}
            </View>
          </Frame>
        ))}
      </View>
      <Frame style={styles.training}>
        <Text style={styles.sectionTitle}>Training Activities</Text>
        <Text style={styles.trainingText}>Skill-building activities will connect real-world habits to progression after entering the world.</Text>
      </Frame>
      <Frame style={styles.training}>
        <Text style={styles.sectionTitle}>Story & Seasonal Quests</Text>
        <Text style={styles.trainingText}>Seasonal story progress, quest rewards, and active chapter objectives will gather here.</Text>
      </Frame>
      <Text style={styles.refresh}>New daily quests in: 08:45:12</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
    gap: 14,
  },
  activeTab: {
    height: 40,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 6,
    backgroundColor: "rgba(62, 43, 22, 0.55)",
  },
  activeTabText: {
    color: colors.text,
    fontSize: 14,
  },
  badge: {
    color: "#fff",
    backgroundColor: colors.red,
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  tabText: {
    flex: 1,
    color: colors.text,
    textAlign: "center",
    fontSize: 14,
  },
  list: {
    padding: 14,
    gap: 10,
  },
  quest: {
    minHeight: 118,
    padding: 14,
    flexDirection: "row",
    gap: 16,
  },
  questIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  questIconText: {
    fontWeight: "800",
  },
  questBody: {
    flex: 1,
  },
  questTitle: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 6,
  },
  questDescription: {
    color: colors.muted,
    fontSize: 13,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 18,
  },
  reward: {
    color: colors.text,
    fontSize: 13,
  },
  progressText: {
    marginLeft: "auto",
    fontSize: 13,
  },
  progress: {
    alignSelf: "flex-end",
    width: 96,
    marginTop: 4,
    height: 5,
  },
  refresh: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 2,
  },
  training: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  trainingText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
