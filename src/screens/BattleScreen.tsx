import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { player } from "../data/mockData";

const mockImage = require("../../assets/mockanimamagisterium.png");

const abilities = [
  { name: "Power Strike", detail: "Deals 120 damage", color: colors.red, tag: "PS" },
  { name: "Quick Step", detail: "Dodge next attack", color: "#9bd744", tag: "QS" },
  { name: "Focus", detail: "Restore 60 Mana", color: colors.blue, tag: "FC" },
  { name: "Inspire", detail: "Boosts all stats", color: colors.yellow, tag: "IN" },
];

export function BattleScreen() {
  return (
    <Screen>
      <Header title="Battle" />
      <View style={styles.enemyStage}>
        <Image source={mockImage} style={styles.enemyArt} resizeMode="cover" />
        <View style={styles.enemyShade} />
        <Text style={styles.enemyName}>Shadow Wolf</Text>
        <Text style={styles.enemyLevel}>Level 18</Text>
        <View style={styles.enemyBar}>
          <ProgressBar value={650} max={950} color={colors.red} height={12} />
        </View>
        <Text style={styles.enemyHp}>650 / 950</Text>
      </View>

      <Text style={styles.vs}>VS</Text>

      <View style={styles.playerBlock}>
        <View style={styles.portrait}>
          <Image source={mockImage} style={styles.portraitImage} resizeMode="cover" />
        </View>
        <View style={styles.playerStats}>
          <Text style={styles.playerName}>{player.displayName}</Text>
          <Text style={styles.playerLevel}>Level {player.level}</Text>
          <View style={styles.barRow}>
            <ProgressBar value={player.stats.health} max={player.stats.healthMax} color={colors.green} height={16} />
            <Text style={styles.barText}>{player.stats.health} / {player.stats.healthMax}</Text>
          </View>
          <View style={styles.barRow}>
            <ProgressBar value={player.stats.mana} max={player.stats.manaMax} color={colors.blue} height={16} />
            <Text style={styles.barText}>{player.stats.mana} / {player.stats.manaMax}</Text>
          </View>
        </View>
      </View>

      <View style={styles.abilities}>
        {abilities.map((ability) => (
          <Frame key={ability.name} style={styles.ability}>
            <View style={[styles.abilityIcon, { borderColor: ability.color }]}>
              <Text style={[styles.abilityTag, { color: ability.color }]}>{ability.tag}</Text>
            </View>
            <View style={styles.abilityText}>
              <Text style={styles.abilityName}>{ability.name}</Text>
              <Text style={styles.abilityDetail}>{ability.detail}</Text>
            </View>
          </Frame>
        ))}
      </View>

      <Pressable style={styles.runButton}>
        <Text style={styles.runText}>Run Away</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  enemyStage: {
    height: 235,
    overflow: "hidden",
    padding: 24,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  enemyArt: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  enemyShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  enemyName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
  },
  enemyLevel: {
    color: colors.gold,
    marginTop: 4,
  },
  enemyBar: {
    width: 172,
    height: 12,
    marginTop: 18,
  },
  enemyHp: {
    color: colors.text,
    marginLeft: 58,
    marginTop: 8,
  },
  vs: {
    color: colors.gold,
    fontFamily: fonts.title,
    textAlign: "center",
    fontSize: 34,
    marginTop: -18,
  },
  playerBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 18,
  },
  portrait: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.panel,
  },
  portraitImage: {
    width: "100%",
    height: "100%",
  },
  playerStats: {
    flex: 1,
  },
  playerName: {
    color: colors.text,
    fontSize: 18,
  },
  playerLevel: {
    color: colors.gold,
    marginTop: 4,
    marginBottom: 12,
  },
  barRow: {
    height: 18,
    marginBottom: 8,
    justifyContent: "center",
  },
  barText: {
    position: "absolute",
    right: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  abilities: {
    marginTop: 24,
    paddingHorizontal: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ability: {
    width: "48%",
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  abilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  abilityTag: {
    fontWeight: "800",
    fontSize: 11,
  },
  abilityText: {
    flex: 1,
  },
  abilityName: {
    color: colors.text,
    fontSize: 14,
  },
  abilityDetail: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  runButton: {
    marginHorizontal: 24,
    marginTop: 24,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: "rgba(24,20,14,0.9)",
  },
  runText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
});
