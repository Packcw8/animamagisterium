import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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

type QuestsScreenProps = {
  character: CharacterWithDetails;
  onCharacterUpdated: (character: CharacterWithDetails) => void;
};

export function QuestsScreen({ character, onCharacterUpdated }: QuestsScreenProps) {
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
      const [settings, configs, currentRole] = await Promise.all([getProgressionSettings(), getTrainingConfigs(), getCurrentRole()]);
      setCards(state.cards);
      setDailyCompleted(state.dailyCompleted);
      setDailyLimit(state.dailyLimit);
      setSelectedAttribute((current) => current ?? state.cards[0]?.key ?? null);
      setProgressionSettings(settings);
      setTrainingConfigs(configs);
      setRole(currentRole);
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
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete training.");
    } finally {
      setIsCompleting(null);
    }
  }

  const selectedCard = cards.find((card) => card.key === selectedAttribute) ?? cards[0] ?? null;
  const selectedLevelProgress = selectedCard ? getTrainingLevelProgress(selectedCard.currentXp, selectedCard.levelCap) : null;
  const selectedConfig = trainingConfigs.find((config) => config.attribute_key === selectedCard?.key) ?? null;

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

  return (
    <Screen>
      <Header title="Quests / Training" />
      <View style={styles.tabs}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>Training</Text>
        </View>
        <View style={styles.inactiveTab}>
          <Text style={styles.inactiveTabText}>Quest Goals / Coming Soon</Text>
        </View>
      </View>

      <Frame style={styles.summary}>
        <Text style={styles.sectionTitle}>Daily Training Ledger</Text>
        <Text style={styles.copy}>Complete up to {dailyLimit} full training sessions per day. Only one attribute can be trained at a time.</Text>
        <View style={styles.limitRow}>
          <Text style={styles.limitText}>{dailyCompleted} / {dailyLimit} sessions today</Text>
          <Text style={styles.limitText}>Character XP {character.xp}</Text>
        </View>
        <ProgressBar value={dailyCompleted} max={dailyLimit} color={colors.gold} height={8} />
      </Frame>

      {role === "admin" ? (
        <Frame style={styles.adminBalance}>
          <Text style={styles.sectionTitle}>Admin Game Balance</Text>
          <Text style={styles.copy}>Tune level caps, XP curves, cooldowns, and the selected attribute training session.</Text>
          {balanceMessage ? <Text style={styles.successText}>{balanceMessage}</Text> : null}
          <View style={styles.balanceGrid}>
            <BalanceNumber label="Overall level cap" value={progressionSettings.character_level_cap} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_level_cap: value }))} />
            <BalanceNumber label="XP for next level base" value={progressionSettings.character_xp_base} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_xp_base: value }))} />
            <BalanceNumber label="XP growth per level" value={progressionSettings.character_xp_growth} onChange={(value) => setProgressionSettings((current) => ({ ...current, character_xp_growth: value }))} />
            <BalanceNumber label="Default attribute cap" value={progressionSettings.default_attribute_level_cap} onChange={(value) => setProgressionSettings((current) => ({ ...current, default_attribute_level_cap: value }))} />
            <BalanceNumber label="Daily training limit" value={progressionSettings.daily_training_limit} onChange={(value) => setProgressionSettings((current) => ({ ...current, daily_training_limit: value }))} />
            <BalanceNumber label="Cooldown minutes" value={progressionSettings.training_cooldown_minutes} onChange={(value) => setProgressionSettings((current) => ({ ...current, training_cooldown_minutes: value }))} />
          </View>
          <Pressable style={styles.primaryButton} onPress={() => void saveGlobalBalance()}>
            <Text style={styles.primaryText}>Save Global Balance</Text>
          </Pressable>

          {selectedConfig ? (
            <View style={styles.attributeBalance}>
              <Text style={styles.sectionTitle}>Selected Training: {selectedConfig.name}</Text>
              <BalanceText label="Training name" value={selectedConfig.name} onChange={(value) => updateSelectedConfig({ name: value })} />
              <BalanceText label="Session effect text" value={selectedConfig.effect} onChange={(value) => updateSelectedConfig({ effect: value })} />
              <BalanceText label="Activity examples" value={selectedConfig.activities} onChange={(value) => updateSelectedConfig({ activities: value })} />
              <BalanceText label="Goal text template" value={selectedConfig.goal_template} onChange={(value) => updateSelectedConfig({ goal_template: value })} />
              <Text style={styles.copy}>Template tokens: {"{value}"}, {"{unit}"}, {"{attribute}"}</Text>
              <View style={styles.balanceGrid}>
                <BalanceText label="Unit" value={selectedConfig.unit} onChange={(value) => updateSelectedConfig({ unit: value })} />
                <BalanceNumber label="Starting goal" value={selectedConfig.starting_goal} onChange={(value) => updateSelectedConfig({ starting_goal: value })} />
                <BalanceNumber label="Goal increase" value={selectedConfig.goal_increment} onChange={(value) => updateSelectedConfig({ goal_increment: value })} />
                <BalanceNumber label="Character XP reward" value={selectedConfig.character_xp_reward} onChange={(value) => updateSelectedConfig({ character_xp_reward: value })} />
                <BalanceNumber label="Attribute XP reward" value={selectedConfig.attribute_xp_reward} onChange={(value) => updateSelectedConfig({ attribute_xp_reward: value })} />
                <BalanceNumber label="Attribute level cap" value={selectedConfig.level_cap} onChange={(value) => updateSelectedConfig({ level_cap: value })} />
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveAttributeBalance()}>
                <Text style={styles.primaryText}>Save Selected Training</Text>
              </Pressable>
            </View>
          ) : null}
        </Frame>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isLoading ? (
        <Frame style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.copy}>Opening the training ledger...</Text>
        </Frame>
      ) : (
        <View style={styles.content}>
          <View style={styles.attributeGrid}>
            {cards.map((card) => (
              <Pressable
                key={card.key}
                style={[styles.attributeCard, selectedCard?.key === card.key && styles.attributeCardActive]}
                onPress={() => setSelectedAttribute(card.key)}
              >
                <Text style={styles.attributeName}>{card.name}</Text>
                <Text style={styles.attributeMeta}>Level {card.currentLevel}</Text>
                <Text style={styles.attributeMeta}>{card.currentXp} sessions</Text>
              </Pressable>
            ))}
          </View>

          {selectedCard ? (
            <Frame style={styles.trainingCard}>
              <Text style={styles.trainingTitle}>{selectedCard.name} Training</Text>
              <Text style={styles.effect}>{selectedCard.effect}</Text>
              <Info label="Current Goal" value={selectedCard.goalLabel} />
              <Info label="Cooldown" value={getCooldownText(selectedCard.cooldownUntil, now)} />
              <Info label="Activities" value={selectedCard.activities} />
              <View style={styles.xpBlock}>
                <Text style={styles.xpText}>Level Progress</Text>
                <ProgressBar value={selectedLevelProgress?.progress ?? 0} max={selectedLevelProgress?.required ?? 1} color={colors.blue} height={8} />
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
              <View style={styles.history}>
                <Text style={styles.sectionTitle}>Completion History</Text>
                {selectedCard.history.length === 0 ? (
                  <Text style={styles.copy}>No sessions recorded yet.</Text>
                ) : (
                  selectedCard.history.map((session) => (
                    <Text key={session.id} style={styles.historyItem}>
                      {new Date(session.completed_at).toLocaleDateString()} - {session.activity_label} - session {session.attribute_xp}
                    </Text>
                  ))
                )}
              </View>
            </Frame>
          ) : null}
        </View>
      )}

      <Frame style={styles.comingSoon}>
        <Text style={styles.sectionTitle}>Quest Goals / Coming Soon</Text>
        <Text style={styles.copy}>Story quests, seasonal objectives, map discoveries, and event rewards will connect here after the map/event system grows.</Text>
      </Frame>

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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BalanceText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.balanceField}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput style={styles.balanceInput} value={String(value ?? "")} onChangeText={onChange} placeholderTextColor={colors.muted} />
    </View>
  );
}

function BalanceNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <BalanceText
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
    padding: 14,
    gap: 10,
  },
  adminBalance: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    gap: 12,
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
    flexGrow: 1,
    flexBasis: "45%",
    gap: 6,
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
  attributeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attributeCard: {
    width: "48%",
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  attributeCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.55)",
  },
  attributeName: {
    color: colors.gold,
    fontWeight: "900",
    marginBottom: 8,
  },
  attributeMeta: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  trainingCard: {
    padding: 14,
    gap: 12,
  },
  trainingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  effect: {
    color: colors.blue,
    lineHeight: 20,
    fontWeight: "800",
  },
  infoRow: {
    gap: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingBottom: 10,
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
