import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type ClickedPercent = {
  x: number;
  y: number;
};

type AdminCoordinatePanelProps = {
  clickedPercent: ClickedPercent | null;
  tapLabel: string;
  onCopy: () => void;
};

export function AdminCoordinatePanel({ clickedPercent, tapLabel, onCopy }: AdminCoordinatePanelProps) {
  return (
    <>
      <Info label="Clicked Coordinates" value={clickedPercent ? `X ${clickedPercent.x}% / Y ${clickedPercent.y}%` : tapLabel} />
      <Text style={styles.debugLine}>Last click: x: {clickedPercent ? `${clickedPercent.x}%` : "--"}, y: {clickedPercent ? `${clickedPercent.y}%` : "--"}</Text>
      <Pressable style={styles.secondaryButton} onPress={onCopy} disabled={!clickedPercent}>
        <Text style={styles.secondaryText}>Copy Coordinates</Text>
      </Pressable>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
  },
  infoRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  infoValue: {
    color: colors.text,
    flex: 1.2,
    fontWeight: "800",
    textAlign: "right",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
});
