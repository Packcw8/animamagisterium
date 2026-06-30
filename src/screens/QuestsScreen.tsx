import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Frame } from "../components/Frame";
import { Header } from "../components/Header";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import { AttributeKey, completeTrainingSession, getTrainingLevelProgress, getTrainingState, TrainingCardState } from "../services/trainingService";
import { getCurrentRole, Role } from "../services/mapService";
import {
  defaultProgressionSettings,
  GameProgressionSettings,
  getProgressionSettings,
  getTrainingConfigs,
  saveProgressionSettings,
  saveTrainingConfig,
  TrainingAttributeConfig,
} from "../services/progressionService";
import {
  classUnlockLevel,
  formatAttributeName,
  getPlayerClassState,
  PlayerClassState,
  resolveClassImageUri,
  saveClassDefinition,
  selectActiveClass,
} from "../services/classService";

type QuestsScreenProps = {
  character: CharacterWithDetails;
  onCharacterUpdated: (character: CharacterWithDetails) => void;
};

export function QuestsScreen({ character, onCharacterUpdated }: QuestsScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const [cards, setCards] = useState<TrainingCardState[]>([]);
  const [dailyCompleted, setDailyCompleted] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(2);
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState<AttributeKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [role, setRole] = useState<Role>("player");
  const [progressionSettings, setProgressionSettings] = useState<GameProgressionSettings>(defaultProgressionSettings);
  const [trainingConfigs, setTrainingConfigs] = useState<TrainingAttributeConfig[]>([]);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [showAdminBalance, setShowAdminBalance] = useState(false);
  const [classes, setClasses] = useState<PlayerClassState[]>([]);
  const [classMessage, setClassMessage] = useState<string | null>(null);
  const [editingClassKey, setEditingClassKey] = useState<string | null>(null);

  useEffect(() => {
    void loadTraining();
  }, [character.id, character.xp, character.level]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadTraining() {
    setIsLoading(true);
    setError(null);

    try {
      const state = await getTrainingState(character);
      const [settings, configs, currentRole, classState] = await Promise.all([getProgressionSettings(), getTrainingConfigs(), getCurrentRole(), getPlayerClassState(character)]);
      setCards(state.cards);
      setDailyCompleted(state.dailyCompleted);
      setDailyLimit(state.dailyLimit);
      setSelectedAttribute((current) => current ?? state.cards[0]?.key ?? null);
      setProgressionSettings(settings);
      setTrainingConfigs(configs);
      setRole(currentRole);
      setClasses(classState);
      setEditingClassKey((current) => current ?? classState[0]?.key ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load training.");
    } finally {
      setIsLoading(false);
    }
  }

  async function completeTraining(attributeKey: AttributeKey) {
    setIsCompleting(attributeKey);
    setError(null);

    try {
      const result = await completeTrainingSession(character, attributeKey);
      onCharacterUpdated(result.character);
      setMessage(`${result.message} The ledger glows as your discipline is recorded.`);
      const state = await getTrainingState(result.character);
      setCards(state.cards);
      setDailyCompleted(state.dailyCompleted);
      setDailyLimit(state.dailyLimit);
      setClasses(await getPlayerClassState(result.character));
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete training.");
    } finally {
      setIsCompleting(null);
    }
  }

  const selectedCard = cards.find((card) => card.key === selectedAttribute) ?? cards[0] ?? null;
  const selectedLevelProgress = selectedCard ? getTrainingLevelProgress(selectedCard.currentXp, selectedCard.levelCap) : null;
  const selectedConfig = trainingConfigs.find((config) => config.attribute_key === selectedCard?.key) ?? null;
  const unlockedClassCount = classes.filter((item) => item.unlocked).length;
  const activeClass = classes.find((item) => item.selected) ?? null;
  const editingClass = classes.find((item) => item.key === editingClassKey) ?? classes[0] ?? null;

  async function saveGlobalBalance() {
    try {
      const saved = await saveProgressionSettings(progressionSettings);
      setProgressionSettings(saved);
      setBalanceMessage("Global progression balance saved.");
      await loadTraining();
    } catch (saveError) {
      setBalanceMessage(saveError instanceof Error ? saveError.message : "Unable to save progression balance.");
    }
  }

  async function saveAttributeBalance() {
    if (!selectedConfig) {
      return;
    }

    try {
      const saved = await saveTrainingConfig(selectedConfig);
      setTrainingConfigs((current) => current.map((config) => (config.attribute_key === saved.attribute_key ? saved : config)));
      setBalanceMessage(`${saved.name} training balance saved.`);
      await loadTraining();
    } catch (saveError) {
      setBalanceMessage(saveError instanceof Error ? saveError.message : "Unable to save training balance.");
    }
  }

  function updateSelectedConfig(values: Partial<TrainingAttributeConfig>) {
    if (!selectedConfig) {
      return;
    }

    setTrainingConfigs((current) => current.map((config) => (config.attribute_key === selectedConfig.attribute_key ? { ...config, ...values } : config)));
  }

  async function chooseClass(classItem: PlayerClassState) {
    if (!classItem.unlocked) {
      setClassMessage(`${classItem.name} unlocks at ${formatAttributeName(classItem.firstAttribute)} ${classUnlockLevel} and ${formatAttributeName(classItem.secondAttribute)} ${classUnlockLevel}.`);
      return;
    }

    try {
      await selectActiveClass(character, classItem.key);
      setClassMessage(`${classItem.name} is now your active class.`);
      setClasses(await getPlayerClassState(character));
    } catch (classError) {
      setClassMessage(classError instanceof Error ? classError.message : "Unable to select class.");
    }
  }

  async function saveClassVisuals() {
    if (!editingClass) {
      return;
    }

    try {
      const saved = await saveClassDefinition({
        class_key: editingClass.key,
        name: editingClass.name,
        description: editingClass.description,
        image_url: editingClass.imageUrl,
        background_image_url: editingClass.backgroundImageUrl,
      });
      setClassMessage(`${saved.name} class visuals saved.`);
      setClasses(await getPlayerClassState(character));
    } catch (classError) {
      setClassMessage(classError instanceof Error ? classError.message : "Unable to save class visuals.");
    }
  }

  function updateEditingClass(values: Partial<Pick<PlayerClassState, "name" | "description" | "imageUrl" | "backgroundImageUrl">>) {
    if (!editingClass) {
      return;
    }

    setClasses((current) => current.map((item) => item.key === editingClass.key ? { ...item, ...values } : item));
  }

  return (
    <Screen>
      <Header title="Quests / Training" />
      <View style={styles.tabs}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Training</Text>
        </View>
        <View style={styles.inactiveTab}>
          <Text style={styles.inactiveTabText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Quest Goals</Text>
        </View>
      </View>

      <Frame style={styles.summary}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.kicker}>Daily Discipline</Text>
            <Text style={styles.summaryTitle}>Training Ledger</Text>
          </View>
          <View style={styles.sessionSeal}>
            <Text style={styles.sessionSealValue}>{dailyCompleted}/{dailyLimit}</Text>
            <Text style={styles.sessionSealLabel}>Today</Text>
          </View>
        </View>
        <Text style={styles.copy}>Choose one attribute and record a focused session. Each session should be at least 30 minutes unless you set a stricter rule later.</Text>
        <View style={styles.limitRow}>
          <Text style={styles.limitText}>{dailyLimit - dailyCompleted} session{dailyLimit - dailyCompleted === 1 ? "" : "s"} remaining</Text>
          <Text style={styles.limitText}>Character XP {character.xp}</Text>
        </View>
        <ProgressBar value={dailyCompleted} max={dailyLimit} color={colors.gold} height={8} />
      </Frame>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isLoading ? (
        <Frame style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.copy}>Opening the training ledger...</Text>
        </Frame>
      ) : (
        <View style={styles.content}>
          <View style={[styles.trainingBoard, isCompact && styles.trainingBoardCompact]}>
            <Frame style={[styles.attributeColumn, isCompact && styles.attributeColumnCompact]}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.sectionTitle}>Attributes</Text>
                <Text style={styles.infoDot}>i</Text>
              </View>
              {cards.map((card) => {
                const config = trainingConfigs.find((item) => item.attribute_key === card.key);
                const levelProgress = getTrainingLevelProgress(card.currentXp, card.levelCap);
                return (
                  <Pressable
                    key={card.key}
                    style={[styles.attributeListCard, selectedCard?.key === card.key && styles.attributeListCardActive]}
                    onPress={() => setSelectedAttribute(card.key)}
                  >
                    <TrainingIcon name={card.name} imageUrl={config?.image_url ?? null} active={selectedCard?.key === card.key} />
                    <View style={styles.attributeListBody}>
                      <View style={styles.attributeListHeader}>
                        <Text style={styles.attributeName}>{card.name}</Text>
                        <Text style={styles.attributeProgressText}>{levelProgress.progress} / {levelProgress.required}</Text>
                      </View>
                      <Text style={styles.attributeMeta}>Level {card.currentLevel}</Text>
                      <ProgressBar value={levelProgress.progress} max={levelProgress.required} color={selectedCard?.key === card.key ? colors.gold : colors.blue} height={5} />
                    </View>
                    <Text style={styles.attributeChevron}>{">"}</Text>
                  </Pressable>
                );
              })}
              <View style={styles.attributeGuideCard}>
                <Text style={styles.attributeGuideIcon}>?</Text>
                <View style={styles.attributeListBody}>
                  <Text style={styles.attributeName}>Attribute Guide</Text>
                  <Text style={styles.attributeMeta}>Learn how attributes work</Text>
                </View>
              </View>
            </Frame>
            {selectedCard ? (
              <Frame style={[styles.trainingCard, isCompact && styles.trainingCardCompact]}>
                <View style={styles.trainingHeader}>
                  <TrainingHeroIcon name={selectedCard.name} imageUrl={selectedConfig?.image_url ?? null} />
                  <View style={styles.trainingHeaderText}>
                    <Text style={styles.kicker}>Selected Focus</Text>
                    <Text style={styles.trainingTitle}>{selectedCard.name}</Text>
                    <Text style={styles.effect}>{selectedCard.effect}</Text>
                  </View>
                  <View style={styles.levelShield}>
                    <Text style={styles.levelShieldLabel}>Level</Text>
                    <Text style={styles.levelShieldValue}>{selectedCard.currentLevel}</Text>
                  </View>
                </View>
                <View style={styles.bonusBox}>
                  <Text style={styles.sectionTitle}>Attribute Bonuses</Text>
                  <Info label="Session Minimum" value={selectedCard.goalLabel} compact />
                  <Info label="Suggested Work" value={selectedCard.activities} compact />
                </View>
                <View style={styles.xpBlock}>
                  <View style={styles.levelProgressHeader}>
                    <Text style={styles.xpText}>Level Progress</Text>
                    <Text style={styles.attributeMeta}>Level {(selectedLevelProgress?.level ?? 0) + 1}</Text>
                  </View>
                  <ProgressBar value={selectedLevelProgress?.progress ?? 0} max={selectedLevelProgress?.required ?? 1} color={colors.gold} height={8} />
                  <Text style={styles.copy}>
                    {selectedLevelProgress?.progress ?? 0} / {selectedLevelProgress?.required ?? 1} sessions to level {(selectedLevelProgress?.level ?? 0) + 1}
                  </Text>
                </View>
                <Pressable
                  style={[styles.primaryButton, (!canTrain(selectedCard, dailyCompleted, dailyLimit, now) || isCompleting !== null) && styles.disabledButton]}
                  onPress={() => void completeTraining(selectedCard.key)}
                  disabled={!canTrain(selectedCard, dailyCompleted, dailyLimit, now) || isCompleting !== null}
                >
                  <Text style={styles.primaryText}>{isCompleting === selectedCard.key ? "Recording Training..." : "Complete Training Session"}</Text>
                </Pressable>
                <Text style={styles.cooldownText}>Cooldown: {getCooldownText(selectedCard.cooldownUntil, now)}</Text>
                <View style={styles.historyCompact}>
                  <Text style={styles.historyIcon}>#</Text>
                  <View style={styles.attributeListBody}>
                    <Text style={styles.sectionTitle}>Completion History</Text>
                    <Text style={styles.copy}>{selectedCard.history.length} session{selectedCard.history.length === 1 ? "" : "s"} recorded</Text>
                  </View>
                  <Text style={styles.attributeChevron}>{">"}</Text>
                </View>
              </Frame>
            ) : null}
          </View>

          <Frame style={styles.classPanel}>
            <View style={styles.classHeader}>
              <View>
                <Text style={styles.kicker}>Class Combinations</Text>
                <Text style={styles.classTitle}>{activeClass ? activeClass.name : "No Active Class"}</Text>
              </View>
              <Text style={styles.classCount}>{unlockedClassCount} / {classes.length}</Text>
            </View>
            <Text style={styles.copy}>Classes unlock automatically when both linked attributes reach level {classUnlockLevel}. Unlock them all, then choose which one is active.</Text>
            {classMessage ? <Text style={styles.successText}>{classMessage}</Text> : null}
            <View style={styles.classGrid}>
              {classes.map((classItem) => (
                <Pressable key={classItem.key} style={[styles.classCard, isCompact && styles.classCardCompact, classItem.unlocked && styles.classCardUnlocked, classItem.selected && styles.classCardSelected]} onPress={() => void chooseClass(classItem)}>
                  <ClassArt classItem={classItem} />
                  <Text style={styles.className} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{classItem.name}</Text>
                  <Text style={styles.classPair}>{formatAttributeName(classItem.firstAttribute).slice(0, 3).toUpperCase()} + {formatAttributeName(classItem.secondAttribute).slice(0, 3).toUpperCase()}</Text>
                  <View style={styles.classProgressRow}>
                    <Text style={classItem.firstLevel >= classUnlockLevel ? styles.classProgressReady : styles.classProgress}>{classItem.firstLevel}/{classUnlockLevel}</Text>
                    <Text style={classItem.secondLevel >= classUnlockLevel ? styles.classProgressReady : styles.classProgress}>{classItem.secondLevel}/{classUnlockLevel}</Text>
                  </View>
                  <Text style={classItem.unlocked ? styles.classUnlockedText : styles.classLockedText}>{classItem.selected ? "Active" : classItem.unlocked ? "Unlocked" : "Locked"}</Text>
                </Pressable>
              ))}
            </View>
          </Frame>
        </View>
      )}

      <Frame style={styles.comingSoon}>
        <Text style={styles.sectionTitle}>Quest Goals / Coming Soon</Text>
        <Text style={styles.copy}>Story quests, seasonal objectives, map discoveries, and event rewards will connect here after the map/event system grows.</Text>
      </Frame>

      {role === "admin" ? (
        <Frame style={styles.adminBalance}>
          <Pressable style={styles.adminBalanceHeader} onPress={() => setShowAdminBalance((current) => !current)}>
            <View style={styles.headerText}>
              <Text style={styles.sectionTitle}>Admin Game Balance</Text>
              <Text style={styles.copy}>Tune level caps, XP curves, cooldowns, and selected training rules.</Text>
            </View>
            <Text style={styles.toggleText}>{showAdminBalance ? "Hide" : "Show"}</Text>
          </Pressable>

          {balanceMessage ? <Text style={styles.successText}>{balanceMessage}</Text> : null}

          {showAdminBalance ? (
            <View style={styles.balanceBody}>
              <Text style={styles.balanceGroupTitle}>Global Level Rules</Text>
              <View style={styles.balanceGrid}>
                <BalanceNumber grid label="Overall level cap" value={progressionSettings.character_level_cap} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_level_cap: value }))} />
                <BalanceNumber grid label="XP for next level base" value={progressionSettings.character_xp_base} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_xp_base: value }))} />
                <BalanceNumber grid label="XP growth per level" value={progressionSettings.character_xp_growth} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_xp_growth: value }))} />
                <BalanceNumber grid label="Default attribute cap" value={progressionSettings.default_attribute_level_cap} onChange={(value) => setProgressionSettings((current) => ({ ...current, default_attribute_level_cap: value }))} />
                <View style={styles.fixedBalanceBox}>
                  <Text style={styles.infoLabel}>Daily training limit</Text>
                  <Text style={styles.fixedBalanceValue}>2 sessions</Text>
                  <Text style={styles.copy}>Fixed system rule.</Text>
                </View>
                <BalanceNumber grid label="Cooldown minutes" value={progressionSettings.training_cooldown_minutes} onChange={(value) => setProgressionSettings((current) => ({ ...current, training_cooldown_minutes: value }))} />
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveGlobalBalance()}>
                <Text style={styles.primaryText}>Save Global Balance</Text>
              </Pressable>

              {selectedConfig ? (
                <View style={styles.attributeBalance}>
                  <Text style={styles.balanceGroupTitle}>Selected Training: {selectedConfig.name}</Text>
                  <Text style={styles.copy}>Choose an attribute card above, then edit its training text and scaling here.</Text>
                  <BalanceText label="Training name" value={selectedConfig.name} onChange={(value) => updateSelectedConfig({ name: value })} />
                  <BalanceText label="Session effect text" value={selectedConfig.effect} onChange={(value) => updateSelectedConfig({ effect: value })} />
                  <BalanceText label="Activity examples" value={selectedConfig.activities} onChange={(value) => updateSelectedConfig({ activities: value })} />
                  <BalanceText label="Training icon image URL/path" value={selectedConfig.image_url ?? ""} onChange={(value) => updateSelectedConfig({ image_url: value })} />
                  <BalanceText label="Training background image URL/path" value={selectedConfig.background_image_url ?? ""} onChange={(value) => updateSelectedConfig({ background_image_url: value })} />
                  <BalanceText label="Goal text template" value={selectedConfig.goal_template} onChange={(value) => updateSelectedConfig({ goal_template: value })} />
                  <Text style={styles.copy}>Template tokens: {"{value}"}, {"{unit}"}, {"{attribute}"}</Text>
                  <View style={styles.balanceGrid}>
                    <BalanceText grid label="Unit" value={selectedConfig.unit} onChange={(value) => updateSelectedConfig({ unit: value })} />
                    <BalanceNumber grid label="Starting goal" value={selectedConfig.starting_goal} onChange={(value) => updateSelectedConfig({ starting_goal: value })} />
                    <BalanceNumber grid label="Goal increase" value={selectedConfig.goal_increment} onChange={(value) => updateSelectedConfig({ goal_increment: value })} />
                    <BalanceNumber grid label="Character XP reward" value={selectedConfig.character_xp_reward} onChange={(value) => updateSelectedConfig({ character_xp_reward: value })} />
                    <BalanceNumber grid label="Attribute XP reward" value={selectedConfig.attribute_xp_reward} onChange={(value) => updateSelectedConfig({ attribute_xp_reward: value })} />
                    <BalanceNumber grid label="Attribute level cap" value={selectedConfig.level_cap} onChange={(value) => updateSelectedConfig({ level_cap: value })} />
                  </View>
                  <Pressable style={styles.primaryButton} onPress={() => void saveAttributeBalance()}>
                    <Text style={styles.primaryText}>Save Selected Training</Text>
                  </Pressable>
                </View>
              ) : null}

              {editingClass ? (
                <View style={styles.attributeBalance}>
                  <Text style={styles.balanceGroupTitle}>Class Visuals</Text>
                  <Text style={styles.copy}>Classes still unlock from attributes. These fields only control player-facing text and images.</Text>
                  <View style={styles.classAdminGrid}>
                    {classes.map((classItem) => (
                      <Pressable key={classItem.key} style={[styles.classAdminChip, editingClass.key === classItem.key && styles.classAdminChipActive]} onPress={() => setEditingClassKey(classItem.key)}>
                        <Text style={styles.classAdminChipText}>{classItem.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <BalanceText label="Class name" value={editingClass.name} onChange={(value) => updateEditingClass({ name: value })} />
                  <BalanceText label="Class description" value={editingClass.description} onChange={(value) => updateEditingClass({ description: value })} />
                  <BalanceText label="Class image URL/path" value={editingClass.imageUrl ?? ""} onChange={(value) => updateEditingClass({ imageUrl: value })} />
                  <BalanceText label="Class background image URL/path" value={editingClass.backgroundImageUrl ?? ""} onChange={(value) => updateEditingClass({ backgroundImageUrl: value })} />
                  <Pressable style={styles.primaryButton} onPress={() => void saveClassVisuals()}>
                    <Text style={styles.primaryText}>Save Class Visuals</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </Frame>
      ) : null}

      <Modal transparent visible={Boolean(message)} animationType="fade" onRequestClose={() => setMessage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Training Complete</Text>
            <Text style={styles.modalText}>{message}</Text>
            <Pressable style={styles.primaryButton} onPress={() => setMessage(null)}>
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.infoRow, compact && styles.infoRowCompact]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ClassArt({ classItem }: { classItem: PlayerClassState }) {
  const imageUri = resolveClassImageUri(classItem.imageUrl);

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={styles.classImage} />;
  }

  return (
    <View style={styles.classImageFallback}>
      <Text style={styles.classImageFallbackText}>{classItem.name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function TrainingIcon({ name, imageUrl, active }: { name: string; imageUrl: string | null; active: boolean }) {
  const uri = resolveTrainingImageUri(imageUrl);
  if (uri) {
    return <Image source={{ uri }} style={[styles.trainingIconImage, active && styles.trainingIconImageActive]} />;
  }

  return (
    <View style={[styles.trainingIconFallback, active && styles.trainingIconImageActive]}>
      <Text style={styles.trainingIconText}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function TrainingHeroIcon({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const uri = resolveTrainingImageUri(imageUrl);
  if (uri) {
    return <Image source={{ uri }} style={styles.trainingHeroImage} />;
  }

  return (
    <View style={styles.trainingHeroFallback}>
      <Text style={styles.trainingHeroText}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function resolveTrainingImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replaceAll("\\", "/").replace(/^\/?assets\/training\//i, "/assets/training/");
  if (normalized.startsWith("/assets/training/")) {
    return normalized;
  }
  if (!normalized.includes("/")) {
    return `/assets/training/${normalized}`;
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function BalanceText({ label, value, onChange, grid = false }: { label: string; value: string; onChange: (value: string) => void; grid?: boolean }) {
  return (
    <View style={[styles.balanceField, grid && styles.balanceGridField]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput style={styles.balanceInput} value={String(value ?? "")} onChangeText={onChange} placeholderTextColor={colors.muted} />
    </View>
  );
}

function BalanceNumber({ label, value, onChange, grid = false }: { label: string; value: number; onChange: (value: number) => void; grid?: boolean }) {
  return (
    <BalanceText
      grid={grid}
      label={label}
      value={String(value ?? 0)}
      onChange={(nextValue) => onChange(Number(nextValue) || 0)}
    />
  );
}

function canTrain(card: TrainingCardState, dailyCompleted: number, dailyLimit: number, now: number) {
  if (dailyCompleted >= dailyLimit) {
    return false;
  }

  if (!card.cooldownUntil) {
    return true;
  }

  return new Date(card.cooldownUntil).getTime() <= now;
}

function getCooldownText(cooldownUntil: string | null, now: number) {
  if (!cooldownUntil) {
    return "Ready";
  }

  const remainingMs = new Date(cooldownUntil).getTime() - now;

  if (remainingMs <= 0) {
    return "Ready";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  activeTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62, 43, 22, 0.65)",
  },
  inactiveTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  activeTabText: {
    color: colors.text,
    fontWeight: "900",
  },
  inactiveTabText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center",
    fontSize: 12,
  },
  summary: {
    margin: 14,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: "900",
  },
  sessionSeal: {
    minWidth: 76,
    minHeight: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217, 164, 65, 0.08)",
  },
  sessionSealValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  sessionSealLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  adminBalance: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    gap: 12,
  },
  adminBalanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  toggleText: {
    color: colors.blue,
    fontWeight: "900",
  },
  balanceBody: {
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 12,
  },
  balanceGroupTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  attributeBalance: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 12,
  },
  balanceField: {
    width: "100%",
    gap: 6,
  },
  balanceGridField: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    maxWidth: "100%",
  },
  fixedBalanceBox: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    maxWidth: "100%",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  fixedBalanceValue: {
    color: colors.text,
    fontWeight: "900",
  },
  balanceInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  successText: {
    color: colors.blue,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  limitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  limitText: {
    color: colors.text,
    fontWeight: "800",
  },
  loading: {
    marginHorizontal: 14,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  content: {
    paddingHorizontal: 14,
    gap: 12,
  },
  trainingBoard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  trainingBoardCompact: {
    flexDirection: "column",
    gap: 10,
  },
  attributeColumn: {
    flex: 0.42,
    minWidth: 140,
    padding: 10,
    gap: 7,
  },
  attributeColumnCompact: {
    flex: undefined,
    minWidth: 0,
    width: "100%",
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  infoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 16,
  },
  attributeListCard: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 7,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  attributeListCardActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(84, 45, 20, 0.55)",
  },
  attributeListBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  attributeListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  attributeProgressText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    flexShrink: 0,
  },
  attributeChevron: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900",
  },
  attributeGuideCard: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  attributeGuideIcon: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: "900",
  },
  trainingIconImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trainingIconImageActive: {
    borderColor: colors.gold,
  },
  trainingIconFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  trainingIconText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  attributeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attributeCard: {
    width: "48%",
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    justifyContent: "space-between",
    backgroundColor: "rgba(5, 8, 8, 0.68)",
  },
  attributeCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.5)",
  },
  attributeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  attributeSigil: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  attributeSigilActive: {
    borderColor: colors.blue,
  },
  attributeSigilText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  attributeLevel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  attributeName: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 0,
  },
  attributeMeta: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  trainingCard: {
    flex: 0.58,
    padding: 16,
    gap: 14,
  },
  trainingCardCompact: {
    flex: undefined,
    width: "100%",
    padding: 12,
    gap: 12,
  },
  trainingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trainingHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trainingHeroImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  trainingHeroFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217,164,65,0.12)",
  },
  trainingHeroText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "900",
  },
  trainingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  readyBadge: {
    maxWidth: 140,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  readyBadgeText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  levelShield: {
    width: 42,
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#7f2c2c",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103, 22, 22, 0.55)",
  },
  levelShieldLabel: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  levelShieldValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  effect: {
    color: colors.blue,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },
  trainingInfoGrid: {
    gap: 10,
  },
  bonusBox: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  infoRow: {
    gap: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingBottom: 10,
  },
  infoRowCompact: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  infoLabel: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.text,
    lineHeight: 20,
  },
  xpBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  levelProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  xpText: {
    color: colors.text,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#120e08",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
  cooldownText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
  history: {
    gap: 8,
    paddingTop: 4,
  },
  historyItem: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  historyCompact: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  historyIcon: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900",
  },
  classPanel: {
    padding: 14,
    gap: 12,
  },
  classHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  classTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  classCount: {
    color: colors.gold,
    fontWeight: "900",
  },
  classGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classCard: {
    width: "31.5%",
    minHeight: 142,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 8,
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.34)",
    opacity: 0.72,
  },
  classCardCompact: {
    width: "48.5%",
    minHeight: 132,
  },
  classCardUnlocked: {
    opacity: 1,
    borderColor: "rgba(217,164,65,0.5)",
  },
  classCardSelected: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  classImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  classImageFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  classImageFallbackText: {
    color: colors.gold,
    fontWeight: "900",
  },
  className: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    maxWidth: "100%",
  },
  classPair: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  classProgressRow: {
    flexDirection: "row",
    gap: 6,
  },
  classProgress: {
    color: "#ff8a8a",
    fontSize: 11,
    fontWeight: "900",
  },
  classProgressReady: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
  },
  classLockedText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  classUnlockedText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
  },
  classAdminGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classAdminChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  classAdminChipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  classAdminChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  comingSoon: {
    margin: 14,
    padding: 14,
    gap: 8,
  },
  errorText: {
    color: "#ffb4aa",
    marginHorizontal: 14,
    marginBottom: 10,
    lineHeight: 20,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 18,
    gap: 14,
    backgroundColor: "#080b0b",
  },
  modalTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: "900",
  },
  modalText: {
    color: colors.text,
    lineHeight: 22,
  },
});
