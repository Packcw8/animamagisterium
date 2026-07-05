import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AdminHubCard } from "../components/admin/AdminHubCard";
import { AdminHubSection } from "../components/admin/AdminHubSection";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { getCurrentRole, type Role } from "../services/mapService";

type AdminScreenProps = {
  onBack: () => void;
  onOpenHomeAdmin: () => void;
  onOpenMapAdmin: (section?: string) => void;
  onOpenTrainingAdmin: () => void;
  onOpenAchievementsAdmin: () => void;
};

type AdminSectionKey = "content" | "systems" | "publishing";

export function AdminScreen({
  onBack,
  onOpenHomeAdmin,
  onOpenMapAdmin,
  onOpenTrainingAdmin,
  onOpenAchievementsAdmin,
}: AdminScreenProps) {
  const [role, setRole] = useState<Role>("player");
  const [openSections, setOpenSections] = useState<Record<AdminSectionKey, boolean>>({
    content: true,
    systems: true,
    publishing: false,
  });

  useEffect(() => {
    getCurrentRole().then(setRole).catch(() => setRole("player"));
  }, []);

  function toggleSection(section: AdminSectionKey) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  if (role !== "admin") {
    return (
      <Screen>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <BrandLogo size={54} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>Admin</Text>
            <Text style={styles.subtitle}>Restricted</Text>
          </View>
        </View>
        <Frame style={styles.card}>
          <Text style={styles.title}>Admin access required</Text>
          <Text style={styles.copy}>This page is only available to admin accounts.</Text>
        </Frame>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>Admin Sanctum</Text>
          <Text style={styles.subtitle}>Content, systems, and publishing tools</Text>
        </View>
      </View>

      <Frame style={styles.hero}>
        <Text style={styles.title}>Admin Control Center</Text>
        <Text style={styles.copy}>
          This hub keeps admin work separate from player screens while reusing the tools that already work. The next passes can move each builder here piece by piece.
        </Text>
      </Frame>

      <AdminHubSection
        title="World & Story Content"
        summary="Maps, markers, mini maps, walking paths, events, dialogue, journals, and chapter content."
        open={openSections.content}
        onToggle={() => toggleSection("content")}
      >
        <AdminHubCard
          eyebrow="Overworld"
          title="World Map"
          description="Edit the active overworld image, draft image, frame size, and chapter-level map notes."
          status="Opens Map Admin directly to World Map."
          actionLabel="Open World Map"
          onPress={() => onOpenMapAdmin("World Map")}
        />
        <AdminHubCard
          eyebrow="Markers"
          title="World Markers"
          description="Create and tune story, route, market, NPC, battle, point of interest, and area entrance markers on the overworld."
          status="Opens Map Admin directly to World Markers."
          actionLabel="Open World Markers"
          onPress={() => onOpenMapAdmin("World Markers")}
        />
        <AdminHubCard
          eyebrow="Areas"
          title="Mini Maps"
          description="Create towns, forests, dungeons, linked areas, entry behavior, and mini-map marker spaces."
          status="Opens Map Admin directly to Mini Maps."
          actionLabel="Open Mini Maps"
          onPress={() => onOpenMapAdmin("Mini Maps")}
        />
        <AdminHubCard
          eyebrow="Travel"
          title="Walking Paths"
          description="Build and edit trails, hidden segments, journal notes, route locks, and continuation paths."
          status="Opens Map Admin directly to Walking Paths."
          actionLabel="Open Walking Paths"
          onPress={() => onOpenMapAdmin("Walking Paths")}
        />
        <AdminHubCard
          eyebrow="Events"
          title="Events / Rewards"
          description="Manage trail events, battles, rewards, interactions, dialogue hooks, and reusable path moments."
          status="Opens Map Admin directly to Rewards/Interactions."
          actionLabel="Open Events"
          onPress={() => onOpenMapAdmin("Rewards/Interactions")}
        />
        <AdminHubCard
          eyebrow="Map UI"
          title="Legend"
          description="Manage reusable marker styles, icons, labels, colors, and player-facing legend entries."
          status="Opens Map Admin directly to Legend."
          actionLabel="Open Legend"
          onPress={() => onOpenMapAdmin("Legend")}
        />
        <AdminHubCard
          eyebrow="Achievements"
          title="Badges & Player Goals"
          description="Manage achievement-style content, badges, enemy kill goals, story completion goals, and player-facing profile rewards."
          status="Uses existing Achievements admin."
          actionLabel="Open Achievements Admin"
          onPress={onOpenAchievementsAdmin}
        />
      </AdminHubSection>

      <AdminHubSection
        title="Game Systems"
        summary="Inventory, items, abilities, enemies, NPCs, training balance, classes, and progression."
        open={openSections.systems}
        onToggle={() => toggleSection("systems")}
      >
        <AdminHubCard
          eyebrow="Character Systems"
          title="Items, Abilities, Enemies & NPCs"
          description="Open the current Home admin tools for inventory items, abilities, enemy definitions, NPC definitions, carry settings, and combat content."
          status="Future pass can split these into dedicated admin pages."
          actionLabel="Open Home Admin"
          onPress={onOpenHomeAdmin}
        />
        <AdminHubCard
          eyebrow="Progression"
          title="Training & Balance"
          description="Open training admin controls for level caps, daily session rules, attribute images, class backgrounds, and progression text."
          status="Keeps training tuning away from map content."
          actionLabel="Open Training Admin"
          onPress={onOpenTrainingAdmin}
        />
      </AdminHubSection>

      <AdminHubSection
        title="Publishing Workflow"
        summary="A safe place for future validation, content warnings, release checks, and draft/publish controls."
        open={openSections.publishing}
        onToggle={() => toggleSection("publishing")}
      >
        <AdminHubCard
          eyebrow="Coming Next"
          title="Validation Dashboard"
          description="Future checks can show broken dialogue links, missing images, locked markers with no unlock path, empty shops, and chapter subscription gates."
          status="Planning shell only in this pass."
          actionLabel="Review Existing Tools"
          onPress={() => onOpenMapAdmin("Rewards/Interactions")}
        />
      </AdminHubSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backText: {
    color: colors.blue,
    fontWeight: "900",
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  card: {
    gap: 12,
    margin: 12,
    padding: 16,
  },
  copy: {
    color: colors.muted,
    lineHeight: 21,
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  headerText: {
    flex: 1,
  },
  hero: {
    gap: 10,
    margin: 12,
    padding: 16,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 26,
  },
});
