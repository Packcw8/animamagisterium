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
  const [showTrainingInfo, setShowTrainingInfo] = useState(false);
  const [activeSection, setActiveSection] = useState<"training" | "classes">("training");
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [progressionSettings, setProgressionSettings] = useState<GameProgressionSettings>(defaultProgressionSettings);
  const [trainingConfigs, setTrainingConfigs] = useState<TrainingAttributeConfig[]>([]);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [showAdminBalance, setShowAdminBalance] = useState(false);
  const [classes, setClasses] = useState<PlayerClassState[]>([]);
  const [classMessage, setClassMessage] = useState<string | null>(null);
  const [previewClassKey, setPreviewClassKey] = useState<string | null>(null);
  const [editingClassKey, setEditingClassKey] = useState<string | null>(null);

  useEffect(() => {
    void loadTraining();
  }, [character.id, character.xp, character.level]);

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
      setPreviewClassKey((current) => current ?? classState.find((item) => !item.unlocked)?.key ?? classState[0]?.key ?? null);
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
  const previewClass = classes.find((item) => item.key === previewClassKey) ?? null;
  const classProgressFocus = previewClass ?? activeClass ?? classes.find((item) => !item.unlocked) ?? classes[0] ?? null;
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
    setPreviewClassKey(classItem.key);

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
        <Pressable style={activeSection === "training" ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveSection("training")}>
          <Text style={activeSection === "training" ? styles.activeTabText : styles.inactiveTabText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Training</Text>
        </Pressable>
        <Pressable style={activeSection === "classes" ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveSection("classes")}>
          <Text style={activeSection === "classes" ? styles.activeTabText : styles.inactiveTabText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Class Progression</Text>
        </Pressable>
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
        <Text style={styles.copy}>Complete up to 2 full 30-minute training sessions per day. Each session must train a different attribute.</Text>
        <View style={styles.limitRow}>
          <Text style={styles.limitText}>{Math.max(0, dailyLimit - dailyCompleted)} session{Math.max(0, dailyLimit - dailyCompleted) === 1 ? "" : "s"} remaining</Text>
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
      ) : activeSection === "training" ? (
        <View style={styles.content}>
          <View style={[styles.trainingBoard, isCompact ? styles.trainingBoardCompact : undefined]}>
            <Frame style={isCompact ? [styles.attributeColumn, styles.attributeColumnCompact] : styles.attributeColumn}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.sectionTitle}>Attributes</Text>
                <Pressable style={styles.infoDotButton} onPress={() => setShowTrainingInfo(true)}>
                  <Text style={styles.infoDot}>i</Text>
                </Pressable>
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
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.attributeName}>
                          {card.name}
                        </Text>
                        <Text style={styles.attributeProgressText}>{levelProgress.progress} / {levelProgress.required}</Text>
                      </View>
                      <Text style={styles.attributeMeta}>Level {card.currentLevel}</Text>
                      <ProgressBar value={levelProgress.progress} max={levelProgress.required} color={selectedCard?.key === card.key ? colors.gold : colors.blue} height={5} />
                    </View>
                    <Text style={styles.attributeChevron}>{">"}</Text>
                  </Pressable>
                );
              })}
            </Frame>
            {selectedCard ? (
              <Frame style={isCompact ? [styles.trainingCard, styles.trainingCardCompact] : styles.trainingCard}>
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
                    {selectedLevelProgress?.progress ?? 0} / {selectedLevelProgress?.required ?? 1} sessions toward level {(selectedLevelProgress?.level ?? 0) + 1}
                  </Text>
                </View>
                <Pressable
                  style={[styles.primaryButton, (!canTrain(selectedCard, dailyCompleted, dailyLimit) || isCompleting !== null) && styles.disabledButton]}
                  onPress={() => void completeTraining(selectedCard.key)}
                  disabled={!canTrain(selectedCard, dailyCompleted, dailyLimit) || isCompleting !== null}
                >
                  <Text style={styles.primaryText}>{isCompleting === selectedCard.key ? "Recording Training..." : "Complete Training Session"}</Text>
                </Pressable>
                <Text style={styles.cooldownText}>{selectedCard.trainedToday ? "Already trained today. Choose a different attribute." : "30 minute session"}</Text>
                <View style={styles.historyCompact}>
                  <Text style={styles.historyIcon}>#</Text>
                  <View style={styles.attributeListBody}>
                    <Text style={styles.sectionTitle}>Completion History</Text>
                    <Text style={styles.copy}>{selectedCard.currentXp} total session{selectedCard.currentXp === 1 ? "" : "s"} recorded</Text>
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
                <Pressable key={classItem.key} style={[styles.classCard, isCompact && styles.classCardCompact, classItem.unlocked && styles.classCardUnlocked, classItem.key === previewClassKey && styles.classCardPreviewed, classItem.selected && styles.classCardSelected]} onPress={() => void chooseClass(classItem)}>
                  <ClassCardBackground classItem={classItem} />
                  <ClassArt classItem={classItem} />
                  <Text style={styles.className} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{classItem.name}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.classPair}>
                    {formatAttributeName(classItem.firstAttribute).slice(0, 3).toUpperCase()} + {formatAttributeName(classItem.secondAttribute).slice(0, 3).toUpperCase()}
                  </Text>
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
      ) : (
        <View style={styles.content}>
          <Frame style={styles.classPanel}>
            <View style={styles.classHeader}>
              <View>
                <Text style={styles.kicker}>Class Progression</Text>
                <Text style={styles.classTitle}>{classProgressFocus ? classProgressFocus.name : "Choose A Class Path"}</Text>
              </View>
              <Text style={styles.classCount}>{unlockedClassCount} / {classes.length}</Text>
            </View>
            <Text style={styles.copy}>Tap a locked class to preview what it needs. Once unlocked, tapping it makes it your active class.</Text>
            {classMessage ? <Text style={styles.successText}>{classMessage}</Text> : null}
            <View style={styles.classGrid}>
              {classes.map((classItem) => (
                <Pressable key={classItem.key} style={[styles.classCard, isCompact && styles.classCardCompact, classItem.unlocked && styles.classCardUnlocked, classItem.key === previewClassKey && styles.classCardPreviewed, classItem.selected && styles.classCardSelected]} onPress={() => void chooseClass(classItem)}>
                  <ClassCardBackground classItem={classItem} />
                  <ClassArt classItem={classItem} />
                  <Text style={styles.className} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{classItem.name}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.classPair}>
                    {formatAttributeName(classItem.firstAttribute)} + {formatAttributeName(classItem.secondAttribute)}
                  </Text>
                  <View style={styles.classProgressRow}>
                    <Text style={classItem.firstLevel >= classUnlockLevel ? styles.classProgressReady : styles.classProgress}>{classItem.firstLevel}/{classUnlockLevel}</Text>
                    <Text style={classItem.secondLevel >= classUnlockLevel ? styles.classProgressReady : styles.classProgress}>{classItem.secondLevel}/{classUnlockLevel}</Text>
                  </View>
                  <Text style={classItem.unlocked ? styles.classUnlockedText : styles.classLockedText}>{classItem.selected ? "Active" : classItem.unlocked ? "Unlocked" : "Locked"}</Text>
                </Pressable>
              ))}
            </View>
            {classProgressFocus ? (
              <View style={styles.classGoalPanel}>
                <Text style={styles.sectionTitle}>{classProgressFocus.name} Goals</Text>
                <Text style={styles.copy}>{classProgressFocus.description}</Text>
                <ClassTrainingGoal classItem={classProgressFocus} attributeKey={classProgressFocus.firstAttribute} trainingConfigs={trainingConfigs} />
                <ClassTrainingGoal classItem={classProgressFocus} attributeKey={classProgressFocus.secondAttribute} trainingConfigs={trainingConfigs} />
              </View>
            ) : null}
          </Frame>
        </View>
      )}

      {role === "admin" ? (
        <Frame style={styles.adminBalance}>
          <Pressable style={styles.adminBalanceHeader} onPress={() => setShowAdminBalance((current) => !current)}>
            <View style={styles.headerText}>
              <Text style={styles.sectionTitle}>Admin Game Balance</Text>
              <Text style={styles.copy}>Tune character XP rules plus player-facing training and class visuals.</Text>
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
                <View style={styles.fixedBalanceBox}>
                  <Text style={styles.infoLabel}>Daily training limit</Text>
                  <Text style={styles.fixedBalanceValue}>2 sessions</Text>
                  <Text style={styles.copy}>Fixed system rule. Sessions must train different attributes.</Text>
                </View>
                <View style={styles.fixedBalanceBox}>
                  <Text style={styles.infoLabel}>Attribute cap</Text>
                  <Text style={styles.fixedBalanceValue}>10</Text>
                  <Text style={styles.copy}>Season 1 cap.</Text>
                </View>
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveGlobalBalance()}>
                <Text style={styles.primaryText}>Save Global Balance</Text>
              </Pressable>

              {selectedConfig ? (
                <View style={styles.attributeBalance}>
                  <Text style={styles.balanceGroupTitle}>Selected Training: {selectedConfig.name}</Text>
                  <Text style={styles.copy}>Choose an attribute card above, then edit its player-facing text and images. Training duration, caps, and level curve are fixed for Season 1.</Text>
                  <BalanceText label="Training name" value={selectedConfig.name} onChange={(value) => updateSelectedConfig({ name: value })} />
                  <BalanceText label="Session effect text" value={selectedConfig.effect} onChange={(value) => updateSelectedConfig({ effect: value })} />
                  <BalanceText label="Activity examples" value={selectedConfig.activities} onChange={(value) => updateSelectedConfig({ activities: value })} />
                  <BalanceText label="Training icon image URL/path" value={selectedConfig.image_url ?? ""} onChange={(value) => updateSelectedConfig({ image_url: value })} />
                  <BalanceText label="Training background image URL/path" value={selectedConfig.background_image_url ?? ""} onChange={(value) => updateSelectedConfig({ background_image_url: value })} />
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

      <Modal transparent visible={showTrainingInfo} animationType="fade" onRequestClose={() => setShowTrainingInfo(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Training Rules</Text>
            <Text style={styles.modalText}>Each training session represents 30 focused minutes.</Text>
            <Text style={styles.modalText}>You can complete 2 sessions per day, but they must be different attributes.</Text>
            <Text style={styles.modalText}>Attribute levels require cumulative sessions: level 1 at 1 session, level 2 at 3 total, level 3 at 7 total, then the requirement keeps growing.</Text>
            <Text style={styles.modalText}>Season 1 attributes cap at level 10. Classes unlock when both linked attributes reach level {classUnlockLevel}.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setShowTrainingInfo(false)}>
              <Text style={styles.primaryText}>Got It</Text>
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

function ClassCardBackground({ classItem }: { classItem: PlayerClassState }) {
  const backgroundUri = resolveClassImageUri(classItem.backgroundImageUrl);
  if (!backgroundUri) {
    return null;
  }

  return (
    <>
      <Image source={{ uri: backgroundUri }} style={styles.classCardBackgroundImage} />
      <View style={styles.classCardBackgroundScrim} />
    </>
  );
}

function ClassTrainingGoal({ classItem, attributeKey, trainingConfigs }: { classItem: PlayerClassState; attributeKey: AttributeKey; trainingConfigs: TrainingAttributeConfig[] }) {
  const level = attributeKey === classItem.firstAttribute ? classItem.firstLevel : classItem.secondLevel;
  const config = trainingConfigs.find((item) => item.attribute_key === attributeKey);
  return (
    <View style={styles.classGoalRow}>
      <View style={styles.classGoalTop}>
        <Text style={styles.infoLabel}>{formatAttributeName(attributeKey)}</Text>
        <Text style={level >= classUnlockLevel ? styles.classProgressReady : styles.classProgress}>{level}/{classUnlockLevel}</Text>
      </View>
      <Text style={styles.infoValue}>{config?.activities ?? "Complete focused 30 minute sessions for this attribute."}</Text>
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

function canTrain(card: TrainingCardState, dailyCompleted: number, dailyLimit: number) {
  if (dailyCompleted >= dailyLimit) {
    return false;
  }

  return !card.trainedToday;
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
    paddingBottom: 150,
    gap: 12,
  },
  trainingBoard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  trainingBoardCompact: {
    flexDirection: "column",
    gap: 14,
  },
  attributeColumn: {
    flex: 0.42,
    minWidth: 140,
    padding: 10,
    gap: 7,
  },
  attributeColumnCompact: {
    flex: undefined,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    width: "100%",
    marginBottom: 8,
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
  infoDotButton: {
    minWidth: 34,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "space-between",
  },
  classGoalPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  classGoalRow: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(217,164,65,0.06)",
  },
  classGoalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
    overflow: "hidden",
  },
  classCardBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  classCardBackgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  classCardCompact: {
    width: "48%",
    minHeight: 132,
  },
  classCardUnlocked: {
    opacity: 1,
    borderColor: "rgba(217,164,65,0.5)",
  },
  classCardPreviewed: {
    opacity: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(84, 45, 20, 0.45)",
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
