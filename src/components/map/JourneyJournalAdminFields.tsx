import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../theme";

type JourneyJournalAdminFieldsProps = {
  title: string;
  body: string;
  imageUrl: string;
  sortOrder: string;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  onChangeImageUrl: (value: string) => void;
  onChangeSortOrder: (value: string) => void;
};

export function JourneyJournalAdminFields({
  title,
  body,
  imageUrl,
  sortOrder,
  onChangeTitle,
  onChangeBody,
  onChangeImageUrl,
  onChangeSortOrder,
}: JourneyJournalAdminFieldsProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Journey Journal Entry</Text>
      <Text style={styles.copy}>Optional admin-written story text. Players see this in Home / Journal only after they complete this marker or walking path.</Text>
      <TextInput value={title} onChangeText={onChangeTitle} placeholder="Journal title" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={body} onChangeText={onChangeBody} placeholder="Journal story text" placeholderTextColor={colors.muted} style={[styles.input, styles.textArea]} multiline />
      <TextInput value={imageUrl} onChangeText={onChangeImageUrl} placeholder="Journal image URL or asset path optional" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={sortOrder} onChangeText={onChangeSortOrder} placeholder="Journal order, example 10" placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  textArea: {
    minHeight: 110,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
    textTransform: "uppercase",
  },
});
