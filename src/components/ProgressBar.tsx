import { DimensionValue, Platform, StyleSheet, View } from "react-native";
import { colors } from "./theme";

type ProgressBarProps = {
  value: number;
  max: number;
  color: string;
  height?: number;
};

export function ProgressBar({ value, max, color, height = 8 }: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%` as DimensionValue;

  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width, backgroundColor: color }, smoothWidthTransition]} />
    </View>
  );
}

const smoothWidthTransition = Platform.OS === "web"
  ? ({
      transitionProperty: "width",
      transitionDuration: "220ms",
      transitionTimingFunction: "ease-out",
    } as never)
  : null;

const styles = StyleSheet.create({
  track: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 99,
    backgroundColor: "#070706",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fill: {
    height: "100%",
    borderRadius: 99,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
});
