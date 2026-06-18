import { supabase, Tables } from "../lib/supabase";
import { getCharacter, updateCharacter } from "./characterService";
import { grantItemToCharacter } from "./inventoryService";
import { getCurrentUserId, getFriendRows, updateFriendRequest } from "./socialService";

export type InboxReward = Tables["player_inbox_rewards"] & {
  item?: Pick<Tables["item_definitions"], "id" | "name" | "image_path"> | null;
};

export type InboxItem = {
  id: string;
  type: "friend_request" | "reward";
  title: string;
  body: string;
  createdAt: string;
  isUnread: boolean;
  friendRequestId?: string;
  reward?: InboxReward;
};

export type InboxState = {
  unreadCount: number;
  items: InboxItem[];
};

export async function getInboxState(): Promise<InboxState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { unreadCount: 0, items: [] };
  }

  const [friends, rewards] = await Promise.all([getFriendRows(), getInboxRewards(userId)]);
  const friendRequests = friends.filter((row) => row.status === "pending" && row.addressee_id === userId);

  const friendItems: InboxItem[] = friendRequests.map((request) => {
    const name = request.friend?.character_name ?? request.friend?.display_name ?? "A player";

    return {
      id: `friend-${request.id}`,
      type: "friend_request",
      title: "Friend Request",
      body: `${name} wants to add you as a friend.`,
      createdAt: request.created_at,
      isUnread: true,
      friendRequestId: request.id,
    };
  });

  const rewardItems: InboxItem[] = rewards.map((reward) => ({
    id: `reward-${reward.id}`,
    type: "reward",
    title: reward.title,
    body: getRewardBody(reward),
    createdAt: reward.created_at,
    isUnread: !reward.seen_at,
    reward,
  }));

  const items = [...friendItems, ...rewardItems].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const unreadCount = friendItems.length + rewardItems.filter((item) => item.isUnread).length;

  return { unreadCount, items };
}

export async function getInboxUnreadCount() {
  const state = await getInboxState();
  return state.unreadCount;
}

export async function markInboxRewardsSeen(rewardIds: string[]) {
  if (rewardIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("player_inbox_rewards")
    .update({ seen_at: new Date().toISOString() })
    .in("id", rewardIds)
    .is("seen_at", null);

  if (error) {
    throw error;
  }
}

export async function acceptFriendRequest(friendRequestId: string) {
  await updateFriendRequest(friendRequestId, "accepted");
}

export async function declineFriendRequest(friendRequestId: string) {
  await updateFriendRequest(friendRequestId, "declined");
}

export async function claimInboxReward(rewardId: string) {
  const { data, error } = await supabase
    .from("player_inbox_rewards")
    .select("*")
    .eq("id", rewardId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const reward = data as Tables["player_inbox_rewards"] | null;

  if (!reward || reward.is_claimed) {
    throw new Error("This reward has already been claimed.");
  }

  const character = await getCharacter();

  if (!character || character.user_id !== reward.user_id) {
    throw new Error("Unable to find your character for this reward.");
  }

  if (reward.reward_item_id) {
    await grantItemToCharacter(character.id, reward.reward_item_id, Math.max(1, reward.reward_item_quantity));
  }

  if (reward.reward_xp || reward.reward_gold) {
    await updateCharacter(character.id, {
      xp: character.xp + reward.reward_xp,
      gold: character.gold + reward.reward_gold,
    });
  }

  const { error: claimError } = await supabase
    .from("player_inbox_rewards")
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      seen_at: reward.seen_at ?? new Date().toISOString(),
    })
    .eq("id", reward.id);

  if (claimError) {
    throw claimError;
  }

  return getCharacter();
}

async function getInboxRewards(userId: string) {
  const { data, error } = await supabase
    .from("player_inbox_rewards")
    .select("*, item:reward_item_id(id,name,image_path)")
    .eq("user_id", userId)
    .eq("is_claimed", false)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.toLowerCase().includes("player_inbox_rewards")) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as InboxReward[];
}

function getRewardBody(reward: InboxReward) {
  const parts = [
    reward.reward_xp > 0 ? `${reward.reward_xp} XP` : null,
    reward.reward_gold > 0 ? `${reward.reward_gold} gold` : null,
    reward.item ? `${reward.item.name} x${Math.max(1, reward.reward_item_quantity)}` : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return reward.body ?? "A reward is waiting for you.";
  }

  return `${reward.body ? `${reward.body} ` : ""}Reward: ${parts.join(", ")}.`;
}
