import { Image, ImageSourcePropType } from "react-native";

type AssetKind = "ability" | "deck" | "enemy" | "icon" | "item" | "map" | "minimap" | "mount" | "npc" | "scene" | "misc";

type AssetRegistry = Record<string, ImageSourcePropType>;

const bundledAssets: AssetRegistry = {
  "assets/adaptive-icon.png": require("../../assets/adaptive-icon.png"),
  "assets/apple-touch-icon.png": require("../../assets/apple-touch-icon.png"),
  "assets/favicon.png": require("../../assets/favicon.png"),
  "assets/icon.png": require("../../assets/icon.png"),
  "assets/logo.jpeg": require("../../assets/logo.jpeg"),
  "assets/pwa-icon-192.png": require("../../assets/pwa-icon-192.png"),
  "assets/pwa-icon-512.png": require("../../assets/pwa-icon-512.png"),
  "assets/splash-icon.png": require("../../assets/splash-icon.png"),
  "assets/TheForgottenMarches.png": require("../../assets/TheForgottenMarches.png"),
};

const kindBasePaths: Record<AssetKind, string[]> = {
  ability: ["assets/Season1/Chapter1/Abilities", "assets/Reusable/Icons/Misc"],
  deck: ["assets/Season1/Chapter1/DeckCards"],
  enemy: ["assets/Season1/Chapter1/Enemies"],
  icon: ["assets/Reusable/Icons", "assets/Reusable/Icons/Misc"],
  item: ["assets/Season1/Chapter1/Items"],
  map: ["assets", "assets/Season1/Chapter1/MiniMaps"],
  minimap: ["assets/Season1/Chapter1/MiniMaps"],
  mount: ["assets/Season1/Chapter1/Mounts"],
  npc: ["assets/Season1/Chapter1/NPCs"],
  scene: ["assets/Season1/Chapter1/Scenes"],
  misc: ["assets"],
};

const legacyFolderAliases: Array<[RegExp, string]> = [
  [/^\/?assets\/ability\//i, "assets/Season1/Chapter1/Abilities/"],
  [/^\/?assets\/abilities\//i, "assets/Season1/Chapter1/Abilities/"],
  [/^\/?assets\/enemy\//i, "assets/Season1/Chapter1/Enemies/"],
  [/^\/?assets\/enemies\//i, "assets/Season1/Chapter1/Enemies/"],
  [/^\/?assets\/inventory\//i, "assets/Season1/Chapter1/Items/"],
  [/^\/?assets\/inventoryitems\//i, "assets/Season1/Chapter1/Items/"],
  [/^\/?assets\/items\//i, "assets/Season1/Chapter1/Items/"],
  [/^\/?assets\/mounts\//i, "assets/Season1/Chapter1/Mounts/"],
  [/^\/?assets\/npcs\//i, "assets/Season1/Chapter1/NPCs/"],
  [/^\/?assets\/minimaps\//i, "assets/Season1/Chapter1/MiniMaps/"],
  [/^\/?assets\/maps\//i, "assets/Season1/Chapter1/MiniMaps/"],
  [/^\/?assets\/scenes\//i, "assets/Season1/Chapter1/Scenes/"],
  [/^\/?assets\/deckcards\//i, "assets/Season1/Chapter1/DeckCards/"],
];

export function registerBundledAsset(key: string, source: ImageSourcePropType) {
  bundledAssets[normalizeAssetKey(key)] = source;
}

export function resolveBundledAssetSource(path?: string | null, kind: AssetKind = "misc") {
  const key = getBundledAssetKey(path, kind);
  return key ? bundledAssets[key] ?? null : null;
}

export function resolveGameAssetUri(path?: string | null, kind: AssetKind = "misc") {
  const trimmed = path?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:|file:)/i.test(trimmed)) {
    return trimmed;
  }

  const source = resolveBundledAssetSource(trimmed, kind);
  if (source) {
    return Image.resolveAssetSource(source)?.uri ?? null;
  }

  const normalized = normalizeAssetKey(trimmed);
  return normalized.startsWith("assets/") ? `/${normalized}` : `/${normalized}`;
}

function getBundledAssetKey(path?: string | null, kind: AssetKind = "misc") {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeAssetKey(applyLegacyAliases(trimmed));
  const candidates = new Set<string>([normalized]);

  if (!normalized.includes("/")) {
    for (const basePath of kindBasePaths[kind]) {
      candidates.add(`${basePath}/${normalized}`);
    }
  }

  for (const candidate of candidates) {
    if (bundledAssets[candidate]) {
      return candidate;
    }
  }

  return null;
}

function applyLegacyAliases(path: string) {
  return legacyFolderAliases.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), path);
}

function normalizeAssetKey(path: string) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/^\.\//, "");
}
