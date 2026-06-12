import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { regions } from "../data/mockData";

const mockImage = require("../../assets/mockanimamagisterium.png");

export function MapScreen() {
  return (
    <Screen scroll={false}>
      <Header title="World Map" />
      <View style={styles.wallet}>
        <Text style={styles.walletPill}>CO 2,450</Text>
        <Text style={styles.walletPill}>GM 260</Text>
        <Text style={styles.menu}>...</Text>
      </View>
      <ImageBackground source={mockImage} style={styles.map} resizeMode="cover" imageStyle={styles.mapImage}>
        <View style={styles.mapShade} />
        <View style={styles.routeOne} />
        <View style={styles.routeTwo} />
        {regions.map((region) => (
          <View key={region.id} style={[styles.region, { left: region.left, top: region.top }]}>
            <View style={[styles.node, !region.locked && styles.activeNode]}>
              <Text style={styles.nodeText}>{region.locked ? "LK" : "SH"}</Text>
            </View>
            <Text style={styles.regionName}>{region.name}</Text>
            <Text style={styles.regionGate}>{region.levelGate}</Text>
          </View>
        ))}
        <Frame style={styles.crest}>
          <Text style={styles.crestText}>AM</Text>
        </Frame>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>View Region</Text>
        </Pressable>
      </ImageBackground>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wallet: {
    position: "absolute",
    top: 70,
    right: 14,
    zIndex: 4,
    flexDirection: "row",
    gap: 8,
  },
  walletPill: {
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.66)",
    overflow: "hidden",
    fontSize: 12,
  },
  menu: {
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.66)",
    overflow: "hidden",
  },
  map: {
    flex: 1,
    overflow: "hidden",
  },
  mapImage: {
    opacity: 0.72,
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 11, 8, 0.38)",
  },
  routeOne: {
    position: "absolute",
    left: "24%",
    top: "43%",
    width: "54%",
    borderTopWidth: 2,
    borderColor: "rgba(218,170,88,0.55)",
    borderStyle: "dashed",
    transform: [{ rotate: "20deg" }],
  },
  routeTwo: {
    position: "absolute",
    left: "32%",
    top: "64%",
    width: "40%",
    borderTopWidth: 2,
    borderColor: "rgba(218,170,88,0.55)",
    borderStyle: "dashed",
    transform: [{ rotate: "-22deg" }],
  },
  region: {
    position: "absolute",
    alignItems: "center",
    width: 130,
    marginLeft: -65,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12100d",
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeNode: {
    width: 70,
    height: 82,
    borderRadius: 8,
    backgroundColor: "rgba(45, 86, 35, 0.92)",
  },
  nodeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  regionName: {
    color: colors.text,
    fontFamily: fonts.title,
    marginTop: 8,
    textTransform: "uppercase",
    fontSize: 15,
  },
  regionGate: {
    color: colors.text,
    fontSize: 12,
    marginTop: 3,
  },
  crest: {
    position: "absolute",
    left: "50%",
    top: "44%",
    width: 64,
    height: 74,
    marginLeft: -32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(53, 87, 36, 0.95)",
  },
  crestText: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  button: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 26,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: "rgba(25,21,15,0.94)",
  },
  buttonText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 16,
    textTransform: "uppercase",
  },
});
