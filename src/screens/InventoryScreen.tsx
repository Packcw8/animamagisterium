import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { inventory, player, skills } from "../data/mockData";

const mockImage = require("../../assets/mockanimamagisterium.png");

export function InventoryScreen() {
  const [tab, setTab] = useState<"equipment" | "skills" | "resources">("equipment");
  const featured = inventory[0];

  return (
    <Screen>
      <Header title="Inventory" />
      <View style={styles.tabs}>
        <Tab label="Equipment" active={tab === "equipment"} onPress={() => setTab("equipment")} />
        <Tab label="Skills" active={tab === "skills"} onPress={() => setTab("skills")} />
        <Tab label="Resources" active={tab === "resources"} onPress={() => setTab("resources")} />
      </View>

      {tab === "equipment" ? (
        <>
          <View style={styles.equipment}>
            <View style={styles.leftSlots}>
              {inventory.map((item) => (
                <Slot key={item.id} label={item.slot.slice(0, 2).toUpperCase()} color={item.color} />
              ))}
            </View>
            <View style={styles.character}>
              <Image source={mockImage} style={styles.characterImage} resizeMode="cover" />
              <View style={styles.characterShade} />
              <Text style={styles.characterName}>{player.displayName}</Text>
            </View>
            <View style={styles.rightSlots}>
              <Slot label="HD" color="#469be8" />
              <Slot label="AR" color="#469be8" />
              <Slot label="BT" color="#63c64c" />
              <Slot label="NK" color={colors.border} />
            </View>
          </View>

          <Frame style={styles.itemCard}>
            <View style={[styles.itemArt, { borderColor: featured.color }]}>
              <Text style={[styles.itemArtText, { color: featured.color }]}>BW</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: featured.color }]}>{featured.name}</Text>
              <Text style={styles.itemRarity}>{featured.rarity} {featured.slot}</Text>
              <Text style={styles.itemStat}>+{featured.attack} Attack</Text>
              <Text style={styles.itemStat}>+{featured.dexterity} Dexterity</Text>
              <Text style={styles.itemRequirement}>Level {featured.requiredLevel} Required</Text>
            </View>
          </Frame>
        </>
      ) : tab === "skills" ? (
        <View style={styles.skillsPanel}>
          <Text style={styles.available}>Available Points: 2</Text>
          {skills.map((skill) => (
            <Frame key={skill.id} style={styles.skillRow}>
              <View style={[styles.skillIcon, { borderColor: skill.color }]}>
                <Text style={[styles.skillTag, { color: skill.color }]}>{skill.icon}</Text>
              </View>
              <View style={styles.skillInfo}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <Text style={styles.skillLevel}>{skill.group} - Level {skill.level}</Text>
              </View>
              <View style={styles.skillProgress}>
                <Text style={styles.progressText}>{skill.progress} / {skill.target}</Text>
                <ProgressBar value={skill.progress} max={skill.target} color={skill.color} height={6} />
              </View>
            </Frame>
          ))}
        </View>
      ) : (
        <View style={styles.resourcesPanel}>
          <Frame style={styles.resourceCard}>
            <Text style={styles.resourceAmount}>2,450</Text>
            <Text style={styles.resourceLabel}>Gold Coins</Text>
          </Frame>
          <Frame style={styles.resourceCard}>
            <Text style={styles.resourceAmount}>260</Text>
            <Text style={styles.resourceLabel}>Gems</Text>
          </Frame>
          <Frame style={styles.resourceCard}>
            <Text style={styles.resourceAmount}>18</Text>
            <Text style={styles.resourceLabel}>Crafting Shards</Text>
          </Frame>
        </View>
      )}

      <View style={styles.profileStrip}>
        <Text style={styles.stripTitle}>Skills Snapshot</Text>
        {skills.slice(0, 3).map((skill) => (
          <View key={skill.id} style={styles.stripRow}>
            <Text style={styles.stripName}>{skill.name}</Text>
            <Text style={styles.stripLevel}>Level {skill.level}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.activeTab]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

function Slot({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.slot, { borderColor: color }]}>
      <Text style={[styles.slotText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
  },
  activeTab: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(62, 43, 22, 0.42)",
  },
  tabButton: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  tabText: {
    color: colors.text,
  },
  activeTabText: {
    color: colors.gold,
  },
  equipment: {
    height: 410,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 34,
    gap: 14,
  },
  leftSlots: {
    width: 74,
    gap: 18,
  },
  rightSlots: {
    width: 74,
    gap: 18,
  },
  slot: {
    height: 72,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 15, 14, 0.92)",
  },
  slotText: {
    fontWeight: "800",
  },
  character: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  characterImage: {
    width: "100%",
    height: "100%",
  },
  characterShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  characterName: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    color: colors.text,
    fontWeight: "700",
  },
  itemCard: {
    margin: 18,
    padding: 16,
    flexDirection: "row",
    gap: 16,
  },
  itemArt: {
    width: 94,
    height: 112,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  itemArtText: {
    fontSize: 24,
    fontWeight: "800",
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontFamily: fonts.title,
    fontSize: 20,
    textTransform: "uppercase",
  },
  itemRarity: {
    color: "#c48dff",
    marginTop: 4,
    marginBottom: 12,
  },
  itemStat: {
    color: colors.text,
    marginBottom: 6,
  },
  itemRequirement: {
    color: colors.muted,
    marginTop: 4,
  },
  profileStrip: {
    marginHorizontal: 18,
    marginBottom: 18,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 14,
  },
  stripTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  stripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  stripName: {
    color: colors.text,
  },
  stripLevel: {
    color: colors.muted,
  },
  skillsPanel: {
    padding: 18,
    gap: 10,
  },
  available: {
    color: colors.gold,
    textAlign: "right",
    marginBottom: 4,
  },
  skillRow: {
    minHeight: 66,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
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
  },
  skillLevel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  skillProgress: {
    width: 112,
    gap: 6,
  },
  progressText: {
    color: colors.text,
    textAlign: "right",
    fontSize: 12,
  },
  resourcesPanel: {
    padding: 18,
    gap: 12,
  },
  resourceCard: {
    padding: 18,
  },
  resourceAmount: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 26,
  },
  resourceLabel: {
    color: colors.text,
    marginTop: 4,
  },
});
