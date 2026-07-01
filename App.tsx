import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Native boot OK</Text>
      <Text style={styles.message}>React Native rendered before loading game systems.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "#d7ffe6",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
    textAlign: "center",
  },
});
