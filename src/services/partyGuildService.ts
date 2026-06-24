import { supabase, Tables } from "../lib/supabase";
import type { LeaderboardRow } from "./leaderboardService";
import { getCurrentUserId } from "./socialService";

export type Party = Tables["parties"];
export type PartyMember = Tables["party_members"];
export type Guild = Tables["guilds"];
export type GuildMember = Tables["guild_members"];
export type SocialGroupGoal = Tables["social_group_goals"];
export type SocialGroupGoalContribution = Tables["social_group_goal_contributions"];

export type SocialMemberProfile = {
  user_id: string;
  display_name: string;
  character_name: string;
  portrait_url: string | null;
  level: number;
};

export type PartyMemberWithProfile = PartyMember & {
  profile?: SocialMemberProfile | null;
};

export type GuildMemberWithProfile = GuildMember & {
  profile?: SocialMemberProfile | null;
};

export type SocialGoalWithProgress = SocialGroupGoal & {
  total_contribution: number;
  user_contribution: number;
  contributors: Array<{
    user_id: string;
    amount: number;
    profile?: SocialMemberProfile | null;
  }>;
};

export type PartyGuildState = {
  userId: string | null;
  party: Party | null;
  partyMembers: PartyMemberWithProfile[];
  partyInvites: Array<{ party: Party | null; member: PartyMember }>;
  partyGoals: SocialGoalWithProgress[];
  guild: Guild | null;
  guildMembers: GuildMemberWithProfile[];
  guildInvites: Array<{ guild: Guild | null; member: GuildMember }>;
  guildGoals: SocialGoalWithProgress[];
};

export async function getPartyGuildState(): Promise<PartyGuildState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return emptyState(null);
  }

  const [partyMemberships, guildMemberships] = await Promise.all([
    getPartyMemberships(userId),
    getGuildMemberships(userId),
  ]);

  const activePartyMembership = partyMemberships.find((row) => row.status === "active") ?? null;
  const activeGuildMembership = guildMemberships.find((row) => row.status === "active") ?? null;
  const pendingPartyMemberships = partyMemberships.filter((row) => row.status === "pending");
  const pendingGuildMemberships = guildMemberships.filter((row) => row.status === "pending");

  const partyIds = Array.from(new Set([
    activePartyMembership?.party_id,
    ...pendingPartyMemberships.map((row) => row.party_id),
  ].filter(Boolean) as string[]));
  const guildIds = Array.from(new Set([
    activeGuildMembership?.guild_id,
    ...pendingGuildMemberships.map((row) => row.guild_id),
  ].filter(Boolean) as string[]));

  const [parties, guilds] = await Promise.all([
    getPartiesByIds(partyIds),
    getGuildsByIds(guildIds),
  ]);

  const party = activePartyMembership ? parties.find((row) => row.id === activePartyMembership.party_id) ?? null : null;
  const guild = activeGuildMembership ? guilds.find((row) => row.id === activeGuildMembership.guild_id) ?? null : null;

  const [partyMembers, guildMembers] = await Promise.all([
    party ? getPartyMembersWithProfiles(party.id) : Promise.resolve([]),
    guild ? getGuildMembersWithProfiles(guild.id) : Promise.resolve([]),
  ]);

  const [partyGoals, guildGoals] = await Promise.all([
    party ? getGoalsWithProgress("party", party.id, userId) : Promise.resolve([]),
    guild ? getGoalsWithProgress("guild", guild.id, userId) : Promise.resolve([]),
  ]);

  return {
    userId,
    party,
    partyMembers,
    partyInvites: pendingPartyMemberships.map((member) => ({
      member,
      party: parties.find((row) => row.id === member.party_id) ?? null,
    })),
    partyGoals,
    guild,
    guildMembers,
    guildInvites: pendingGuildMemberships.map((member) => ({
      member,
      guild: guilds.find((row) => row.id === member.guild_id) ?? null,
    })),
    guildGoals,
  };
}

export async function createParty(name: string, description: string | null) {
  const userId = await requireUserId();
  const { data: existingMember, error: existingError } = await supabase
    .from("party_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingMember) {
    throw new Error("Leave your current party before creating another.");
  }

  const { data: party, error } = await supabase
    .from("parties")
    .insert({ name: name.trim(), description: description?.trim() || null, leader_id: userId })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const { error: memberError } = await supabase.from("party_members").insert({
    party_id: party.id,
    user_id: userId,
    role: "leader",
    status: "active",
    invited_by: userId,
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    throw memberError;
  }

  return party as Party;
}

export async function createGuild(name: string, description: string | null) {
  const userId = await requireUserId();
  const { data: existingMember, error: existingError } = await supabase
    .from("guild_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingMember) {
    throw new Error("Leave your current guild before creating another.");
  }

  const { data: guild, error } = await supabase
    .from("guilds")
    .insert({ name: name.trim(), description: description?.trim() || null, leader_id: userId })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const { error: memberError } = await supabase.from("guild_members").insert({
    guild_id: guild.id,
    user_id: userId,
    role: "leader",
    status: "active",
    invited_by: userId,
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    throw memberError;
  }

  return guild as Guild;
}

export async function invitePartyMember(partyId: string, friendUserId: string) {
  const userId = await requireUserId();
  const { error } = await supabase.from("party_members").upsert({
    party_id: partyId,
    user_id: friendUserId,
    role: "member",
    status: "pending",
    invited_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "party_id,user_id" });

  if (error) {
    throw error;
  }
}

export async function inviteGuildMember(guildId: string, friendUserId: string) {
  const userId = await requireUserId();
  const { error } = await supabase.from("guild_members").upsert({
    guild_id: guildId,
    user_id: friendUserId,
    role: "member",
    status: "pending",
    invited_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "guild_id,user_id" });

  if (error) {
    throw error;
  }
}

export async function respondToPartyInvite(memberId: string, accepted: boolean) {
  const { error } = await supabase
    .from("party_members")
    .update({
      status: accepted ? "active" : "declined",
      joined_at: accepted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

export async function respondToGuildInvite(memberId: string, accepted: boolean) {
  const { error } = await supabase
    .from("guild_members")
    .update({
      status: accepted ? "active" : "declined",
      joined_at: accepted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

export async function leaveParty(memberId: string) {
  const { error } = await supabase
    .from("party_members")
    .update({ status: "left", updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

export async function leaveGuild(memberId: string) {
  const { error } = await supabase
    .from("guild_members")
    .update({ status: "left", updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

function emptyState(userId: string | null): PartyGuildState {
  return {
    userId,
    party: null,
    partyMembers: [],
    partyInvites: [],
    partyGoals: [],
    guild: null,
    guildMembers: [],
    guildInvites: [],
    guildGoals: [],
  };
}

async function requireUserId() {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("You must be signed in.");
  }

  return userId;
}

async function getPartyMemberships(userId: string) {
  const { data, error } = await supabase
    .from("party_members")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "active"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PartyMember[];
}

async function getGuildMemberships(userId: string) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "active"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as GuildMember[];
}

async function getPartiesByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("parties").select("*").in("id", ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as Party[];
}

async function getGuildsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("guilds").select("*").in("id", ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as Guild[];
}

async function getPartyMembersWithProfiles(partyId: string) {
  const { data, error } = await supabase
    .from("party_members")
    .select("*")
    .eq("party_id", partyId)
    .eq("status", "active")
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PartyMember[];
  const profiles = await getMemberProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => ({
    ...row,
    profile: profiles.find((profile) => profile.user_id === row.user_id) ?? null,
  })) satisfies PartyMemberWithProfile[];
}

async function getGuildMembersWithProfiles(guildId: string) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("status", "active")
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as GuildMember[];
  const profiles = await getMemberProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => ({
    ...row,
    profile: profiles.find((profile) => profile.user_id === row.user_id) ?? null,
  })) satisfies GuildMemberWithProfile[];
}

async function getGoalsWithProgress(groupType: "party" | "guild", groupId: string, userId: string) {
  const { data: goals, error } = await supabase
    .from("social_group_goals")
    .select("*")
    .eq("group_type", groupType)
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const goalRows = (goals ?? []) as SocialGroupGoal[];

  if (goalRows.length === 0) {
    return [];
  }

  const { data: contributions, error: contributionError } = await supabase
    .from("social_group_goal_contributions")
    .select("*")
    .in("goal_id", goalRows.map((goal) => goal.id));

  if (contributionError) {
    throw contributionError;
  }

  const contributionRows = (contributions ?? []) as SocialGroupGoalContribution[];
  const profiles = await getMemberProfiles(Array.from(new Set(contributionRows.map((row) => row.user_id))));

  return goalRows.map((goal) => {
    const rows = contributionRows.filter((row) => row.goal_id === goal.id);
    const byUser = new Map<string, number>();
    rows.forEach((row) => byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + Number(row.amount)));

    return {
      ...goal,
      total_contribution: rows.reduce((sum, row) => sum + Number(row.amount), 0),
      user_contribution: rows.filter((row) => row.user_id === userId).reduce((sum, row) => sum + Number(row.amount), 0),
      contributors: Array.from(byUser.entries()).map(([contributorId, amount]) => ({
        user_id: contributorId,
        amount,
        profile: profiles.find((profile) => profile.user_id === contributorId) ?? null,
      })).sort((a, b) => b.amount - a.amount),
    } satisfies SocialGoalWithProgress;
  });
}

async function getMemberProfiles(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));

  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_leaderboards")
    .select("user_id,display_name,character_name,portrait_url,level")
    .in("user_id", uniqueIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as LeaderboardRow[]).map((row) => ({
    user_id: row.user_id,
    display_name: row.display_name,
    character_name: row.character_name,
    portrait_url: row.portrait_url,
    level: row.level,
  })) satisfies SocialMemberProfile[];
}
