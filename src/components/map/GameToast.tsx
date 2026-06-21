import { Pressable, StyleSheet, Text, View } from "react-native";
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
  rewards?: GameToastReward[];
  nextMarker?: MapMarker | null;
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
        <Text style={styles.overline}>{toast.nextMarker ? "Next Step" : "Notice"}</Text>
        <Text style={styles.title}>{toast.title}</Text>
        <Text style={styles.message}>{toast.message}</Text>
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
            <MarkerIcon marker={toast.nextMarker} compact />
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

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 14,
    left: 12,
    right: 12,
    zIndex: 999,
    alignItems: "center",
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
    marginBottom: 6,
  },
  message: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 14,
    lineHeight: 20,
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
