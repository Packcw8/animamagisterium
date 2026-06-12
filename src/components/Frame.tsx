import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "./theme";

type FrameProps = PropsWithChildren<{
  style?: ViewStyle | ViewStyle[];
}>;

export function Frame({ children, style }: FrameProps) {
  return <View style={[styles.frame, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: "rgba(18, 15, 11, 0.92)",
  },
});
