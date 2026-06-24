import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Frame } from "../Frame";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../theme";
import { getCurrentRole, Role } from "../../services/mapService";
import { getItemDefinitions, ItemDefinition } from "../../services/inventoryService";
import type { FriendWithProfile } from "../../services/socialService";
import {
  createGuild,
  createParty,
  deleteSocialGroupGoal,
  GuildMemberWithProfile,
  inviteGuildMember,
  invitePartyMember,
  leaveGuild,
  leaveParty,
  PartyGuildState,
  PartyMemberWithProfile,
  respondToGuildInvite,
  respondToPartyInvite,
  saveSocialGroupGoal,
  SocialGoalWithProgress,
  SocialMemberProfile,
  socialGoalMetrics,
  SocialGoalMetric,
  getPartyGuildState,
} from "../../services/partyGuildService";

type PartyGuildPanelProps = {
  friends: FriendWithProfile[];
  onMessage: (message: string | null) => void;
};

type GroupMode = "party" | "guild";

export function PartyGuildPanel({ friends, onMessage }: PartyGuildPanelProps) {
  const [state, setState] = useState<PartyGuildState | null>(null);
  const [mode, setMode] = useState<GroupMode>("party");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<Role>("player");
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalMetric, setGoalMetric] = useState<SocialGoalMetric>("distance_walked_meters");
  const [goalMetricFilter, setGoalMetricFilter] = useState("");
  const [goalTarget, setGoalTarget] = useState("10");
  const [goalRewardTitle, setGoalRewardTitle] = useState("");
  const [goalRewardXp, setGoalRewardXp] = useState("0");
  const [goalRewardGold, setGoalRewardGold] = useState("0");
  const [goalRewardItems, setGoalRewardItems] = useState<Array<{ itemId: string; quantity: string }>>([]);
  const [goalIsActive, setGoalIsActive] = useState(true);

  const acceptedFriends = friends.filter((friend) => friend.status === "accepted" && friend.friend);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    setIsLoading(true);
    try {
      const [nextState, nextRole, nextItems] = await Promise.all([
        getPartyGuildState(),
        getCurrentRole(),
        getItemDefinitions(),
      ]);
      setState(nextState);
      setRole(nextRole);
      setItemDefinitions(nextItems);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to load parties and guilds. Confirm the party/guild migration has run.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      onMessage(`Name your ${mode} first.`);
      return;
    }

    try {
      if (mode === "party") {
        await createParty(trimmedName, description);
      } else {
        await createGuild(trimmedName, description);
      }
      setName("");
      setDescription("");
      onMessage(`${mode === "party" ? "Party" : "Guild"} created.`);
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : `Unable to create ${mode}.`);
    }
  }

  async function handleInvite(friendUserId: string) {
    if (!state) return;

    try {
      if (mode === "party") {
        if (!state.party) throw new Error("Create or join a party first.");
        await invitePartyMember(state.party.id, friendUserId);
      } else {
        if (!state.guild) throw new Error("Create or join a guild first.");
        await inviteGuildMember(state.guild.id, friendUserId);
      }
      onMessage("Invite sent.");
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to send invite.");
    }
  }

  async function respondToInvite(memberId: string, accepted: boolean, inviteMode: GroupMode) {
    try {
      if (inviteMode === "party") {
        await respondToPartyInvite(memberId, accepted);
      } else {
        await respondToGuildInvite(memberId, accepted);
      }
      onMessage(accepted ? "Invite accepted." : "Invite declined.");
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to respond to invite.");
    }
  }

  async function handleLeave(memberId: string) {
    try {
      if (mode === "party") {
        await leaveParty(memberId);
      } else {
        await leaveGuild(memberId);
      }
      onMessage(`You left the ${mode}.`);
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : `Unable to leave ${mode}.`);
    }
  }

  async function handleSaveGoal() {
    if (!activeGroup) {
      onMessage(`Create or join a ${mode} first.`);
      return;
    }

    if (!goalTitle.trim()) {
      onMessage("Name the goal first.");
      return;
    }

    try {
      await saveSocialGroupGoal({
        id: editingGoalId ?? undefined,
        groupType: mode,
        groupId: activeGroup.id,
        title: goalTitle,
        description: goalDescription,
        metricType: goalMetric,
        metricFilter: goalMetricFilter,
        targetValue: Number(goalTarget) || 1,
        rewardTitle: goalRewardTitle,
        rewardXp: Number(goalRewardXp) || 0,
        rewardGold: Number(goalRewardGold) || 0,
        rewardItems: goalRewardItems.map((item) => ({ itemId: item.itemId, quantity: Number(item.quantity) || 1 })),
        isActive: goalIsActive,
      });
      clearGoalForm();
      onMessage("Group goal saved.");
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save group goal.");
    }
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      await deleteSocialGroupGoal(goalId);
      clearGoalForm();
      onMessage("Group goal deleted.");
      await loadState();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to delete group goal.");
    }
  }

  function editGoal(goal: SocialGoalWithProgress) {
    setEditingGoalId(goal.id);
    setGoalTitle(goal.title);
    setGoalDescription(goal.description ?? "");
    setGoalMetric(goal.metric_type as SocialGoalMetric);
    setGoalMetricFilter(goal.metric_filter ?? "");
    setGoalTarget(String(goal.target_value ?? 1));
    setGoalRewardTitle(goal.reward_title ?? "");
    setGoalRewardXp(String(goal.reward_xp ?? 0));
    setGoalRewardGold(String(goal.reward_gold ?? 0));
    setGoalRewardItems(goal.rewards.map((reward) => ({ itemId: reward.reward_item_id, quantity: String(reward.reward_item_quantity ?? 1) })));
    setGoalIsActive(goal.is_active);
  }

  function clearGoalForm() {
    setEditingGoalId(null);
    setGoalTitle("");
    setGoalDescription("");
    setGoalMetric("distance_walked_meters");
    setGoalMetricFilter("");
    setGoalTarget("10");
    setGoalRewardTitle("");
    setGoalRewardXp("0");
    setGoalRewardGold("0");
    setGoalRewardItems([]);
    setGoalIsActive(true);
  }

  const activeGroup = mode === "party" ? state?.party : state?.guild;
  const activeMembers = mode === "party" ? state?.partyMembers ?? [] : state?.guildMembers ?? [];
  const activeGoals = mode === "party" ? state?.partyGoals ?? [] : state?.guildGoals ?? [];
  const activeMembership = activeMembers.find((member) => member.user_id === state?.userId) ?? null;
  const isLeader = activeMembership?.role === "leader";
  const isAdmin = role === "admin";
  const maxMembers = mode === "party" ? 5 : 20;

  return (
    <View style={styles.stack}>
      <View style={styles.modeTabs}>
        <Pressable style={[styles.modeTab, mode === "party" && styles.modeTabActive]} onPress={() => setMode("party")}>
          <Text style={styles.modeText}>Party</Text>
        </Pressable>
        <Pressable style={[styles.modeTab, mode === "guild" && styles.modeTabActive]} onPress={() => setMode("guild")}>
          <Text style={styles.modeText}>Guild</Text>
        </Pressable>
      </View>

      {isLoading ? <Text style={styles.copy}>Loading cooperative groups...</Text> : null}

      {state?.partyInvites.length ? (
        <InviteList
          title="Party Invites"
          rows={state.partyInvites.map((invite) => ({ id: invite.member.id, name: invite.party?.name ?? "Unknown Party", description: invite.party?.description ?? null }))}
          onAccept={(id) => void respondToInvite(id, true, "party")}
          onDecline={(id) => void respondToInvite(id, false, "party")}
        />
      ) : null}

      {state?.guildInvites.length ? (
        <InviteList
          title="Guild Invites"
          rows={state.guildInvites.map((invite) => ({ id: invite.member.id, name: invite.guild?.name ?? "Unknown Guild", description: invite.guild?.description ?? null }))}
          onAccept={(id) => void respondToInvite(id, true, "guild")}
          onDecline={(id) => void respondToInvite(id, false, "guild")}
        />
      ) : null}

      {activeGroup ? (
        <>
          <Frame style={styles.hero}>
            <Text style={styles.eyebrow}>{mode === "party" ? "Adventuring Party" : "Guild"}</Text>
            <Text style={styles.title}>{activeGroup.name}</Text>
            {activeGroup.description ? <Text style={styles.copy}>{activeGroup.description}</Text> : null}
            <View style={styles.statRow}>
              <Stat label="Members" value={`${activeMembers.length}/${activeGroup.max_members}`} />
              <Stat label="Goals" value={String(activeGoals.length)} />
              <Stat label="Role" value={activeMembership?.role ?? "member"} />
            </View>
            {activeMembership ? (
              <Pressable style={styles.secondaryButton} onPress={() => void handleLeave(activeMembership.id)}>
                <Text style={styles.secondaryText}>Leave {mode === "party" ? "Party" : "Guild"}</Text>
              </Pressable>
            ) : null}
          </Frame>

          {isLeader ? (
            <Frame style={styles.panel}>
              <Text style={styles.sectionTitle}>Invite Friends</Text>
              <Text style={styles.copy}>Invite accepted friends. {mode === "party" ? "Parties are built for small missions." : "Guilds can hold up to 20 members for larger goals."}</Text>
              {acceptedFriends.length === 0 ? <Text style={styles.copy}>Add friends first, then invite them here.</Text> : null}
              {acceptedFriends.map((friend) => friend.friend ? (
                <View key={friend.friend_user_id} style={styles.inviteRow}>
                  <MemberProfile profile={friend.friend} />
                  <Pressable style={styles.smallButton} onPress={() => void handleInvite(friend.friend_user_id)}>
                    <Text style={styles.buttonText}>Invite</Text>
                  </Pressable>
                </View>
              ) : null)}
            </Frame>
          ) : null}

          <Frame style={styles.panel}>
            <Text style={styles.sectionTitle}>{mode === "party" ? "Party" : "Guild"} Members</Text>
            {activeMembers.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </Frame>

          <Frame style={styles.panel}>
            <Text style={styles.sectionTitle}>Shared Goals</Text>
            {activeGoals.length === 0 ? (
              <Text style={styles.copy}>No active goals yet. Admin-created party and guild missions will appear here.</Text>
            ) : activeGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} itemDefinitions={itemDefinitions} onEdit={isAdmin ? editGoal : undefined} onDelete={isAdmin ? (goalId) => void handleDeleteGoal(goalId) : undefined} />
            ))}
          </Frame>

          {isAdmin ? (
            <AdminGoalBuilder
              mode={mode}
              editingGoalId={editingGoalId}
              goalTitle={goalTitle}
              goalDescription={goalDescription}
              goalMetric={goalMetric}
              goalMetricFilter={goalMetricFilter}
              goalTarget={goalTarget}
              goalRewardTitle={goalRewardTitle}
              goalRewardXp={goalRewardXp}
              goalRewardGold={goalRewardGold}
              goalRewardItems={goalRewardItems}
              goalIsActive={goalIsActive}
              itemDefinitions={itemDefinitions}
              onChangeTitle={setGoalTitle}
              onChangeDescription={setGoalDescription}
              onChangeMetric={setGoalMetric}
              onChangeMetricFilter={setGoalMetricFilter}
              onChangeTarget={setGoalTarget}
              onChangeRewardTitle={setGoalRewardTitle}
              onChangeRewardXp={setGoalRewardXp}
              onChangeRewardGold={setGoalRewardGold}
              onChangeRewardItems={setGoalRewardItems}
              onToggleActive={() => setGoalIsActive((value) => !value)}
              onSave={() => void handleSaveGoal()}
              onCancel={clearGoalForm}
            />
          ) : null}
        </>
      ) : (
        <Frame style={styles.panel}>
          <Text style={styles.sectionTitle}>Create a {mode === "party" ? "Party" : "Guild"}</Text>
          <Text style={styles.copy}>{mode === "party" ? "Parties are for 2-5 players and short cooperative missions." : "Guilds support up to 20 members and larger seasonal goals."}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={`${mode === "party" ? "Party" : "Guild"} name`} placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Short description optional" placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable style={styles.primaryButton} onPress={() => void handleCreate()}>
            <Text style={styles.primaryText}>Create {mode === "party" ? "Party" : "Guild"}</Text>
          </Pressable>
          <Text style={styles.debugLine}>Limit: {maxMembers} members. Shared goals can be added by admin data later.</Text>
        </Frame>
      )}
    </View>
  );
}

function InviteList({ title, rows, onAccept, onDecline }: { title: string; rows: Array<{ id: string; name: string; description: string | null }>; onAccept: (id: string) => void; onDecline: (id: string) => void }) {
  return (
    <Frame style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.id} style={styles.inviteCard}>
          <View style={styles.flex}>
            <Text style={styles.name}>{row.name}</Text>
            {row.description ? <Text style={styles.copy}>{row.description}</Text> : null}
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.smallButton} onPress={() => onAccept(row.id)}>
              <Text style={styles.buttonText}>Accept</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={() => onDecline(row.id)}>
              <Text style={styles.dangerText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Frame>
  );
}

function MemberRow({ member }: { member: PartyMemberWithProfile | GuildMemberWithProfile }) {
  return (
    <View style={styles.memberRow}>
      <MemberProfile profile={member.profile ?? null} />
      <View style={styles.rolePill}>
        <Text style={styles.roleText}>{member.role}</Text>
      </View>
    </View>
  );
}

function MemberProfile({ profile }: { profile: SocialMemberProfile | null }) {
  return (
    <View style={styles.memberProfile}>
      <View style={styles.portraitWrap}>
        {profile?.portrait_url ? <Image source={{ uri: profile.portrait_url }} style={styles.portrait} /> : <Text style={styles.initial}>{(profile?.character_name ?? "?").slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.flex}>
        <Text style={styles.name}>{profile?.character_name ?? "Unknown Player"}</Text>
        <Text style={styles.copy}>{profile?.display_name ?? "Profile pending"} / Lv {profile?.level ?? 1}</Text>
      </View>
    </View>
  );
}

function AdminGoalBuilder({
  mode,
  editingGoalId,
  goalTitle,
  goalDescription,
  goalMetric,
  goalMetricFilter,
  goalTarget,
  goalRewardTitle,
  goalRewardXp,
  goalRewardGold,
  goalRewardItems,
  goalIsActive,
  itemDefinitions,
  onChangeTitle,
  onChangeDescription,
  onChangeMetric,
  onChangeMetricFilter,
  onChangeTarget,
  onChangeRewardTitle,
  onChangeRewardXp,
  onChangeRewardGold,
  onChangeRewardItems,
  onToggleActive,
  onSave,
  onCancel,
}: {
  mode: GroupMode;
  editingGoalId: string | null;
  goalTitle: string;
  goalDescription: string;
  goalMetric: SocialGoalMetric;
  goalMetricFilter: string;
  goalTarget: string;
  goalRewardTitle: string;
  goalRewardXp: string;
  goalRewardGold: string;
  goalRewardItems: Array<{ itemId: string; quantity: string }>;
  goalIsActive: boolean;
  itemDefinitions: ItemDefinition[];
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeMetric: (value: SocialGoalMetric) => void;
  onChangeMetricFilter: (value: string) => void;
  onChangeTarget: (value: string) => void;
  onChangeRewardTitle: (value: string) => void;
  onChangeRewardXp: (value: string) => void;
  onChangeRewardGold: (value: string) => void;
  onChangeRewardItems: (value: Array<{ itemId: string; quantity: string }>) => void;
  onToggleActive: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const selectedMetric = socialGoalMetrics.find((metric) => metric.key === goalMetric);

  return (
    <Frame style={styles.panel}>
      <Text style={styles.sectionTitle}>{editingGoalId ? "Edit" : "Create"} {mode === "party" ? "Party" : "Guild"} Goal</Text>
      <Text style={styles.copy}>Admin tool. Contributions are recorded automatically from matching gameplay actions.</Text>
      <TextInput value={goalTitle} onChangeText={onChangeTitle} placeholder="Goal title" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={goalDescription} onChangeText={onChangeDescription} placeholder="Goal description" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Metric</Text>
      <View style={styles.chipWrap}>
        {socialGoalMetrics.map((metric) => (
          <Pressable key={metric.key} style={[styles.chip, goalMetric === metric.key && styles.chipActive]} onPress={() => onChangeMetric(metric.key)}>
            <Text style={styles.chipText}>{metric.label}</Text>
          </Pressable>
        ))}
      </View>
      {selectedMetric?.needsFilter ? (
        <TextInput value={goalMetricFilter} onChangeText={onChangeMetricFilter} placeholder={selectedMetric.filterLabel ?? "Filter value"} placeholderTextColor={colors.muted} style={styles.input} />
      ) : null}
      <TextInput value={goalTarget} onChangeText={onChangeTarget} placeholder="Target value" placeholderTextColor={colors.muted} style={styles.input} keyboardType="numeric" />
      <Text style={styles.label}>Rewards</Text>
      <TextInput value={goalRewardTitle} onChangeText={onChangeRewardTitle} placeholder="Reward title optional" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.actionRow}>
        <TextInput value={goalRewardXp} onChangeText={onChangeRewardXp} placeholder="XP" placeholderTextColor={colors.muted} style={[styles.input, styles.compactInput]} keyboardType="numeric" />
        <TextInput value={goalRewardGold} onChangeText={onChangeRewardGold} placeholder="Gold" placeholderTextColor={colors.muted} style={[styles.input, styles.compactInput]} keyboardType="numeric" />
      </View>
      <Text style={styles.label}>Item Rewards</Text>
      {goalRewardItems.map((reward, index) => (
        <View key={`${reward.itemId}-${index}`} style={styles.rewardRow}>
          <View style={styles.chipWrap}>
            {itemDefinitions.slice(0, 16).map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, reward.itemId === item.id && styles.chipActive]}
                onPress={() => {
                  const next = [...goalRewardItems];
                  next[index] = { ...next[index], itemId: item.id };
                  onChangeRewardItems(next);
                }}
              >
                <Text style={styles.chipText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actionRow}>
            <TextInput
              value={reward.quantity}
              onChangeText={(value) => {
                const next = [...goalRewardItems];
                next[index] = { ...next[index], quantity: value };
                onChangeRewardItems(next);
              }}
              placeholder="Qty"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.compactInput]}
              keyboardType="numeric"
            />
            <Pressable style={styles.dangerButton} onPress={() => onChangeRewardItems(goalRewardItems.filter((_, itemIndex) => itemIndex !== index))}>
              <Text style={styles.dangerText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.secondaryButton} onPress={() => onChangeRewardItems([...goalRewardItems, { itemId: itemDefinitions[0]?.id ?? "", quantity: "1" }])}>
        <Text style={styles.secondaryText}>Add Item Reward</Text>
      </Pressable>
      <Pressable style={[styles.secondaryButton, goalIsActive && styles.activeToggle]} onPress={onToggleActive}>
        <Text style={styles.secondaryText}>Active: {goalIsActive ? "Yes" : "No"}</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={onSave}>
        <Text style={styles.primaryText}>{editingGoalId ? "Save Goal" : "Create Goal"}</Text>
      </Pressable>
      {editingGoalId ? (
        <Pressable style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryText}>Cancel Edit</Text>
        </Pressable>
      ) : null}
    </Frame>
  );
}

function GoalCard({ goal, itemDefinitions, onEdit, onDelete }: { goal: SocialGoalWithProgress; itemDefinitions: ItemDefinition[]; onEdit?: (goal: SocialGoalWithProgress) => void; onDelete?: (goalId: string) => void }) {
  const progress = Math.min(100, Math.round((goal.total_contribution / Math.max(1, Number(goal.target_value))) * 100));

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.flex}>
          <Text style={styles.name}>{goal.title}</Text>
          {goal.description ? <Text style={styles.copy}>{goal.description}</Text> : null}
        </View>
        <Text style={styles.progressText}>{progress}%</Text>
      </View>
      <ProgressBar value={goal.total_contribution} max={Math.max(1, Number(goal.target_value))} color={colors.gold} />
      <View style={styles.statRow}>
        <Stat label="Total" value={`${formatNumber(goal.total_contribution)} / ${formatNumber(Number(goal.target_value))}`} />
        <Stat label="You" value={formatNumber(goal.user_contribution)} />
        <Stat label="Metric" value={goal.metric_type.replace(/_/g, " ")} />
      </View>
      {goal.reward_title || goal.reward_xp || goal.reward_gold ? (
        <Text style={styles.rewardText}>Reward: {goal.reward_title ?? "Group reward"}{goal.reward_xp ? ` / ${goal.reward_xp} XP` : ""}{goal.reward_gold ? ` / ${goal.reward_gold} Gold` : ""}</Text>
      ) : null}
      {goal.rewards.length ? (
        <View style={styles.chipWrap}>
          {goal.rewards.map((reward) => (
            <View key={reward.id} style={styles.rewardPill}>
              <Text style={styles.chipText}>{itemDefinitions.find((item) => item.id === reward.reward_item_id)?.name ?? "Item"} x{reward.reward_item_quantity}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {goal.contributors.slice(0, 4).map((contributor) => (
        <View key={contributor.user_id} style={styles.contributionRow}>
          <Text style={styles.copy}>{contributor.profile?.character_name ?? "Unknown Player"}</Text>
          <Text style={styles.score}>{formatNumber(contributor.amount)}</Text>
        </View>
      ))}
      {goal.is_complete ? <Text style={styles.rewardText}>Completed. Rewards sent to member inboxes.</Text> : null}
      {onEdit || onDelete ? (
        <View style={styles.actionRow}>
          {onEdit ? (
            <Pressable style={styles.smallButton} onPress={() => onEdit(goal)}>
              <Text style={styles.buttonText}>Edit</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable style={styles.dangerButton} onPress={() => onDelete(goal.id)}>
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  modeTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  modeTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  modeTabActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 170, 93, 0.12)",
  },
  modeText: {
    color: colors.text,
    fontWeight: "900",
  },
  panel: {
    marginHorizontal: 12,
    padding: 14,
    gap: 10,
  },
  hero: {
    marginHorizontal: 12,
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
  },
  sectionTitle: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  compactInput: {
    flex: 1,
  },
  label: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#0b0905",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  activeToggle: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.36)",
  },
  smallButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 61, 86, 0.58)",
  },
  dangerButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffb4aa",
    paddingHorizontal: 12,
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
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  chipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.58)",
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  rewardRow: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.2)",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  rewardPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.48)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(217, 170, 93, 0.08)",
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  inviteCard: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  memberProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  portraitWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061118",
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  rolePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(217, 170, 93, 0.1)",
  },
  roleText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.24)",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
  },
  goalCard: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.28)",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  progressText: {
    color: colors.gold,
    fontWeight: "900",
  },
  rewardText: {
    color: colors.gold,
    fontWeight: "800",
  },
  contributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 8,
  },
  score: {
    color: colors.text,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  debugLine: {
    color: colors.muted,
    fontSize: 12,
  },
});
