import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { player } from "../data/mockData";

const mockImage = require("../../assets/mockanimamagisterium.png");

export function HomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Image source={mockImage} style={styles.heroArt} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.identity}>
          <Text style={styles.name}>{player.displayName}</Text>
          <Text style={styles.subtitle}>Level {player.level}  {player.title}</Text>
          <View style={styles.xpRow}>
            <ProgressBar value={player.xp} max={player.xpMax} color={colors.blue} />
          </View>
          <Text style={styles.xpText}>{player.xp.toLocaleString()} / {player.xpMax.toLocaleString()} XP</Text>
        </View>
      </View>

      <Frame style={styles.statPanel}>
        <Stat label="Health" value={player.stats.health} max={player.stats.healthMax} color={colors.red} />
        <Stat label="Mana" value={player.stats.mana} max={player.stats.manaMax} color={colors.blue} />
        <Stat label="Stamina" value={player.stats.stamina} max={player.stats.staminaMax} color={colors.yellow} />
      </Frame>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>View Character</Text>
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Attributes</Text>
        <Text style={styles.points}>Points Available: 2</Text>
      </View>

      <Frame style={styles.attributes}>
        {player.attributes.map((attribute) => (
          <View key={attribute.name} style={styles.attributeRow}>
            <View style={[styles.attributeIcon, { borderColor: attribute.color }]}>
              <Text style={[styles.attributeInitial, { color: attribute.color }]}>{attribute.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={styles.attributeName}>{attribute.name}</Text>
            <Text style={styles.attributeValue}>{attribute.value}</Text>
            <Text style={styles.chevron}>{">"}</Text>
          </View>
        ))}
      </Frame>
    </Screen>
  );
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBar}>
        <ProgressBar value={value} max={max} color={color} />
      </View>
      <Text style={styles.statValue}>{value} / {max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 360,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    zIndex: 3,
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    letterSpacing: 0,
  },
  heroArt: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,5,4,0.48)",
  },
  identity: {
    position: "absolute",
    right: 18,
    bottom: 42,
    width: "52%",
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 15,
  },
  xpRow: {
    height: 10,
    marginTop: 16,
  },
  xpText: {
    color: colors.text,
    textAlign: "right",
    marginTop: 8,
    fontSize: 13,
  },
  statPanel: {
    marginHorizontal: 18,
    marginTop: -34,
    padding: 14,
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statLabel: {
    color: colors.text,
    width: 64,
    fontSize: 13,
  },
  statBar: {
    flex: 1,
    height: 8,
  },
  statValue: {
    color: colors.text,
    width: 72,
    textAlign: "right",
    fontSize: 12,
  },
  button: {
    marginHorizontal: 18,
    marginTop: 14,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 6,
    backgroundColor: "rgba(26,22,16,0.9)",
  },
  buttonText: {
    color: colors.gold,
    fontSize: 15,
  },
  sectionHead: {
    marginTop: 22,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  points: {
    color: colors.muted,
    fontSize: 12,
  },
  attributes: {
    marginHorizontal: 18,
    marginTop: 10,
    paddingVertical: 8,
  },
  attributeRow: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  attributeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  attributeInitial: {
    fontSize: 10,
    fontWeight: "700",
  },
  attributeName: {
    color: colors.text,
    flex: 1,
  },
  attributeValue: {
    color: colors.text,
    width: 30,
    textAlign: "right",
  },
  chevron: {
    color: colors.gold,
    width: 26,
    textAlign: "right",
  },
});
