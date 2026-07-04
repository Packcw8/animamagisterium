import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MapChapter, MapSeason } from "../../services/mapService";
import { getChapterLabel, getSeasonLabel } from "../../utils/mapProgress";
import { AdminCollapsibleSection } from "../admin/AdminCollapsibleSection";
import { colors, fonts } from "../theme";

type AdminMapEditorHeaderProps<Section extends string> = {
  availableSeasons: MapSeason[];
  availableChapters: MapChapter[];
  mapSeasons: MapSeason[];
  mapChapters: MapChapter[];
  selectedSeason: number;
  selectedChapter: number;
  newSeasonName: string;
  newSeasonDescription: string;
  newChapterName: string;
  newChapterDescription: string;
  sections: readonly Section[];
  activeSection: Section;
  message: string | null;
  seasonPanelOpen: boolean;
  onSelectSeason: (seasonNumber: number) => void;
  onSelectChapter: (chapterNumber: number) => void;
  onChangeSeasonName: (value: string) => void;
  onChangeSeasonDescription: (value: string) => void;
  onChangeChapterName: (value: string) => void;
  onChangeChapterDescription: (value: string) => void;
  onCreateSeason: () => void;
  onCreateChapter: () => void;
  onSelectSection: (section: Section) => void;
  onToggleSeasonPanel: () => void;
};

export function AdminMapEditorHeader<Section extends string>({
  availableSeasons,
  availableChapters,
  mapSeasons,
  mapChapters,
  selectedSeason,
  selectedChapter,
  newSeasonName,
  newSeasonDescription,
  newChapterName,
  newChapterDescription,
  sections,
  activeSection,
  message,
  seasonPanelOpen,
  onSelectSeason,
  onSelectChapter,
  onChangeSeasonName,
  onChangeSeasonDescription,
  onChangeChapterName,
  onChangeChapterDescription,
  onCreateSeason,
  onCreateChapter,
  onSelectSection,
  onToggleSeasonPanel,
}: AdminMapEditorHeaderProps<Section>) {
  const seasonLabel = getSeasonLabel(mapSeasons, selectedSeason);
  const chapterLabel = getChapterLabel(mapChapters, selectedSeason, selectedChapter);

  return (
    <>
      <Text style={styles.sectionTitle}>Admin Map Editor</Text>
      <Text style={styles.copy}>Choose an admin section, then edit only the content for that section. Map content uses percentage coordinates, never pixels or GPS coordinates.</Text>
      <View style={styles.workingBanner}>
        <View>
          <Text style={styles.workingEyebrow}>Working Content Scope</Text>
          <Text style={styles.workingTitle}>{seasonLabel} / {chapterLabel}</Text>
        </View>
        <Text style={styles.workingCopy}>New markers, mini maps, walking paths, events, tutorials, rewards, and legend entries save here.</Text>
      </View>
      <AdminCollapsibleSection
        title="Season / Chapter"
        summary={`${seasonLabel} / ${chapterLabel}. New content is assigned here.`}
        isOpen={seasonPanelOpen}
        onToggle={onToggleSeasonPanel}
      >
        <View style={styles.modeRow}>
          {availableSeasons.map((season) => (
            <Pressable key={season.season_number} style={[styles.routeChip, selectedSeason === season.season_number && styles.routeChipActive]} onPress={() => onSelectSeason(season.season_number)}>
              <Text style={styles.routeChipText}>{season.name}</Text>
            </Pressable>
          ))}
          <TextInput value={newSeasonName} onChangeText={onChangeSeasonName} placeholder="New season name" placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} />
          <TextInput value={newSeasonDescription} onChangeText={onChangeSeasonDescription} placeholder="Season note optional" placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} />
          <Pressable style={styles.secondaryButtonFlex} onPress={onCreateSeason}>
            <Text style={styles.secondaryText}>Add Season</Text>
          </Pressable>
        </View>
        <View style={styles.modeRow}>
          {availableChapters.map((chapter) => (
            <Pressable key={`${chapter.season_number}-${chapter.chapter_number}`} style={[styles.routeChip, selectedChapter === chapter.chapter_number && styles.routeChipActive]} onPress={() => onSelectChapter(chapter.chapter_number)}>
              <Text style={styles.routeChipText}>{chapter.name}</Text>
            </Pressable>
          ))}
          <TextInput value={newChapterName} onChangeText={onChangeChapterName} placeholder="New chapter/area name" placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} />
          <TextInput value={newChapterDescription} onChangeText={onChangeChapterDescription} placeholder="Chapter note optional" placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} />
          <Pressable style={styles.secondaryButtonFlex} onPress={onCreateChapter}>
            <Text style={styles.secondaryText}>Add Chapter</Text>
          </Pressable>
        </View>
        <Text style={styles.debugLine}>Working in {seasonLabel} / {chapterLabel}. New map content is automatically assigned here.</Text>
      </AdminCollapsibleSection>
      <View style={styles.adminSectionTabs}>
        {sections.map((section) => (
          <Pressable key={section} style={[styles.modeButton, activeSection === section && styles.typeSelected]} onPress={() => onSelectSection(section)}>
            <Text style={styles.typeText}>{section}</Text>
          </Pressable>
        ))}
      </View>
      {message ? <Text style={styles.adminMessage}>{message}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  adminMessage: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  adminSectionTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inlineInput: {
    flexGrow: 1,
    minWidth: 160,
  },
  modeButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  secondaryButtonFlex: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
    textTransform: "uppercase",
  },
  selectedTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  storyEditor: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  typeText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  workingBanner: {
    alignItems: "center",
    backgroundColor: "rgba(21, 157, 220, 0.14)",
    borderColor: colors.blue,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    padding: 12,
  },
  workingCopy: {
    color: colors.text,
    flex: 1,
    lineHeight: 18,
    minWidth: 220,
  },
  workingEyebrow: {
    color: colors.blue,
    fontFamily: fonts.title,
    fontSize: 11,
    textTransform: "uppercase",
  },
  workingTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
});
