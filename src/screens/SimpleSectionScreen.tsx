import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase } from "../lib/supabase";

type SimpleSectionScreenProps = {
  title: string;
  description: string;
  showSignOut?: boolean;
};

export function SimpleSectionScreen({ title, description, showSignOut = false }: SimpleSectionScreenProps) {
  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>{title}</Text>
        </View>
      </View>
      <Frame style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {showSignOut ? (
          <Pressable style={styles.button} onPress={() => void supabase.auth.signOut()}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </Pressable>
        ) : null}
      </Frame>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  card: {
    margin: 12,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
  },
  description: {
    color: colors.muted,
    lineHeight: 21,
  },
  button: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  buttonText: {
    color: "#120e08",
    fontWeight: "900",
  },
});
