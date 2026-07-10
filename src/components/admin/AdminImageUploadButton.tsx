import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { pickAndUploadAdminImage } from "../../services/adminImageService";
import { colors, fonts } from "../theme";

type AdminImageUploadButtonProps = {
  folder: string;
  onUploaded: (url: string) => void;
  onMessage?: (message: string) => void;
};

export function AdminImageUploadButton({ folder, onUploaded, onMessage }: AdminImageUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    setUploading(true);
    setMessage(null);
    try {
      const url = await pickAndUploadAdminImage(folder);
      onUploaded(url);
      setMessage("Image uploaded.");
      onMessage?.("Image uploaded and URL added.");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unable to upload image.";
      setMessage(nextMessage);
      onMessage?.(nextMessage);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.uploadControl}>
      <Pressable style={[styles.secondaryButton, uploading && styles.disabledAction]} onPress={() => void upload()} disabled={uploading}>
        <Text style={styles.secondaryText}>{uploading ? "Uploading..." : "Upload Image"}</Text>
      </Pressable>
      {message ? <Text style={styles.debugLine}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  disabledAction: {
    opacity: 0.5,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  uploadControl: {
    gap: 6,
  },
});
