import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

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
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const contentType = asset.mimeType || blob.type || "image/jpeg";
  const extension = contentType.includes("/") ? contentType.split("/").pop() || "jpg" : "jpg";

  return {
    previewUrl: asset.uri,
    fileName: asset.fileName || `character-photo-${Date.now()}.${extension}`,
    contentType,
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
