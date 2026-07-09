import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../theme";

type JourneyRecoveryActionProps = {
  disabled?: boolean;
  onRecover: () => void;
};

export function JourneyRecoveryAction({ disabled = false, onRecover }: JourneyRecoveryActionProps) {
  return (
    <Pressable style={[styles.button, disabled && styles.disabled]} onPress={onRecover} disabled={disabled}>
      <Text style={styles.text}>Recover Position</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexGrow: 1,
    minWidth: 150,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(24, 178, 242, 0.55)",
    backgroundColor: "rgba(24, 178, 242, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.blue,
    fontWeight: "900",
  },
});
