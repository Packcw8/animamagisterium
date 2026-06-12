import { PropsWithChildren } from "react";
import { ImageBackground, ScrollView, StyleSheet, View } from "react-native";
import { colors } from "./theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

const mockImage = require("../../assets/mockanimamagisterium.png");

export function Screen({ children, scroll = true }: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;

  return (
    <ImageBackground source={mockImage} resizeMode="cover" style={styles.bg} imageStyle={styles.bgImage}>
      <View style={styles.scrim}>
        {scroll ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bgImage: {
    opacity: 0.11,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(2, 4, 4, 0.84)",
  },
  scroll: {
    paddingBottom: 18,
  },
  content: {
    flex: 1,
  },
});
