import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Native boot OK</Text>
        <Text style={styles.message}>React Native rendered before loading game systems.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020807",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#d9a441",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "#f4ead8",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
    textAlign: "center",
  },
});
