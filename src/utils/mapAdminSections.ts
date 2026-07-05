export const editorModes = ["Marker", "Walking Path"] as const;

export const adminSections = [
  "World Map",
  "World Markers",
  "Area/Town Markers",
  "Mini Maps",
  "Walking Paths",
  "Tutorials",
  "Rewards/Interactions",
  "Legend",
] as const;

export type MapEditorMode = (typeof editorModes)[number];
export type MapAdminSection = (typeof adminSections)[number];

export function isMapAdminSection(value: string | null | undefined): value is MapAdminSection {
  return Boolean(value && adminSections.some((section) => section === value));
}

export function getDefaultDraftTypeForAdminSection(section: MapAdminSection): "Area/Town Entrance" | "Story" | null {
  if (section === "Area/Town Markers") return "Area/Town Entrance";
  if (section === "World Markers") return "Story";
  return null;
}

export function getEditorModeForAdminSection(section: MapAdminSection): MapEditorMode {
  return section === "Walking Paths" ? "Walking Path" : "Marker";
}
