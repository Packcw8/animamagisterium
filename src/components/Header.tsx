import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "./theme";

type HeaderProps = {
  title: string;
  back?: boolean;
};

export function Header({ title, back = true }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.back}>{back ? "<" : ""}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.back}> </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 58,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 18,
    backgroundColor: "rgba(8, 8, 7, 0.98)",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 21,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  back: {
    width: 32,
    color: colors.gold,
    fontSize: 28,
    lineHeight: 32,
  },
});
