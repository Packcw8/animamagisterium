import { Platform } from "react-native";

export type PickedImage = {
  previewUrl: string;
  fileName: string;
  contentType: string;
  uploadBody: Blob | File;
};

export type PhotoSource = "camera" | "library";

type ImagePickerModule = typeof import("expo-image-picker");

async function loadImagePicker(): Promise<ImagePickerModule> {
  return await import("expo-image-picker");
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
    quality: 0.72,
    base64: true,
  } satisfies Parameters<ImagePickerModule["launchCameraAsync"]>[0];

  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error("The image could not be prepared. Try taking a new photo or choose Custom Avatar.");
  }

  const contentType = normalizeImageContentType(asset.mimeType, source);
  const dataUri = `data:${contentType};base64,${asset.base64}`;
  const response = await fetch(dataUri);
  const blob = await response.blob();

  return {
    previewUrl: asset.uri,
    fileName: `character-photo-${Date.now()}.${contentType === "image/png" ? "png" : "jpg"}`,
    contentType,
    uploadBody: blob,
  };
}

function normalizeImageContentType(mimeType: string | undefined, source: PhotoSource) {
  const normalized = mimeType?.toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "image/jpeg";
  }
  if (normalized === "image/png") {
    return "image/png";
  }

  if (source === "camera") {
    return "image/jpeg";
  }

  throw new Error("This photo format is not supported yet. Please choose a JPG/PNG image or take a new photo.");
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
