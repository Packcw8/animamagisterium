import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { colors } from "./theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView style={styles.bg}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 128,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 12,
  },
});
