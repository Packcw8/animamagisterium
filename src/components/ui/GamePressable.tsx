import React from "react";
import { Pressable as NativePressable, Platform, StyleSheet } from "react-native";

type NativePressableProps = React.ComponentProps<typeof NativePressable>;

type GamePressableProps = NativePressableProps & {
  feedbackDisabled?: boolean;
};

export function GamePressable({ disabled, feedbackDisabled, style, ...props }: GamePressableProps) {
  return (
    <NativePressable
      {...props}
      disabled={disabled}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        !feedbackDisabled && !disabled && state.pressed && styles.pressed,
        Platform.OS === "web" && !disabled && styles.webCursor,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  webCursor: {
    cursor: "pointer",
  } as object,
});
