import { AppRegistry, StyleSheet, Text, View } from "react-native";

function NativeBootApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Direct RN boot OK</Text>
      <Text style={styles.message}>AppRegistry rendered without Expo AppEntry.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#3f1234",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "#ffe1f2",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
    textAlign: "center",
  },
});

AppRegistry.registerComponent("main", () => NativeBootApp);
