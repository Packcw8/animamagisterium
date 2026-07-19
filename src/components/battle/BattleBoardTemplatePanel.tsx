import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { EnemyDefinition, NpcDefinition } from "../../services/combatAdminService";
import { saveBattleBoardTemplate, saveBattleBoardTemplateSlot, templateSlotsToCombatants, type BattleBoardTemplateWithSlots } from "../../services/battleBoardTemplateService";
import { colors, fonts } from "../theme";
import { BattlefieldLayoutEditor } from "./BattlefieldLayoutEditor";

type BattleBoardTemplatePanelProps = {
  templates: BattleBoardTemplateWithSlots[];
  selectedTemplateId: string | null;
  seasonNumber: number;
  chapterNumber: number;
  enemies: EnemyDefinition[];
  npcs: NpcDefinition[];
  onTemplateSaved: (template: BattleBoardTemplateWithSlots) => void;
  onTemplateSelected: (templateId: string | null) => void;
  onTemplateSlotsChanged: () => Promise<void>;
  onApplyTemplate?: (template: BattleBoardTemplateWithSlots) => Promise<void>;
  onMessage: (message: string) => void;
  applyLabel?: string;
};

export function BattleBoardTemplatePanel({
  templates,
  selectedTemplateId,
  seasonNumber,
  chapterNumber,
  enemies,
  npcs,
  onTemplateSaved,
  onTemplateSelected,
  onTemplateSlotsChanged,
  onApplyTemplate,
  onMessage,
  applyLabel = "Apply Template",
}: BattleBoardTemplatePanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [contentScope, setContentScope] = useState<"chapter" | "universal">("chapter");
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) ?? null, [selectedTemplateId, templates]);
  const visibleTemplates = useMemo(
    () => templates.filter((template) => template.content_scope === "universal" || (Number(template.season_number) === seasonNumber && Number(template.chapter_number) === chapterNumber)),
    [chapterNumber, seasonNumber, templates],
  );

  function editTemplate(template: BattleBoardTemplateWithSlots) {
    onTemplateSelected(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setBackgroundImageUrl(template.background_image_url ?? "");
    setContentScope(template.content_scope ?? "chapter");
  }

  function clearTemplateForm() {
    onTemplateSelected(null);
    setName("");
    setDescription("");
    setBackgroundImageUrl("");
    setContentScope("chapter");
  }

  async function saveTemplate() {
    try {
      const saved = await saveBattleBoardTemplate({
        id: selectedTemplate?.id,
        name,
        description,
        background_image_url: backgroundImageUrl,
        content_scope: contentScope,
        season_number: seasonNumber,
        chapter_number: chapterNumber,
        is_active: true,
      });
      onTemplateSaved({ ...saved, slots: selectedTemplate?.slots ?? [] });
      onTemplateSelected(saved.id);
      setName(saved.name);
      setDescription(saved.description ?? "");
      setBackgroundImageUrl(saved.background_image_url ?? "");
      setContentScope(saved.content_scope ?? "chapter");
      onMessage("Battle board template saved.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save battle board template.");
    }
  }

  async function saveTemplateSlot(input: any) {
    if (!selectedTemplate) {
      onMessage("Save or select a template before adding slots.");
      return;
    }

    await saveBattleBoardTemplateSlot({
      ...input,
      template_id: selectedTemplate.id,
    });
    await onTemplateSlotsChanged();
    onMessage("Template slot saved.");
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Reusable Battle Board</Text>
          <Text style={styles.copy}>Build board layouts once, then apply them to marker battles or route event battles. After applying, change the scene actors without changing the template.</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={clearTemplateForm}>
          <Text style={styles.buttonText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {visibleTemplates.map((template) => (
          <Pressable key={template.id} style={[styles.chip, selectedTemplateId === template.id && styles.chipActive]} onPress={() => editTemplate(template)}>
            <Text style={styles.chipText}>{template.name}</Text>
          </Pressable>
        ))}
      </View>
      {visibleTemplates.length === 0 ? <Text style={styles.copy}>No reusable boards for this chapter yet.</Text> : null}

      <TextInput value={name} onChangeText={setName} placeholder="Template name" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Short admin notes" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={backgroundImageUrl} onChangeText={setBackgroundImageUrl} placeholder="Reusable battleground image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        <Pressable style={[styles.toggle, contentScope === "chapter" && styles.chipActive]} onPress={() => setContentScope("chapter")}>
          <Text style={styles.buttonText}>This Chapter</Text>
        </Pressable>
        <Pressable style={[styles.toggle, contentScope === "universal" && styles.chipActive]} onPress={() => setContentScope("universal")}>
          <Text style={styles.buttonText}>Universal</Text>
        </Pressable>
      </View>
      <Pressable style={styles.primaryButton} onPress={() => void saveTemplate()}>
        <Text style={styles.primaryText}>{selectedTemplate ? "Update Template" : "Create Template"}</Text>
      </Pressable>

      {selectedTemplate ? (
        <>
          {onApplyTemplate ? (
            <Pressable style={styles.secondaryButton} onPress={() => void onApplyTemplate(selectedTemplate)}>
              <Text style={styles.secondaryText}>{applyLabel}</Text>
            </Pressable>
          ) : null}
          <BattlefieldLayoutEditor
            title="Template Slots"
            emptyText="Save this reusable board, then tap the image to add slots."
            eventId={selectedTemplate.id}
            backgroundImageUrl={backgroundImageUrl || selectedTemplate.background_image_url}
            combatants={templateSlotsToCombatants(selectedTemplate.slots, selectedTemplate.id)}
            enemies={enemies}
            npcs={npcs}
            onSave={saveTemplateSlot}
            onDelete={async (slotId) => {
              const { deleteBattleBoardTemplateSlot } = await import("../../services/battleBoardTemplateService");
              await deleteBattleBoardTemplateSlot(slotId);
              await onTemplateSlotsChanged();
              onMessage("Template slot removed.");
            }}
            onMessage={onMessage}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  copy: {
    color: colors.muted,
    lineHeight: 19,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.22)",
  },
  chipText: {
    color: colors.text,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  toggle: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#100d08",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: "rgba(54,171,224,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
});
