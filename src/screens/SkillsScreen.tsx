import { StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors } from "../components/theme";
import { skills } from "../data/mockData";

export function SkillsScreen() {
  const groups = ["Strength", "Endurance"] as const;

  return (
    <Screen>
      <Header title="Skills" />
      <Text style={styles.available}>Available Points: 2</Text>
      {groups.map((group) => (
        <View key={group} style={styles.group}>
          <Text style={[styles.groupTitle, { color: group === "Strength" ? colors.red : "#8dda53" }]}>{group}</Text>
          <Frame style={styles.skillList}>
            {skills.filter((skill) => skill.group === group).map((skill) => (
              <View key={skill.id} style={styles.skillRow}>
                <View style={[styles.skillIcon, { borderColor: skill.color }]}>
                  <Text style={[styles.skillTag, { color: skill.color }]}>{skill.icon}</Text>
                </View>
                <View style={styles.skillInfo}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Text style={styles.skillLevel}>Level {skill.level}</Text>
                </View>
                <View style={styles.skillProgress}>
                  <Text style={styles.progressText}>{skill.progress} / {skill.target}</Text>
                  <ProgressBar value={skill.progress} max={skill.target} color={skill.color} height={6} />
                </View>
                <Text style={styles.chevron}>{">"}</Text>
              </View>
            ))}
          </Frame>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  available: {
    color: colors.gold,
    textAlign: "right",
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 14,
  },
  group: {
    marginHorizontal: 18,
    marginBottom: 22,
  },
  groupTitle: {
    textTransform: "uppercase",
    fontSize: 16,
    marginBottom: 12,
  },
  skillList: {
    paddingVertical: 8,
  },
  skillRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  skillIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skillTag: {
    fontSize: 11,
    fontWeight: "800",
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    color: colors.text,
    fontSize: 14,
  },
  skillLevel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  skillProgress: {
    width: 132,
    gap: 6,
  },
  progressText: {
    color: colors.text,
    textAlign: "right",
    fontSize: 12,
  },
  chevron: {
    color: colors.gold,
    fontSize: 18,
  },
});
