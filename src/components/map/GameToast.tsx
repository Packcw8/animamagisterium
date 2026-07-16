import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";
import type { MapMarker } from "../../services/mapService";
import { MarkerIcon } from "./MarkerIcon";

export type GameToastReward = {
  label: string;
  quantity?: number;
};

export type GameToastData = {
  title: string;
  message: string;
  overline?: string;
  iconImageUrl?: string | null;
  soundUrl?: string | null;
  seenFlagKey?: string | null;
  trophy?: {
    name: string;
    species?: string | null;
    imageUrl?: string | null;
    score: number;
    weight?: number | null;
    antlerSpread?: number | null;
    hornLength?: number | null;
    skullSize?: number | null;
    peltQuality?: number | null;
    rarityBonus?: number | null;
  } | null;
  rewards?: GameToastReward[];
  nextMarker?: MapMarker | null;
  nextImageUri?: string | null;
  actionLabel?: string;
};

type GameToastProps = {
  toast: GameToastData | null;
  onDismiss: () => void;
};

export function GameToast({ toast, onDismiss }: GameToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          {toast.iconImageUrl ? <Image source={{ uri: toast.iconImageUrl }} style={styles.toastIconImage} /> : null}
          <View style={styles.headerCopy}>
            <Text style={styles.overline}>{toast.overline ?? (toast.nextMarker ? "Next Step" : "Notice")}</Text>
            <Text style={styles.title}>{toast.title}</Text>
          </View>
        </View>
        <Text style={styles.message}>{toast.message}</Text>
        {toast.trophy ? <TrophyToastCard trophy={toast.trophy} /> : null}
        {toast.rewards && toast.rewards.length > 0 ? (
          <View style={styles.rewardList}>
            {toast.rewards.map((reward) => (
              <View key={`${reward.label}-${reward.quantity ?? 1}`} style={styles.rewardPill}>
                <Text style={styles.rewardText}>{reward.label}{reward.quantity && reward.quantity > 1 ? ` x${reward.quantity}` : ""}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {toast.nextMarker ? (
          <View style={styles.markerRow}>
            <ToastMarkerPreview marker={toast.nextMarker} imageUri={toast.nextImageUri} />
            <View style={styles.markerCopy}>
              <Text style={styles.markerLabel}>Look for</Text>
              <Text style={styles.markerTitle}>{toast.nextMarker.title}</Text>
              <Text style={styles.markerType}>{toast.nextMarker.type}</Text>
            </View>
          </View>
        ) : null}
        <Pressable style={styles.okButton} onPress={onDismiss}>
          <Text style={styles.okText}>{toast.actionLabel ?? "OK"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TrophyToastCard({ trophy }: { trophy: NonNullable<GameToastData["trophy"]> }) {
  const stats = [
    { label: "Score", value: trophy.score > 0 ? trophy.score.toFixed(2) : null },
    { label: "Weight", value: Number(trophy.weight) > 0 ? `${Number(trophy.weight).toFixed(1)} lb` : null },
    { label: "Spread", value: Number(trophy.antlerSpread) > 0 ? `${Number(trophy.antlerSpread).toFixed(1)} in` : null },
    { label: "Horns", value: Number(trophy.hornLength) > 0 ? `${Number(trophy.hornLength).toFixed(1)} in` : null },
    { label: "Skull", value: Number(trophy.skullSize) > 0 ? `${Number(trophy.skullSize).toFixed(1)} in` : null },
    { label: "Pelt", value: Number(trophy.peltQuality) > 0 ? `${Math.round(Number(trophy.peltQuality))}%` : null },
    { label: "Rarity", value: Number(trophy.rarityBonus) > 0 ? `+${Number(trophy.rarityBonus).toFixed(1)}` : null },
  ].filter((stat) => stat.value);

  return (
    <View style={styles.trophyCard}>
      {trophy.imageUrl ? <Image source={{ uri: trophy.imageUrl }} style={styles.trophyImage} /> : <View style={styles.trophyFallback}><Text style={styles.trophyFallbackText}>{trophy.name.slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.trophyCopy}>
        <Text style={styles.trophyOverline}>Trophy Recorded</Text>
        <Text style={styles.trophyName}>{trophy.name}</Text>
        {trophy.species ? <Text style={styles.trophySpecies}>{trophy.species}</Text> : null}
        <View style={styles.trophyStats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.trophyStat}>
              <Text style={styles.trophyStatLabel}>{stat.label}</Text>
              <Text style={styles.trophyStatValue}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ToastMarkerPreview({ marker, imageUri: overrideImageUri }: { marker: MapMarker; imageUri?: string | null }) {
  const imageUri = overrideImageUri || resolveToastMarkerImageUri(marker);

  if (!imageUri) {
    return <MarkerIcon marker={marker} compact />;
  }

  return (
    <View style={styles.markerImageFrame}>
      <Image source={{ uri: imageUri }} style={styles.markerImage} />
      <View style={styles.markerImageIcon}>
        <MarkerIcon marker={marker} compact />
      </View>
    </View>
  );
}

function resolveToastMarkerImageUri(marker: MapMarker) {
  const imagePath =
    marker.scene_background_image_url ||
    marker.quest_image_url ||
    marker.shop_background_image_url ||
    marker.shop_image_url ||
    marker.scene_npc_image_url ||
    marker.icon_image_url;
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 12,
    right: 12,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
    paddingBottom: 110,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "rgba(5, 8, 9, 0.96)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  headerCopy: {
    flex: 1,
  },
  overline: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  toastIconImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  message: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 14,
    lineHeight: 20,
  },
  trophyCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(217, 164, 65, 0.08)",
  },
  trophyImage: {
    width: "100%",
    height: 150,
  },
  trophyFallback: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(36, 24, 12, 0.92)",
  },
  trophyFallbackText: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 42,
  },
  trophyCopy: {
    padding: 12,
  },
  trophyOverline: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  trophyName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  trophySpecies: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 12,
    marginTop: 2,
  },
  trophyStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  trophyStat: {
    minWidth: 78,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: "rgba(0, 0, 0, 0.24)",
  },
  trophyStatLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 10,
    textTransform: "uppercase",
  },
  trophyStatValue: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 13,
    marginTop: 2,
  },
  rewardList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  rewardPill: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(217, 164, 65, 0.1)",
  },
  rewardText: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 12,
  },
  markerCopy: {
    flex: 1,
  },
  markerImageFrame: {
    width: 76,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: "rgba(217, 164, 65, 0.1)",
  },
  markerImage: {
    width: "100%",
    height: "100%",
  },
  markerImageIcon: {
    position: "absolute",
    left: 6,
    bottom: 5,
  },
  markerLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 11,
    textTransform: "uppercase",
  },
  markerTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  markerType: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  okButton: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.gold,
  },
  okText: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
