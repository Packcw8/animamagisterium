import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ItemPicker } from "../map/MarkerEditorControls";
import { colors, fonts } from "../theme";
import type { ItemDefinition } from "../../services/inventoryService";
import {
  deleteWeeklyLeaderboardReward,
  getWeeklyLeaderboardRewards,
  getWeeklyLeaderboardSettings,
  saveWeeklyLeaderboardReward,
  saveWeeklyLeaderboardSettings,
  weekStartDays,
  weeklyRewardMetrics,
  type WeeklyLeaderboardMetric,
  type WeeklyLeaderboardReward,
} from "../../services/leaderboardService";

type WeeklyLeaderboardAdminPanelProps = {
  itemDefinitions: ItemDefinition[];
  onMessage?: (message: string) => void;
};

const rankOptions = [1, 2, 3];

export function WeeklyLeaderboardAdminPanel({ itemDefinitions, onMessage }: WeeklyLeaderboardAdminPanelProps) {
  const [weekStartsOn, setWeekStartsOn] = useState(2);
  const [rewards, setRewards] = useState<WeeklyLeaderboardReward[]>([]);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [metric, setMetric] = useState<WeeklyLeaderboardMetric>("total_distance_walked_meters");
  const [rank, setRank] = useState(1);
  const [title, setTitle] = useState("");
  const [rewardXp, setRewardXp] = useState("0");
  const [rewardGold, setRewardGold] = useState("0");
  const [rewardItemId, setRewardItemId] = useState<string | null>(null);
  const [rewardItemQuantity, setRewardItemQuantity] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const groupedRewards = useMemo(
    () => weeklyRewardMetrics.map((metricOption) => ({
      ...metricOption,
      rewards: rankOptions.map((rankOption) => rewards.find((reward) => reward.metric === metricOption.key && reward.rank === rankOption) ?? null),
    })),
    [rewards],
  );

  useEffect(() => {
    void loadWeeklyRewards();
  }, []);

  function setMessage(message: string) {
    setLocalMessage(message);
    onMessage?.(message);
  }

  async function loadWeeklyRewards() {
    try {
      const [settings, nextRewards] = await Promise.all([getWeeklyLeaderboardSettings(), getWeeklyLeaderboardRewards()]);
      setWeekStartsOn(Number(settings.week_starts_on ?? 2));
      setRewards(nextRewards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load weekly leaderboard rewards.");
    }
  }

  async function saveStartDay(day: number) {
    try {
      const settings = await saveWeeklyLeaderboardSettings(day);
      setWeekStartsOn(Number(settings.week_starts_on ?? day));
      setMessage(`Weekly leaderboards now start on ${weekStartDays.find((item) => item.key === Number(settings.week_starts_on))?.label ?? "the selected day"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save weekly start day.");
    }
  }

  function clearForm() {
    setEditingRewardId(null);
    setMetric("total_distance_walked_meters");
    setRank(1);
    setTitle("");
    setRewardXp("0");
    setRewardGold("0");
    setRewardItemId(null);
    setRewardItemQuantity("1");
    setIsActive(true);
  }

  function editReward(reward: WeeklyLeaderboardReward) {
    setEditingRewardId(reward.id);
    setMetric(reward.metric);
    setRank(reward.rank);
    setTitle(reward.title ?? "");
    setRewardXp(String(reward.reward_xp ?? 0));
    setRewardGold(String(reward.reward_gold ?? 0));
    setRewardItemId(reward.reward_item_id);
    setRewardItemQuantity(String(reward.reward_item_quantity ?? 1));
    setIsActive(reward.is_active ?? true);
  }

  async function saveReward() {
    try {
      await saveWeeklyLeaderboardReward({
        id: editingRewardId ?? undefined,
        metric,
        rank,
        title,
        reward_xp: Number(rewardXp) || 0,
        reward_gold: Number(rewardGold) || 0,
        reward_item_id: rewardItemId,
        reward_item_quantity: Number(rewardItemQuantity) || 1,
        is_active: isActive,
      });
      setMessage("Weekly reward saved.");
      clearForm();
      await loadWeeklyRewards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save weekly reward.");
    }
  }

  async function removeReward(rewardId: string) {
    try {
      await deleteWeeklyLeaderboardReward(rewardId);
      setMessage("Weekly reward deleted.");
      if (editingRewardId === rewardId) {
        clearForm();
      }
      await loadWeeklyRewards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete weekly reward.");
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Weekly Leaderboard Rewards</Text>
      <Text style={styles.copy}>Configure when the weekly contest starts, then set rewards for rank 1, 2, and 3. Rewards are delivered by mail for the previous completed week so current rankings are never paid early.</Text>
      {localMessage ? <Text style={styles.message}>{localMessage}</Text> : null}

      <Text style={styles.subTitle}>Week Starts On</Text>
      <View style={styles.choiceWrap}>
        {weekStartDays.map((day) => (
          <Pressable key={day.key} style={[styles.chip, weekStartsOn === day.key && styles.chipActive]} onPress={() => void saveStartDay(day.key)}>
            <Text style={[styles.chipText, weekStartsOn === day.key && styles.chipTextActive]}>{day.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.builder}>
        <Text style={styles.subTitle}>{editingRewardId ? "Edit Reward" : "Create Reward"}</Text>
        <Text style={styles.label}>Metric</Text>
        <View style={styles.choiceWrap}>
          {weeklyRewardMetrics.map((option) => (
            <Pressable key={option.key} style={[styles.chip, metric === option.key && styles.chipActive]} onPress={() => setMetric(option.key)}>
              <Text style={[styles.chipText, metric === option.key && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Rank</Text>
        <View style={styles.choiceWrap}>
          {rankOptions.map((option) => (
            <Pressable key={option} style={[styles.chip, rank === option && styles.chipActive]} onPress={() => setRank(option)}>
              <Text style={[styles.chipText, rank === option && styles.chipTextActive]}>#{option}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Reward title" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.twoCol}>
          <TextInput value={rewardXp} onChangeText={setRewardXp} keyboardType="numeric" placeholder="XP" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={rewardGold} onChangeText={setRewardGold} keyboardType="numeric" placeholder="Gold" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <ItemPicker
          label="Reward item optional"
          items={itemDefinitions}
          selectedId={rewardItemId}
          onSelect={setRewardItemId}
        />
        <TextInput value={rewardItemQuantity} onChangeText={setRewardItemQuantity} keyboardType="numeric" placeholder="Item quantity" placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable style={[styles.toggle, isActive && styles.toggleActive]} onPress={() => setIsActive((value) => !value)}>
          <Text style={styles.buttonText}>Active: {isActive ? "Yes" : "No"}</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => void saveReward()}>
          <Text style={styles.primaryText}>{editingRewardId ? "Update Reward" : "Save Reward"}</Text>
        </Pressable>
        {editingRewardId ? (
          <Pressable style={styles.secondaryButton} onPress={clearForm}>
            <Text style={styles.buttonText}>Cancel Edit</Text>
          </Pressable>
        ) : null}
      </View>

      {groupedRewards.map((group) => (
        <View key={group.key} style={styles.rewardGroup}>
          <Text style={styles.subTitle}>{group.label}</Text>
          {group.rewards.map((reward, index) => (
            <View key={`${group.key}-${index + 1}`} style={styles.rewardRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardTitle}>{reward?.title || "No reward set"}</Text>
                <Text style={styles.copy}>{reward ? formatRewardSummary(reward, itemDefinitions) : "Players can place here, but nothing is paid yet."}</Text>
              </View>
              {reward ? (
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => editReward(reward)}><Text style={styles.buttonText}>Edit</Text></Pressable>
                  <Pressable style={styles.dangerButton} onPress={() => void removeReward(reward.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function formatRewardSummary(reward: WeeklyLeaderboardReward, itemDefinitions: ItemDefinition[]) {
  const itemName = reward.reward_item_id ? itemDefinitions.find((item) => item.id === reward.reward_item_id)?.name ?? "Item" : null;
  const parts = [
    reward.reward_xp > 0 ? `${reward.reward_xp} XP` : null,
    reward.reward_gold > 0 ? `${reward.reward_gold} gold` : null,
    itemName ? `${itemName} x${reward.reward_item_quantity}` : null,
    reward.is_active ? null : "Inactive",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "No payout values set.";
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  subTitle: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 15,
  },
  copy: {
    color: colors.muted,
    lineHeight: 19,
  },
  message: {
    color: colors.blue,
    fontWeight: "900",
  },
  label: {
    color: colors.goldSoft,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  chipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.68)",
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#dff6ff",
  },
  builder: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  twoCol: {
    flexDirection: "row",
    gap: 8,
  },
  toggle: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  toggleActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.58)",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#090b0a",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 61, 86, 0.42)",
  },
  dangerButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffb4aa",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62, 15, 15, 0.35)",
  },
  buttonText: {
    color: colors.text,
    fontWeight: "900",
  },
  dangerText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
  rewardGroup: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.28)",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: colors.gold,
    fontWeight: "900",
  },
  rewardCopy: {
    flex: 1,
    minWidth: 0,
  },
  rewardTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  rowActions: {
    gap: 6,
  },
});
