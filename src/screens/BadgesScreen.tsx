import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import {
  badgeTypeLabels,
  badgeTypes,
  BadgeDefinition,
  BadgeState,
  BadgeType,
  deleteBadgeDefinition,
  getBadgeDefinitions,
  getBadgeState,
  saveBadgeDefinition,
} from "../services/badgeService";
import type { CharacterWithDetails } from "../services/characterService";
import { EnemyDefinition, getEnemies, resolveEnemyImageUri } from "../services/combatAdminService";
import { getCurrentRole, getMapMarkers, MapMarker, Role } from "../services/mapService";

type BadgesScreenProps = {
  character: CharacterWithDetails;
};

const blankBadge: Partial<BadgeDefinition> = {
  title: "",
  description: "",
  badge_type: "distance",
  metric_key: null,
  target_value: 1,
  icon_label: "",
  icon_url: "",
  sort_order: 0,
  is_active: true,
  season_number: 1,
  chapter_number: 1,
};

const trainingKeys = ["", "strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"] as const;

export function BadgesScreen({ character }: BadgesScreenProps) {
  const [role, setRole] = useState<Role>("player");
  const [states, setStates] = useState<BadgeState[]>([]);
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([]);
  const [storyMarkers, setStoryMarkers] = useState<MapMarker[]>([]);
  const [enemies, setEnemies] = useState<EnemyDefinition[]>([]);
  const [form, setForm] = useState<Partial<BadgeDefinition>>(blankBadge);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = role === "admin";

  const earnedCount = useMemo(() => states.filter((state) => state.isEarned).length, [states]);

  useEffect(() => {
    void loadBadges();
  }, [character.id]);

  async function loadBadges() {
    setIsLoading(true);
    setMessage(null);
    try {
      const [nextRole, nextStates, nextDefinitions, markers, enemyRows] = await Promise.all([
        getCurrentRole(),
        getBadgeState(character),
        getBadgeDefinitions(true),
        getMapMarkers(),
        getEnemies(),
      ]);
      setRole(nextRole);
      setStates(nextStates);
      setDefinitions(nextDefinitions);
      setStoryMarkers(markers.filter((marker) => ["story", "side quest", "quest"].includes(marker.type.toLowerCase())));
      setEnemies(enemyRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load badges.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveBadge() {
    try {
      const saved = await saveBadgeDefinition({ ...form, id: editingId ?? undefined });
      setMessage(`${saved.title} saved.`);
      setForm(blankBadge);
      setEditingId(null);
      await loadBadges();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save badge.");
    }
  }

  async function deleteBadge(id: string) {
    try {
      await deleteBadgeDefinition(id);
      setMessage("Badge deleted.");
      if (editingId === id) {
        setEditingId(null);
        setForm(blankBadge);
      }
      await loadBadges();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete badge.");
    }
  }

  function editBadge(definition: BadgeDefinition) {
    setEditingId(definition.id);
    setForm(definition);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Achievements / Badges</Text>
        </View>
      </View>

      <Frame style={styles.summaryCard}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.description}>Earned through walking, training, stories, and enemy victories.</Text>
        <View style={styles.summaryRow}>
          <SummaryPill label="Earned" value={`${earnedCount}`} />
          <SummaryPill label="Available" value={`${states.length}`} />
          <SummaryPill label="Progress" value={states.length ? `${Math.round((earnedCount / states.length) * 100)}%` : "0%"} />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Frame>

      <View style={styles.badgeGrid}>
        {isLoading ? <Text style={styles.muted}>Reading the achievement ledger...</Text> : null}
        {!isLoading && states.length === 0 ? <Text style={styles.muted}>No badges have been created yet.</Text> : null}
        {states.map((state) => (
          <BadgeCard key={state.definition.id} state={state} />
        ))}
      </View>

      {isAdmin ? (
        <Frame style={styles.adminCard}>
          <Text style={styles.sectionTitle}>Admin Badge Builder</Text>
          <Text style={styles.description}>Create badges from existing tracked metrics. Story badges can target one story marker, or count all completed stories if no marker is selected.</Text>
          <Field label="Badge title" value={form.title ?? ""} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <Field label="Description" value={form.description ?? ""} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
          <ChoiceRow label="Metric" options={badgeTypes} value={form.badge_type ?? "distance"} labels={badgeTypeLabels} onSelect={(value) => setForm((current) => ({ ...current, badge_type: value, metric_key: null }))} />
          {form.badge_type === "story_completion" ? (
            <NamedChoiceRow
              label="Linked story"
              options={[{ id: "", label: "Any completed story" }, ...storyMarkers.map((marker) => ({ id: marker.id, label: marker.title }))]}
              value={form.metric_key ?? ""}
              onSelect={(value) => setForm((current) => ({ ...current, metric_key: value || null, target_value: value ? 1 : current.target_value }))}
            />
          ) : null}
          {form.badge_type === "training_sessions" ? (
            <ChoiceRow label="Training attribute" options={trainingKeys} value={form.metric_key ?? ""} labels={{ "": "Any Training" }} onSelect={(value) => setForm((current) => ({ ...current, metric_key: value || null }))} />
          ) : null}
          {form.badge_type === "enemy_name_kills" ? (
            <EnemyBadgeSelector
              enemies={enemies}
              value={form.metric_key ?? ""}
              onSelect={(value) => setForm((current) => ({ ...current, metric_key: value || null }))}
            />
          ) : null}
          {form.badge_type === "enemy_type_kills" ? (
            <Field label="Enemy type, example Animal or Bandit. Leave blank for all enemy types." value={form.metric_key ?? ""} onChange={(value) => setForm((current) => ({ ...current, metric_key: value }))} />
          ) : null}
          {form.badge_type === "distance" ? (
            <Text style={styles.hint}>Target value is meters. Example: 1609 equals roughly 1 mile.</Text>
          ) : null}
          <View style={styles.formRow}>
            <Field label="Target value" value={String(form.target_value ?? 1)} onChange={(value) => setForm((current) => ({ ...current, target_value: Number(value) || 1 }))} />
            <Field label="Sort order" value={String(form.sort_order ?? 0)} onChange={(value) => setForm((current) => ({ ...current, sort_order: Number(value) || 0 }))} />
          </View>
          <View style={styles.formRow}>
            <Field label="Icon label" value={form.icon_label ?? ""} onChange={(value) => setForm((current) => ({ ...current, icon_label: value }))} />
            <Field label="Icon image URL/path" value={form.icon_url ?? ""} onChange={(value) => setForm((current) => ({ ...current, icon_url: value }))} />
          </View>
          <View style={styles.formRow}>
            <Field label="Season" value={String(form.season_number ?? 1)} onChange={(value) => setForm((current) => ({ ...current, season_number: Number(value) || 1 }))} />
            <Field label="Chapter" value={String(form.chapter_number ?? 1)} onChange={(value) => setForm((current) => ({ ...current, chapter_number: Number(value) || 1 }))} />
          </View>
          <Pressable style={[styles.toggleButton, form.is_active && styles.toggleActive]} onPress={() => setForm((current) => ({ ...current, is_active: !(current.is_active ?? true) }))}>
            <Text style={styles.buttonText}>Active: {(form.is_active ?? true) ? "Yes" : "No"}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => void saveBadge()}>
            <Text style={styles.primaryButtonText}>{editingId ? "Update Badge" : "Create Badge"}</Text>
          </Pressable>
          {editingId ? (
            <Pressable style={styles.secondaryButton} onPress={() => { setEditingId(null); setForm(blankBadge); }}>
              <Text style={styles.buttonText}>Cancel Edit</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionTitle}>Existing Badge Rules</Text>
          {definitions.map((definition) => (
            <View key={definition.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Text style={styles.ruleTitle}>{definition.title}</Text>
                <Text style={styles.ruleMeta}>{badgeTypeLabels[definition.badge_type]}</Text>
              </View>
              <Text style={styles.muted}>{describeBadgeRule(definition, storyMarkers, enemies)}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.secondaryButton} onPress={() => editBadge(definition)}>
                  <Text style={styles.buttonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={() => void deleteBadge(definition.id)}>
                  <Text style={styles.dangerText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Frame>
      ) : null}
    </Screen>
  );
}

function BadgeCard({ state }: { state: BadgeState }) {
  const { definition } = state;
  const progress = Math.min(state.progressValue, definition.target_value);
  const percent = definition.target_value > 0 ? Math.min(100, Math.round((progress / definition.target_value) * 100)) : 0;

  return (
    <Frame style={state.isEarned ? [styles.badgeCard, styles.badgeEarned] : styles.badgeCard}>
      <View style={styles.badgeHeader}>
        <View style={[styles.badgeIcon, state.isEarned ? styles.badgeIconEarned : undefined]}>
          {definition.icon_url ? <Image source={{ uri: definition.icon_url }} style={styles.badgeIconImage} /> : <Text style={styles.badgeIconText}>{definition.icon_label || "BDG"}</Text>}
        </View>
        <View style={styles.badgeBody}>
          <Text style={styles.badgeTitle}>{definition.title}</Text>
          <Text style={styles.badgeType}>{badgeTypeLabels[definition.badge_type]}</Text>
        </View>
      </View>
      <Text style={styles.description}>{definition.description ?? describeBadgeRule(definition, [], [])}</Text>
      <View style={styles.progressHeader}>
        <Text style={styles.muted}>{formatProgressValue(definition.badge_type, state.progressValue)} / {formatProgressValue(definition.badge_type, definition.target_value)}</Text>
        <Text style={state.isEarned ? styles.earnedText : styles.lockedText}>{state.isEarned ? "Earned" : `${percent}%`}</Text>
      </View>
      <ProgressBar value={progress} max={Math.max(1, definition.target_value)} color={state.isEarned ? colors.gold : colors.blue} height={8} />
    </Frame>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={colors.muted}
      style={styles.input}
    />
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  labels,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  value: string;
  labels?: Partial<Record<T | string, string>>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.actions}>
        {options.map((option) => (
          <Pressable key={option || "none"} style={[styles.choiceButton, value === option && styles.choiceActive]} onPress={() => onSelect(option)}>
            <Text style={[styles.buttonText, value === option && styles.choiceTextActive]}>{labels?.[option] ?? option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NamedChoiceRow({ label, options, value, onSelect }: { label: string; options: Array<{ id: string; label: string }>; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.actions}>
        {options.map((option) => (
          <Pressable key={option.id || "none"} style={[styles.choiceButton, value === option.id && styles.choiceActive]} onPress={() => onSelect(option.id)}>
            <Text style={[styles.buttonText, value === option.id && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EnemyBadgeSelector({ enemies, value, onSelect }: { enemies: EnemyDefinition[]; value: string; onSelect: (value: string) => void }) {
  const selectedEnemyId = value.startsWith("enemy:") ? value.replace("enemy:", "") : "";
  const selectedEnemy = enemies.find((enemy) => enemy.id === selectedEnemyId);

  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>Enemy from Enemy Admin</Text>
      <Text style={styles.hint}>Select a created enemy to track kills by that exact enemy. Choose Any Enemy to count all named enemy kills.</Text>
      <View style={styles.enemySelectorHeader}>
        <Pressable style={[styles.choiceButton, !value && styles.choiceActive]} onPress={() => onSelect("")}>
          <Text style={[styles.buttonText, !value && styles.choiceTextActive]}>Any Enemy</Text>
        </Pressable>
        {selectedEnemy ? (
          <Text style={styles.selectedEnemyText}>Selected: {selectedEnemy.name}</Text>
        ) : value ? (
          <Text style={styles.selectedEnemyText}>Selected enemy is missing from Enemy Admin.</Text>
        ) : null}
      </View>
      <View style={styles.enemySelectGrid}>
        {enemies.length === 0 ? <Text style={styles.muted}>No enemies created yet. Add enemies in Home / Abilities / Enemy Admin.</Text> : null}
        {enemies.map((enemy) => {
          const optionValue = `enemy:${enemy.id}`;
          const isSelected = value === optionValue;
          const imageUri = resolveEnemyImageUri(enemy.image_url);

          return (
            <Pressable key={enemy.id} style={[styles.enemySelectCard, isSelected && styles.enemySelectCardActive]} onPress={() => onSelect(optionValue)}>
              <View style={styles.enemySelectImageWrap}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.enemySelectImage} /> : <Text style={styles.enemySelectInitial}>{enemy.name.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.enemySelectInfo}>
                <Text style={styles.enemySelectName} numberOfLines={1}>{enemy.name}</Text>
                <Text style={styles.enemySelectMeta} numberOfLines={1}>{enemy.type || "Enemy"} / HP {enemy.health}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function describeBadgeRule(definition: BadgeDefinition, storyMarkers: MapMarker[], enemies: EnemyDefinition[]) {
  if (definition.badge_type === "distance") {
    return `Walk ${formatProgressValue("distance", definition.target_value)}.`;
  }

  if (definition.badge_type === "enemy_name_kills") {
    const enemyId = definition.metric_key?.startsWith("enemy:") ? definition.metric_key.replace("enemy:", "") : null;
    const enemy = enemies.find((row) => row.id === enemyId);
    return definition.metric_key
      ? `Defeat ${definition.target_value} ${enemy?.name ?? "selected enemy"}${definition.target_value === 1 ? "" : "s"}.`
      : `Defeat ${definition.target_value} named enem${definition.target_value === 1 ? "y" : "ies"}.`;
  }

  if (definition.badge_type === "enemy_type_kills") {
    return `Defeat ${definition.target_value} ${definition.metric_key || "total"} enemies.`;
  }

  if (definition.badge_type === "story_completion") {
    const linkedStory = storyMarkers.find((marker) => marker.id === definition.metric_key);
    return definition.metric_key ? `Complete story: ${linkedStory?.title ?? definition.metric_key}.` : `Complete ${definition.target_value} story marker${definition.target_value === 1 ? "" : "s"}.`;
  }

  if (definition.badge_type === "training_sessions") {
    return `Complete ${definition.target_value} ${definition.metric_key || "total"} training session${definition.target_value === 1 ? "" : "s"}.`;
  }

  return "Achievement rule.";
}

function formatProgressValue(type: BadgeType, value: number) {
  if (type === "distance") {
    if (value >= 1609.344) {
      return `${(value / 1609.344).toFixed(2)} mi`;
    }
    return `${Math.round(value * 3.28084).toLocaleString()} ft`;
  }

  return Math.floor(value).toLocaleString();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  summaryCard: {
    margin: 12,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
    marginTop: 4,
  },
  description: {
    color: colors.muted,
    lineHeight: 21,
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  hint: {
    color: colors.goldSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  message: {
    color: colors.blue,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryPill: {
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  summaryValue: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900",
  },
  summaryLabel: {
    color: colors.muted,
    marginTop: 3,
  },
  badgeGrid: {
    paddingHorizontal: 12,
    gap: 12,
  },
  badgeCard: {
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(5, 9, 10, 0.78)",
  },
  badgeEarned: {
    borderColor: colors.gold,
  },
  badgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badgeIcon: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
    overflow: "hidden",
  },
  badgeIconEarned: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.34,
    shadowRadius: 10,
  },
  badgeIconImage: {
    width: "100%",
    height: "100%",
  },
  badgeIconText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
  },
  badgeBody: {
    flex: 1,
  },
  badgeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  badgeType: {
    color: colors.goldSoft,
    marginTop: 2,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  earnedText: {
    color: colors.gold,
    fontWeight: "900",
  },
  lockedText: {
    color: colors.blue,
    fontWeight: "900",
  },
  adminCard: {
    margin: 12,
    padding: 14,
    gap: 12,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  formRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceGroup: {
    gap: 8,
  },
  choiceLabel: {
    color: colors.goldSoft,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  choiceActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  choiceTextActive: {
    color: colors.text,
  },
  enemySelectorHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  selectedEnemyText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  enemySelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  enemySelectCard: {
    width: 160,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  enemySelectCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.62)",
  },
  enemySelectImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  enemySelectImage: {
    width: "100%",
    height: "100%",
  },
  enemySelectInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  enemySelectInfo: {
    flex: 1,
    minWidth: 0,
  },
  enemySelectName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  enemySelectMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  toggleButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    color: "#120e08",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  dangerButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
  ruleCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  ruleMeta: {
    color: colors.goldSoft,
    fontWeight: "800",
  },
});
