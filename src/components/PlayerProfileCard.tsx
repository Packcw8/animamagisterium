import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Frame } from "./Frame";
import { colors, fonts } from "./theme";
import { CachedGameImage } from "./ui/CachedGameImage";
import type { BadgeDefinition, EarnedBadgeSummary } from "../services/badgeService";
import type { LeaderboardRow } from "../services/leaderboardService";
import { resolveGameAssetUri } from "../utils/assetResolver";

type PlayerProfileCardProps = {
  profile: LeaderboardRow;
  badges?: EarnedBadgeSummary[];
  title?: string;
};

export function PlayerProfileCard({ profile, badges = [], title = "Player Profile" }: PlayerProfileCardProps) {
  return (
    <Frame style={styles.card}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.hero}>
        <View style={styles.portraitWrap}>
          {profile.portrait_url ? <CachedGameImage uri={profile.portrait_url} style={styles.portrait} /> : <Text style={styles.initial}>{profile.character_name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.name} numberOfLines={1}>{profile.character_name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{profile.display_name}</Text>
          <View style={styles.pillRow}>
            <Text style={styles.pill}>Level {profile.level}</Text>
            <Text style={styles.pill}>{profile.xp.toLocaleString()} XP</Text>
            <Text style={styles.pill}>{profile.gold.toLocaleString()} Gold</Text>
          </View>
        </View>
      </View>

      <View style={styles.statGrid}>
        <ProfileStat label="Distance" value={formatDistance(profile.total_distance_walked_meters)} />
        <ProfileStat label="Attributes" value={profile.attribute_total.toLocaleString()} />
        <ProfileStat label="Training" value={profile.training_sessions_completed.toLocaleString()} />
        <ProfileStat label="Events" value={profile.event_completions.toLocaleString()} />
        <ProfileStat label="Enemy Kills" value={profile.total_enemy_kills.toLocaleString()} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gear</Text>
        <Text style={styles.copy}>Gear showcase is ready for public loadout data once equipment privacy rules are finalized.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        {badges.length === 0 ? <Text style={styles.copy}>No earned badges visible yet.</Text> : null}
        <View style={styles.badgeRow}>
          {badges.slice(0, 8).map((entry) => (
            <ProfileBadge key={entry.badge.id} badge={entry.badge} />
          ))}
        </View>
      </View>
    </Frame>
  );
}

function ProfileBadge({ badge }: { badge: BadgeDefinition }) {
  const [failed, setFailed] = useState(false);
  const imageUri = resolveBadgeImageUri(badge.icon_url);
  const fallbackText = badge.icon_label || badge.title.slice(0, 3).toUpperCase();

  return (
    <View style={styles.badgeTile}>
      <View style={styles.badgePill}>
        {imageUri && !failed ? (
          <Image source={{ uri: imageUri }} style={styles.badgeImage} resizeMode="cover" onError={() => setFailed(true)} />
        ) : (
          <Text style={styles.badgeText}>{fallbackText}</Text>
        )}
      </View>
      <Text style={styles.badgeLabel} numberOfLines={1}>{badge.title}</Text>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDistance(meters: number) {
  if (meters < 160.9344) {
    return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
  }

  return `${(meters / 1609.344).toFixed(2)} mi`;
}

function resolveBadgeImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "icon");
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 14,
  },
  eyebrow: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  portraitWrap: {
    width: 82,
    height: 82,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#061118",
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 24,
  },
  subtitle: {
    color: colors.goldSoft,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  pill: {
    color: colors.muted,
    fontSize: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  statValue: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 15,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  section: {
    gap: 8,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
  },
  sectionTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeTile: {
    width: 58,
    alignItems: "center",
    gap: 5,
  },
  badgePill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217, 170, 93, 0.12)",
    overflow: "hidden",
  },
  badgeImage: {
    width: "100%",
    height: "100%",
  },
  badgeText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 11,
  },
  badgeLabel: {
    color: colors.muted,
    fontSize: 9,
    maxWidth: 58,
    textAlign: "center",
  },
});
