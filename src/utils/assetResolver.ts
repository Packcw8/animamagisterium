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
  "assets/Reusable/Icons/AlchemyIcon.jpg": require("../../assets/Reusable/Icons/AlchemyIcon.jpg"),
  "assets/Reusable/Icons/BankIcon.jpg": require("../../assets/Reusable/Icons/BankIcon.jpg"),
  "assets/Reusable/Icons/BuorbonIcon.jpg": require("../../assets/Reusable/Icons/BuorbonIcon.jpg"),
  "assets/Reusable/Icons/ExitIcon.jpg": require("../../assets/Reusable/Icons/ExitIcon.jpg"),
  "assets/Reusable/Icons/Jeweryicon.jpg": require("../../assets/Reusable/Icons/Jeweryicon.jpg"),
  "assets/Reusable/Icons/MarketIcon.jpg": require("../../assets/Reusable/Icons/MarketIcon.jpg"),
  "assets/Reusable/Icons/RestIcon.jpg": require("../../assets/Reusable/Icons/RestIcon.jpg"),
  "assets/Reusable/Icons/StabelIcon.jpg": require("../../assets/Reusable/Icons/StabelIcon.jpg"),
  "assets/Reusable/Icons/StoryIcon.jpg": require("../../assets/Reusable/Icons/StoryIcon.jpg"),
  "assets/Reusable/Icons/TravelHubIcon.jpg": require("../../assets/Reusable/Icons/TravelHubIcon.jpg"),
  "assets/Reusable/Icons/TrophyHuntIcon.jpg": require("../../assets/Reusable/Icons/TrophyHuntIcon.jpg"),
  "assets/Reusable/Icons/WeaponsIcon.jpg": require("../../assets/Reusable/Icons/WeaponsIcon.jpg"),
  "assets/Reusable/Icons/WearsIcon.jpg": require("../../assets/Reusable/Icons/WearsIcon.jpg"),
  "assets/Reusable/Icons/gpt-image-2_A_detailed_fantasy_weapons_store_background_for_a_dark_fantasy_RPG_shown_as_an_i-0.jpg": require("../../assets/Reusable/Icons/gpt-image-2_A_detailed_fantasy_weapons_store_background_for_a_dark_fantasy_RPG_shown_as_an_i-0.jpg"),
  "assets/Reusable/Items/Mining/Coal.jpg": require("../../assets/Reusable/Items/Mining/Coal.jpg"),
  "assets/Reusable/Items/Mining/CopperIngot.jpg": require("../../assets/Reusable/Items/Mining/CopperIngot.jpg"),
  "assets/Reusable/Items/Mining/CopperOre.jpg": require("../../assets/Reusable/Items/Mining/CopperOre.jpg"),
  "assets/Reusable/Items/Mining/ElyseScreenDream.jpg": require("../../assets/Reusable/Items/Mining/ElyseScreenDream.jpg"),
  "assets/Reusable/Items/Mining/IronIngot.jpg": require("../../assets/Reusable/Items/Mining/IronIngot.jpg"),
  "assets/Reusable/Items/Mining/IronOre.jpg": require("../../assets/Reusable/Items/Mining/IronOre.jpg"),
  "assets/Reusable/Items/Mining/MiningPick.jpg": require("../../assets/Reusable/Items/Mining/MiningPick.jpg"),
  "assets/Reusable/Items/Mining/SilverIngot.jpg": require("../../assets/Reusable/Items/Mining/SilverIngot.jpg"),
  "assets/Reusable/Items/Mining/SilverOre.jpg": require("../../assets/Reusable/Items/Mining/SilverOre.jpg"),
  "assets/Reusable/Items/Mining/TinIngot.jpg": require("../../assets/Reusable/Items/Mining/TinIngot.jpg"),
  "assets/Reusable/Items/Mining/TinOre.jpg": require("../../assets/Reusable/Items/Mining/TinOre.jpg"),
  "assets/Reusable/Foraging/FlaxPlants.jpg": require("../../assets/Reusable/Foraging/FlaxPlants.jpg"),
  "assets/Reusable/Foraging/ForagingSatchel.jpg": require("../../assets/Reusable/Foraging/ForagingSatchel.jpg"),
  "assets/Reusable/Foraging/GhostCapMushrooms.jpg": require("../../assets/Reusable/Foraging/GhostCapMushrooms.jpg"),
  "assets/Reusable/Foraging/MedcinalLeaves.jpg": require("../../assets/Reusable/Foraging/MedcinalLeaves.jpg"),
  "assets/Reusable/Foraging/MoonPetalFlower.jpg": require("../../assets/Reusable/Foraging/MoonPetalFlower.jpg"),
  "assets/Reusable/Foraging/TreeBark.jpg": require("../../assets/Reusable/Foraging/TreeBark.jpg"),
  "assets/Reusable/Foraging/TwistedIronRoot.jpg": require("../../assets/Reusable/Foraging/TwistedIronRoot.jpg"),
  "assets/Reusable/lumber/blackbarkwood.jpg": require("../../assets/Reusable/lumber/blackbarkwood.jpg"),
  "assets/Reusable/lumber/FallenBranches.jpg": require("../../assets/Reusable/lumber/FallenBranches.jpg"),
  "assets/Reusable/lumber/HearthlandTimber.jpg": require("../../assets/Reusable/lumber/HearthlandTimber.jpg"),
  "assets/Reusable/lumber/IronWoodLogs.jpg": require("../../assets/Reusable/lumber/IronWoodLogs.jpg"),
  "assets/Reusable/lumber/WhisperWillowBranches.jpg": require("../../assets/Reusable/lumber/WhisperWillowBranches.jpg"),
  "assets/Season1/Chapter1/MiniMaps/RavensRest.jpg": require("../../assets/Season1/Chapter1/MiniMaps/RavensRest.jpg"),
  "assets/Season1/Chapter1/MiniMaps/ravensrestinn.jpg": require("../../assets/Season1/Chapter1/MiniMaps/ravensrestinn.jpg"),
  "assets/Season1/Chapter2/MiniMaps/GoblinCamp (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/GoblinCamp (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/HearhguardCastleDistrict.jpg": require("../../assets/Season1/Chapter2/MiniMaps/HearhguardCastleDistrict.jpg"),
  "assets/Season1/Chapter2/MiniMaps/HearthguardArenaDistrict.jpg": require("../../assets/Season1/Chapter2/MiniMaps/HearthguardArenaDistrict.jpg"),
  "assets/Season1/Chapter2/MiniMaps/HearthguardMarketDistrict.jpg": require("../../assets/Season1/Chapter2/MiniMaps/HearthguardMarketDistrict.jpg"),
  "assets/Season1/Chapter2/MiniMaps/HearthguardNobileDistrict.jpg": require("../../assets/Season1/Chapter2/MiniMaps/HearthguardNobileDistrict.jpg"),
  "assets/Season1/Chapter2/MiniMaps/Hearthguardcentralplaza.jpg": require("../../assets/Season1/Chapter2/MiniMaps/Hearthguardcentralplaza.jpg"),
  "assets/Season1/Chapter2/MiniMaps/MinePathWithDoor (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/MinePathWithDoor (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/MinePathWithExittooutsideDoor (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/MinePathWithExittooutsideDoor (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/Minepath1 (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/Minepath1 (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/ResearchFacilityWpower (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/ResearchFacilityWpower (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/ResearchfacilityNOpower (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/ResearchfacilityNOpower (1).jpg"),
  "assets/Season1/Chapter2/MiniMaps/TheMines (1).jpg": require("../../assets/Season1/Chapter2/MiniMaps/TheMines (1).jpg"),
};

const kindBasePaths: Record<AssetKind, string[]> = {
  ability: getSeasonChapterBasePaths("Abilities").concat("assets/Reusable/Icons/Misc"),
  deck: getSeasonChapterBasePaths("DeckCards"),
  enemy: getSeasonChapterBasePaths("Enemies"),
  icon: ["assets/Reusable/Icons", "assets/Reusable/Icons/Misc", "assets/Reusable/Icons/UI", "assets/Reusable/Icons/Markers", "assets/Reusable/Icons/Shops", "assets/Reusable/Icons/Travel", "assets/Reusable/Icons/Rest", "assets/Reusable/Icons/Story"],
  item: ["assets/Reusable/Items", "assets/Reusable/Items/Mining", "assets/Reusable/Foraging", "assets/Reusable/lumber", ...getSeasonChapterBasePaths("Items")],
  map: ["assets", ...getSeasonChapterBasePaths("MiniMaps")],
  minimap: getSeasonChapterBasePaths("MiniMaps"),
  mount: getSeasonChapterBasePaths("Mounts"),
  npc: getSeasonChapterBasePaths("NPCs"),
  scene: getSeasonChapterBasePaths("Scenes"),
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

  const bundledKey = getBundledAssetKey(trimmed, kind);
  const source = bundledKey ? bundledAssets[bundledKey] ?? null : null;
  if (source) {
    const resolver = typeof Image.resolveAssetSource === "function" ? Image.resolveAssetSource : null;
    const resolvedSource = resolver?.(source);

    if (resolvedSource?.uri) {
      return resolvedSource.uri;
    }

    if (typeof source === "object" && source && "uri" in source && typeof source.uri === "string") {
      return source.uri;
    }

    return `/${bundledKey}`;
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

function getSeasonChapterBasePaths(folder: string) {
  return Array.from({ length: 8 }, (_value, index) => `assets/Season1/Chapter${index + 1}/${folder}`);
}
