import { InventoryItem, Player, Quest, Region, Skill } from "../types";

export const player: Player = {
  id: "profile-cody-pack",
  displayName: "Cody Pack",
  title: "Adventurer",
  level: 23,
  xp: 4250,
  xpMax: 6500,
  stats: {
    health: 850,
    healthMax: 850,
    mana: 320,
    manaMax: 320,
    stamina: 120,
    staminaMax: 120,
  },
  attributes: [
    { name: "Strength", value: 18, color: "#d84a3c" },
    { name: "Endurance", value: 16, color: "#73c83f" },
    { name: "Agility", value: 14, color: "#43a8d8" },
    { name: "Intelligence", value: 12, color: "#8c55d7" },
    { name: "Wisdom", value: 10, color: "#d5a441" },
    { name: "Charisma", value: 8, color: "#46b7c8" },
    { name: "Spirit", value: 7, color: "#7fe7ff" },
  ],
};

export const quests: Quest[] = [
  {
    id: "morning-workout",
    title: "Morning Workout",
    description: "Complete a 30 min workout",
    xp: 50,
    coins: 10,
    progress: 0,
    target: 1,
    color: "#76ce40",
    icon: "DB",
  },
  {
    id: "read-30",
    title: "Read for 30 Minutes",
    description: "Expand your knowledge",
    xp: 40,
    coins: 5,
    progress: 0,
    target: 1,
    color: "#44b5dd",
    icon: "BK",
  },
  {
    id: "walk-5000",
    title: "Walk 5,000 Steps",
    description: "Explore the world around you",
    xp: 30,
    coins: 5,
    progress: 2350,
    target: 5000,
    color: "#d7a744",
    icon: "ST",
  },
  {
    id: "healthy-meal",
    title: "Healthy Meal",
    description: "Eat a healthy meal",
    xp: 20,
    coins: 5,
    progress: 0,
    target: 1,
    color: "#73c83f",
    icon: "ML",
  },
];

export const skills: Skill[] = [
  { id: "weightlifting", group: "Strength", name: "Weightlifting", level: 12, progress: 320, target: 500, color: "#e0473a", icon: "DB" },
  { id: "martial-arts", group: "Strength", name: "Martial Arts", level: 8, progress: 150, target: 400, color: "#e0473a", icon: "MA" },
  { id: "basketball", group: "Strength", name: "Basketball", level: 10, progress: 250, target: 400, color: "#e0473a", icon: "BB" },
  { id: "climbing", group: "Strength", name: "Climbing", level: 6, progress: 80, target: 300, color: "#e0473a", icon: "CL" },
  { id: "running", group: "Endurance", name: "Running", level: 13, progress: 420, target: 500, color: "#58cf36", icon: "RN" },
  { id: "hiking", group: "Endurance", name: "Hiking", level: 9, progress: 200, target: 400, color: "#58cf36", icon: "HK" },
  { id: "cycling", group: "Endurance", name: "Cycling", level: 7, progress: 120, target: 300, color: "#58cf36", icon: "CY" },
  { id: "swimming", group: "Endurance", name: "Swimming", level: 6, progress: 90, target: 300, color: "#44b5dd", icon: "SW" },
];

export const regions: Region[] = [
  { id: "frostvalley", name: "Frostvalley", levelGate: "Level 30+", locked: true, left: "30%", top: "20%" },
  { id: "stonehold", name: "Stonehold", levelGate: "Level 20+", locked: true, left: "72%", top: "26%" },
  { id: "greenwold", name: "Greenwold", levelGate: "Level 1+", locked: false, left: "50%", top: "48%" },
  { id: "sandshore", name: "Sandshore", levelGate: "Level 10+", locked: true, left: "28%", top: "76%" },
  { id: "darkwood", name: "Darkwood", levelGate: "Level 25+", locked: true, left: "74%", top: "75%" },
];

export const inventory: InventoryItem[] = [
  { id: "rangers-bow", name: "Ranger's Bow", rarity: "Epic", slot: "Weapon", attack: 45, dexterity: 15, requiredLevel: 20, color: "#b36cff" },
  { id: "hunter-hood", name: "Hunter Hood", rarity: "Rare", slot: "Head", color: "#469be8" },
  { id: "trail-boots", name: "Trail Boots", rarity: "Rare", slot: "Feet", color: "#63c64c" },
];
