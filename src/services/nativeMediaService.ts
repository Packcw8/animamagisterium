import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

export type PickedImage = {
  previewUrl: string;
  fileName: string;
  contentType: string;
  uploadBody: Blob | File;
};

export async function pickCharacterPhoto(): Promise<PickedImage | null> {
  if (Platform.OS === "web") {
    return pickWebImage();
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required to take a character photo.");
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.86,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  const normalized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1024 } }],
    {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const response = await fetch(normalized.uri);
  const blob = await response.blob();

  return {
    previewUrl: normalized.uri,
    fileName: `character-photo-${Date.now()}.jpg`,
    contentType: "image/jpeg",
    uploadBody: blob,
  };
}

function pickWebImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "user";
    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      resolve({
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        contentType: file.type || "image/png",
        uploadBody: file,
      });
    };
    input.click();
  });
}
