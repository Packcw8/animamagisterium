import { supabase, Tables } from "../lib/supabase";
import type { LeaderboardRow } from "./leaderboardService";

export type FriendRow = Tables["player_friends"];
export type FriendWithProfile = FriendRow & {
  friend_user_id: string;
  friend?: LeaderboardRow | null;
};

export async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

export async function getFriendRows() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_friends")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FriendRow[];
  const friendIds = Array.from(new Set(rows.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id))));
  const profiles = await getLeaderboardProfiles(friendIds);

  return rows.map((row) => {
    const friendUserId = row.requester_id === userId ? row.addressee_id : row.requester_id;

    return {
      ...row,
      friend_user_id: friendUserId,
      friend: profiles.find((profile) => profile.user_id === friendUserId) ?? null,
    };
  }) satisfies FriendWithProfile[];
}

export async function sendFriendRequest(addresseeId: string) {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("You must be signed in to add friends.");
  }

  if (userId === addresseeId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const existing = await findExistingFriendship(userId, addresseeId);
  if (existing) {
    if (existing.status === "declined") {
      const { error } = await supabase
        .from("player_friends")
        .update({ status: "pending", requester_id: userId, addressee_id: addresseeId, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (error) {
        throw error;
      }

      return;
    }

    throw new Error(existing.status === "accepted" ? "You are already friends." : "A friend request already exists.");
  }

  const { error } = await supabase.from("player_friends").insert({
    requester_id: userId,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (error) {
    throw error;
  }
}

export async function updateFriendRequest(friendshipId: string, status: FriendRow["status"]) {
  const { error } = await supabase
    .from("player_friends")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", friendshipId);

  if (error) {
    throw error;
  }
}

export async function removeFriend(friendshipId: string) {
  const { error } = await supabase.from("player_friends").delete().eq("id", friendshipId);

  if (error) {
    throw error;
  }
}

async function findExistingFriendship(userId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from("player_friends")
    .select("*")
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as FriendRow | null;
}

async function getLeaderboardProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("*")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as LeaderboardRow[];
}
