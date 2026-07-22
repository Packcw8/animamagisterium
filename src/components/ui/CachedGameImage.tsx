import { useEffect, useState } from "react";
import {
  Image,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from "react-native";

const prefetchedUris = new Set<string>();
const failedUris = new Set<string>();

export function prefetchGameImage(uri?: string | null) {
  const safeUri = uri?.trim();
  if (!safeUri || prefetchedUris.has(safeUri) || failedUris.has(safeUri)) {
    return;
  }

  prefetchedUris.add(safeUri);
  void Image.prefetch(safeUri).catch(() => {
    prefetchedUris.delete(safeUri);
    failedUris.add(safeUri);
  });
}

export function prefetchGameImages(uris: Array<string | null | undefined>) {
  uris.forEach(prefetchGameImage);
}

export function CachedGameImage({
  uri,
  style,
  resizeMode = "cover",
  onError,
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onError?: () => void;
}) {
  const safeUri = uri?.trim() || null;
  const [failed, setFailed] = useState(Boolean(safeUri && failedUris.has(safeUri)));

  useEffect(() => {
    setFailed(Boolean(safeUri && failedUris.has(safeUri)));
    prefetchGameImage(safeUri);
  }, [safeUri]);

  if (!safeUri || failed) {
    return null;
  }

  return (
    <Image
      source={{ uri: safeUri, cache: "force-cache" } as object}
      style={style}
      resizeMode={resizeMode}
      fadeDuration={0}
      onError={() => {
        failedUris.add(safeUri);
        setFailed(true);
        onError?.();
      }}
    />
  );
}
