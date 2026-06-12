export type ScreenKey = "home" | "map" | "quests" | "social" | "settings";

export type Player = {
  id: string;
  displayName: string;
  title: string;
  level: number;
  xp: number;
  xpMax: number;
  stats: {
    health: number;
    healthMax: number;
    mana: number;
    manaMax: number;
    stamina: number;
    staminaMax: number;
  };
  attributes: Array<{
    name: string;
    value: number;
    color: string;
  }>;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  xp: number;
  coins: number;
  progress: number;
  target: number;
  color: string;
  icon: string;
};

export type Skill = {
  id: string;
  group: "Strength" | "Endurance";
  name: string;
  level: number;
  progress: number;
  target: number;
  color: string;
  icon: string;
};

export type Region = {
  id: string;
  name: string;
  levelGate: string;
  locked: boolean;
  left: `${number}%`;
  top: `${number}%`;
};

export type InventoryItem = {
  id: string;
  name: string;
  rarity: "Common" | "Rare" | "Epic";
  slot: string;
  attack?: number;
  dexterity?: number;
  requiredLevel?: number;
  color: string;
};
