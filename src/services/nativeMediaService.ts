import { Platform } from "react-native";

export type PickedImage = {
  previewUrl: string;
  fileName: string;
  contentType: string;
  uploadBody: Blob | File;
};

export type PhotoSource = "camera" | "library";

type ImagePickerModule = typeof import("expo-image-picker");
type ImageManipulatorModule = typeof import("expo-image-manipulator");

async function loadImagePicker(): Promise<ImagePickerModule> {
  return await import("expo-image-picker");
}

async function loadImageManipulator(): Promise<ImageManipulatorModule> {
  return await import("expo-image-manipulator");
}

export async function pickCharacterPhoto(source: PhotoSource = "library"): Promise<PickedImage | null> {
  if (Platform.OS === "web") {
    return pickWebImage();
  }

  const ImagePicker = await loadImagePicker();
  const permission = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === "camera" ? "Camera permission is required to take a character photo." : "Photo library permission is required to choose a character photo.");
  }

  const pickerOptions = {
    allowsEditing: false,
    quality: 0.86,
  } satisfies Parameters<ImagePickerModule["launchCameraAsync"]>[0];

  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  const normalized = await normalizeImage(asset.uri);
  const response = await fetch(normalized.uri);
  const blob = await response.blob();

  return {
    previewUrl: normalized.uri,
    fileName: `character-photo-${Date.now()}.jpg`,
    contentType: normalized.contentType,
    uploadBody: blob,
  };
}

async function normalizeImage(uri: string): Promise<{ uri: string; contentType: string }> {
  try {
    const ImageManipulator = await loadImageManipulator();
    const normalized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return {
      uri: normalized.uri,
      contentType: "image/jpeg",
    };
  } catch (error) {
    console.warn("[native-media] image normalization failed, using picker asset", error);
    return {
      uri,
      contentType: "image/jpeg",
    };
  }
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
