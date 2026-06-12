import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");

const destinations = [
  { id: "grayfen-road", name: "Grayfen Road", detail: "Safe route", left: "28%", top: "62%" },
  { id: "hollow-watch", name: "Hollow Watch", detail: "Encounter risk", left: "56%", top: "41%" },
  { id: "bracken-gate", name: "Bracken Gate", detail: "Story route", left: "72%", top: "70%" },
] as const;

export function MapScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>The Forgotten Marches</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <ImageBackground source={forgottenMarches} style={styles.map} imageStyle={styles.mapImage}>
          <View style={styles.mapOverlay}>
            {destinations.map((destination) => (
              <Pressable
                key={destination.id}
                style={[styles.marker, { left: destination.left, top: destination.top }]}
              >
                <View style={styles.markerDot} />
                <Text style={styles.markerName}>{destination.name}</Text>
                <Text style={styles.markerDetail}>{destination.detail}</Text>
              </Pressable>
            ))}
          </View>
        </ImageBackground>
      </View>

      <Frame style={styles.panel}>
        <Text style={styles.sectionTitle}>Active Journey</Text>
        <Text style={styles.destination}>Grayfen Road to Hollow Watch</Text>
        <Text style={styles.copy}>Travel progress will sync with real-world movement. Encounters appear here without leaving the Map tab.</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>2.1 / 5.0 mi</Text>
          <Text style={styles.progressLabel}>42%</Text>
        </View>
        <ProgressBar value={42} max={100} color={colors.blue} height={9} />
      </Frame>

      <Frame style={styles.panel}>
        <Text style={styles.sectionTitle}>Encounter Watch</Text>
        <View style={styles.encounterCard}>
          <View>
            <Text style={styles.encounterTitle}>Roadside Threat</Text>
            <Text style={styles.copy}>Battle UI will unfold here when travel triggers an encounter.</Text>
          </View>
          <Text style={styles.encounterState}>Dormant</Text>
        </View>
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
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 19,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  mapWrap: {
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    backgroundColor: "#071011",
  },
  map: {
    width: "100%",
    aspectRatio: 0.78,
  },
  mapImage: {
    resizeMode: "cover",
  },
  mapOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  marker: {
    position: "absolute",
    width: 118,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(213, 164, 65, 0.82)",
    backgroundColor: "rgba(4, 6, 6, 0.78)",
    padding: 8,
    transform: [{ translateX: -40 }, { translateY: -26 }],
  },
  markerDot: {
    position: "absolute",
    left: 10,
    top: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.blue,
  },
  markerName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  markerDetail: {
    color: colors.goldSoft,
    marginTop: 3,
    fontSize: 11,
  },
  panel: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  destination: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: colors.blue,
    fontWeight: "800",
  },
  encounterCard: {
    minHeight: 74,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  encounterTitle: {
    color: colors.text,
    fontWeight: "900",
    marginBottom: 4,
  },
  encounterState: {
    color: colors.gold,
    fontWeight: "900",
  },
});
