import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export type MarkerIconSource = {
  type: string;
  icon_label?: string | null;
  icon_image_url?: string | null;
  icon_color?: string | null;
  marker_size?: number | null;
};

export function MarkerIcon({ marker, compact = false, mini = false }: { marker: MarkerIconSource; compact?: boolean; mini?: boolean }) {
  const iconUri = resolveMapImageUri(marker.icon_image_url);
  const iconText = (marker.icon_label?.trim() || getDefaultMarkerIconLabel(marker.type)).slice(0, 3).toUpperCase();
  const iconColor = marker.icon_color?.trim() || getDefaultMarkerIconColor(marker.type);
  const iconStyle = mini ? styles.miniMapMarkerIcon : compact ? styles.legendIcon : styles.markerIcon;
  const imageStyle = mini ? styles.miniMapMarkerIconImage : compact ? styles.legendIconImage : styles.markerIconImage;
  const textStyle = mini ? styles.miniMapMarkerIconText : compact ? styles.legendIconText : styles.markerIconText;
  const sizeScale = compact ? 1 : Math.max(0.5, Math.min(2.2, Number(marker.marker_size ?? 100) / 100 || 1));
  const baseIconSize = mini ? 18 : compact ? 34 : 25;
  const iconSize = Math.round(baseIconSize * sizeScale);
  const baseFontSize = mini ? 6 : compact ? 11 : 8;

  return (
    <View style={[iconStyle, { borderColor: iconColor, width: iconSize, height: iconSize, borderRadius: iconSize / 2 } as object]}>
      {iconUri ? (
        <Image source={{ uri: iconUri }} style={imageStyle} />
      ) : (
        <Text style={[textStyle, { color: iconColor, fontSize: Math.max(6, Math.round(baseFontSize * sizeScale)) } as object]}>{iconText}</Text>
      )}
    </View>
  );
}

function resolveMapImageUri(imagePath?: string | null) {
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

function getDefaultMarkerIconLabel(type: string) {
  if (type === "Market") return "MKT";
  if (type === "Sign Post") return "SIG";
  if (type === "World Spawn") return "WSP";
  if (type === "Player Spawn") return "SPN";
  if (type === "Area/Town Entrance") return "IN";
  if (type === "Battle" || type === "Battle Zone") return "BTL";
  if (type === "Quest" || type === "Side Quest" || type === "Story") return "!";
  if (type === "Training" || type === "Training Spot") return "TRN";
  if (type === "Dungeon Room") return "DGN";
  if (type === "Exit") return "EXT";
  if (type === "Exit/Leave") return "OUT";
  if (type === "Point of Interest") return "POI";
  return "*";
}

function getDefaultMarkerIconColor(type: string) {
  if (type === "Market") return colors.gold;
  if (type === "Sign Post") return "#f0d28a";
  if (type === "World Spawn") return "#7fe7ff";
  if (type === "Player Spawn") return colors.blue;
  if (type === "Area/Town Entrance") return colors.blue;
  if (type === "Battle" || type === "Battle Zone") return "#e0574f";
  if (type === "Quest" || type === "Side Quest" || type === "Story") return "#8fe8a1";
  if (type === "Training" || type === "Training Spot") return "#7fe7ff";
  if (type === "Dungeon Room") return "#b889ff";
  if (type === "Exit") return "#f0d28a";
  if (type === "Exit/Leave") return colors.muted;
  if (type === "Point of Interest") return "#f0d28a";
  return colors.goldSoft;
}

const styles = StyleSheet.create({
  markerIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: "rgba(4, 6, 6, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#7fe7ff",
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  markerIconImage: {
    width: "100%",
    height: "100%",
  },
  markerIconText: {
    fontSize: 8,
    fontWeight: "900",
  },
  miniMapMarkerIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: "rgba(4, 6, 6, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#7fe7ff",
    shadowOpacity: 0.42,
    shadowRadius: 5,
  },
  miniMapMarkerIconImage: {
    width: "100%",
    height: "100%",
  },
  miniMapMarkerIconText: {
    fontSize: 6,
    fontWeight: "900",
  },
  legendIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    backgroundColor: "rgba(4, 6, 6, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  legendIconImage: {
    width: "100%",
    height: "100%",
  },
  legendIconText: {
    fontSize: 11,
    fontWeight: "900",
  },
});
