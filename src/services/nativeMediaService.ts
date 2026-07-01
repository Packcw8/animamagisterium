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
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Camera permission is required to take a character photo.");
    }
  }

  const pickerOptions = {
    allowsEditing: false,
    mediaTypes: ["images"],
    quality: 0.86,
    base64: false,
  } satisfies Parameters<ImagePickerModule["launchCameraAsync"]>[0];

  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  const normalized = await normalizeImage(asset.uri);
  const response = await fetch(normalized.dataUri);
  const blob = await response.blob();

  return {
    previewUrl: normalized.uri,
    fileName: `character-photo-${Date.now()}.jpg`,
    contentType: normalized.contentType,
    uploadBody: blob,
  };
}

async function normalizeImage(uri: string): Promise<{ uri: string; dataUri: string; contentType: string }> {
  try {
    const ImageManipulator = await loadImageManipulator();
    const normalized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      {
        base64: true,
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    if (!normalized.base64) {
      throw new Error("Image normalization did not return JPEG data.");
    }

    return {
      uri: normalized.uri,
      dataUri: `data:image/jpeg;base64,${normalized.base64}`,
      contentType: "image/jpeg",
    };
  } catch (error) {
    console.warn("[native-media] image normalization failed", error);
    throw new Error("The image could not be prepared for avatar generation. Try a different photo or choose Custom Avatar.");
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
