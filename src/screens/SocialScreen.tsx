import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { PlayerProfileCard } from "../components/PlayerProfileCard";
import { Screen } from "../components/Screen";
import { PartyGuildPanel } from "../components/social/PartyGuildPanel";
import { colors, fonts } from "../components/theme";
import { CachedGameImage, prefetchGameImages } from "../components/ui/CachedGameImage";
import { getEarnedBadgesForCharacter, EarnedBadgeSummary } from "../services/badgeService";
import { getLeaderboardWithRank, getTrophyLeaderboardWithRank, LeaderboardMetric, LeaderboardRow, leaderboardMetrics, searchLeaderboardPlayers, type TrophyLeaderboardRow } from "../services/leaderboardService";
import { FriendWithProfile, getCurrentUserId, getFriendRows, removeFriend, sendFriendRequest, updateFriendRequest } from "../services/socialService";

type SocialTab = "friends" | "partyGuild" | "leaderboard" | "profile";
type LeaderboardScope = "all" | "friends";
type SocialLeaderboardMetric = LeaderboardMetric | "trophies";

export function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>("leaderboard");
  const [activeMetric, setActiveMetric] = useState<SocialLeaderboardMetric>("total_distance_walked_meters");
  const [scope, setScope] = useState<LeaderboardScope>("all");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [currentPlayerRow, setCurrentPlayerRow] = useState<LeaderboardRow | null>(null);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<number | null>(null);
  const [trophyRows, setTrophyRows] = useState<TrophyLeaderboardRow[]>([]);
  const [currentTrophyRow, setCurrentTrophyRow] = useState<TrophyLeaderboardRow | null>(null);
  const [currentTrophyRank, setCurrentTrophyRank] = useState<number | null>(null);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<LeaderboardRow[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<LeaderboardRow | null>(null);
  const [selectedBadges, setSelectedBadges] = useState<EarnedBadgeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const activeLabel = useMemo(() => activeMetric === "trophies" ? "Trophy Animals" : leaderboardMetrics.find((metric) => metric.key === activeMetric)?.label ?? "Leaderboard", [activeMetric]);
  const acceptedFriendIds = useMemo(
    () => friends.filter((friend) => friend.status === "accepted").map((friend) => friend.friend_user_id),
    [friends],
  );
  const incomingRequests = friends.filter((friend) => friend.status === "pending" && friend.addressee_id === userId);
  const outgoingRequests = friends.filter((friend) => friend.status === "pending" && friend.requester_id === userId);
  const acceptedFriends = friends.filter((friend) => friend.status === "accepted");

  useEffect(() => {
    void loadSocial();
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [activeMetric, scope, acceptedFriendIds.join("|")]);

  useEffect(() => {
    prefetchGameImages([
      ...rows.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...searchResults.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...trophyRows.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...trophyRows.map((row) => row.enemy_image_thumb_url ?? row.enemy_image_url),
    ]);
  }, [rows, searchResults, trophyRows]);

  async function loadSocial() {
    setIsLoading(true);
    setMessage(null);
    try {
      const [nextUserId, nextFriends] = await Promise.all([getCurrentUserId(), getFriendRows()]);
      setUserId(nextUserId);
      setFriends(nextFriends);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load social data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLeaderboard() {
    setMessage(null);
    try {
      const friendScopeIds = scope === "friends" ? [userId, ...acceptedFriendIds].filter(Boolean) as string[] : undefined;
      if (activeMetric === "trophies") {
        const data = await getTrophyLeaderboardWithRank(friendScopeIds);
        setTrophyRows(data.rows);
        setCurrentTrophyRow(data.currentPlayerRow);
        setCurrentTrophyRank(data.currentPlayerRank);
        setRows([]);
        setCurrentPlayerRow(null);
        setCurrentPlayerRank(null);
        return;
      }

      const data = await getLeaderboardWithRank(activeMetric, friendScopeIds);
      setRows(data.rows);
      setCurrentPlayerRow(data.currentPlayerRow);
      setCurrentPlayerRank(data.currentPlayerRank);
      setTrophyRows([]);
      setCurrentTrophyRow(null);
      setCurrentTrophyRank(null);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "Unable to load leaderboards. Confirm the Supabase leaderboard migration has run.");
    }
  }

  async function runSearch() {
    setMessage(null);
    try {
      const results = await searchLeaderboardPlayers(searchTerm);
      setSearchResults(results.filter((row) => row.user_id !== userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search players.");
    }
  }

  async function addFriend(row: LeaderboardRow) {
    try {
      await sendFriendRequest(row.user_id);
      setMessage(`Friend request sent to ${row.character_name}.`);
      setSearchResults((current) => current.filter((item) => item.user_id !== row.user_id));
      await loadSocial();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send friend request.");
    }
  }

  async function setFriendStatus(friendshipId: string, status: "accepted" | "declined") {
    try {
      await updateFriendRequest(friendshipId, status);
      setMessage(status === "accepted" ? "Friend request accepted." : "Friend request declined.");
      await loadSocial();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update friend request.");
    }
  }

  async function unfriend(friendshipId: string) {
    try {
      await removeFriend(friendshipId);
      setMessage("Friend removed.");
      await loadSocial();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove friend.");
    }
  }

  async function openProfile(profile: LeaderboardRow) {
    setSelectedProfile(profile);
    setActiveTab("profile");
    setSelectedBadges([]);
    try {
      setSelectedBadges(await getEarnedBadgesForCharacter(profile.character_id));
    } catch {
      setSelectedBadges([]);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Text style={styles.subtitle}>Social / Friends / Parties / Guilds</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["friends", "partyGuild", "leaderboard", "profile"] as const).map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === "friends" ? "Friends" : tab === "partyGuild" ? "Parties" : tab === "leaderboard" ? "Leaderboards" : "Profile"}</Text>
          </Pressable>
        ))}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {activeTab === "friends" ? (
        <View style={styles.stack}>
          <Frame style={styles.panel}>
            <Text style={styles.sectionTitle}>Add Friends</Text>
            <Text style={styles.copy}>Search by character name or player display name.</Text>
            <View style={styles.searchRow}>
              <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search players" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable style={styles.smallButton} onPress={() => void runSearch()}>
                <Text style={styles.buttonText}>Search</Text>
              </Pressable>
            </View>
            {searchResults.map((row) => (
              <PlayerRow key={row.character_id} row={row} actionLabel="Add Friend" onPress={() => void addFriend(row)} onOpen={() => void openProfile(row)} />
            ))}
          </Frame>

          <FriendSection title="Incoming Requests" rows={incomingRequests} empty="No incoming requests.">
            {(friend) => (
              <View style={styles.friendActions}>
                <Pressable style={styles.smallButton} onPress={() => void setFriendStatus(friend.id, "accepted")}><Text style={styles.buttonText}>Accept</Text></Pressable>
                <Pressable style={styles.dangerButton} onPress={() => void setFriendStatus(friend.id, "declined")}><Text style={styles.dangerText}>Decline</Text></Pressable>
              </View>
            )}
          </FriendSection>

          <FriendSection title="Friends" rows={acceptedFriends} empty="No friends yet. Add someone above.">
            {(friend) => (
              <View style={styles.friendActions}>
                <Pressable style={styles.smallButton} onPress={() => friend.friend ? void openProfile(friend.friend) : undefined}><Text style={styles.buttonText}>Profile</Text></Pressable>
                <Pressable style={styles.dangerButton} onPress={() => void unfriend(friend.id)}><Text style={styles.dangerText}>Remove</Text></Pressable>
              </View>
            )}
          </FriendSection>

          <FriendSection title="Sent Requests" rows={outgoingRequests} empty="No sent requests.">
            {(friend) => <Text style={styles.copy}>Waiting for response.</Text>}
          </FriendSection>
        </View>
      ) : activeTab === "partyGuild" ? (
        <PartyGuildPanel friends={friends} onMessage={setMessage} />
      ) : activeTab === "leaderboard" ? (
        <View style={styles.stack}>
          <Frame style={styles.heroCard}>
            <Text style={styles.eyebrow}>{scope === "friends" ? "Friends" : "All Players"}</Text>
            <Text style={styles.title}>{activeLabel} Leaderboard</Text>
            <Text style={styles.copy}>Showing top 100, plus your current rank when you are outside the top 100.</Text>
          </Frame>

          <View style={styles.metricTabs}>
            {leaderboardMetrics.map((metric) => (
              <Pressable key={metric.key} style={[styles.metricTab, activeMetric === metric.key && styles.metricTabActive]} onPress={() => setActiveMetric(metric.key)}>
                <Text style={[styles.metricTabText, activeMetric === metric.key && styles.metricTabTextActive]}>{metric.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.metricTab, activeMetric === "trophies" && styles.metricTabActive]} onPress={() => setActiveMetric("trophies")}>
              <Text style={[styles.metricTabText, activeMetric === "trophies" && styles.metricTabTextActive]}>Trophies</Text>
            </Pressable>
          </View>

          <View style={styles.scopeTabs}>
            <Pressable style={[styles.scopeButton, scope === "all" && styles.scopeActive]} onPress={() => setScope("all")}><Text style={styles.buttonText}>All Players</Text></Pressable>
            <Pressable style={[styles.scopeButton, scope === "friends" && styles.scopeActive]} onPress={() => setScope("friends")}><Text style={styles.buttonText}>Friends Only</Text></Pressable>
          </View>

          <Frame style={styles.board}>
            {isLoading ? <Text style={styles.copy}>Loading leaderboard...</Text> : null}
            {activeMetric === "trophies" ? (
              <>
                {!isLoading && trophyRows.length === 0 ? <Text style={styles.copy}>No trophy animals have been recorded yet.</Text> : null}
                {trophyRows.map((row, index) => (
                  <TrophyLeaderboardCard key={row.id} row={row} rank={index + 1} />
                ))}
                {currentTrophyRow && currentTrophyRank && currentTrophyRank > 100 && !trophyRows.some((row) => row.id === currentTrophyRow.id) ? (
                  <>
                    <Text style={styles.rankDivider}>Your Best Trophy</Text>
                    <TrophyLeaderboardCard row={currentTrophyRow} rank={currentTrophyRank} />
                  </>
                ) : null}
              </>
            ) : (
              <>
                {!isLoading && rows.length === 0 ? <Text style={styles.copy}>No leaderboard entries yet.</Text> : null}
                {rows.map((row, index) => (
                  <LeaderboardCard key={row.character_id} row={row} rank={index + 1} metric={activeMetric} onOpen={() => void openProfile(row)} />
                ))}
                {currentPlayerRow && currentPlayerRank && currentPlayerRank > 100 && !rows.some((row) => row.character_id === currentPlayerRow.character_id) ? (
                  <>
                    <Text style={styles.rankDivider}>Your Rank</Text>
                    <LeaderboardCard row={currentPlayerRow} rank={currentPlayerRank} metric={activeMetric} onOpen={() => void openProfile(currentPlayerRow)} />
                  </>
                ) : null}
              </>
            )}
          </Frame>
        </View>
      ) : selectedProfile ? (
        <View style={styles.profileWrap}>
          <PlayerProfileCard profile={selectedProfile} badges={selectedBadges} />
        </View>
      ) : (
        <Frame style={styles.panel}>
          <Text style={styles.sectionTitle}>No Profile Selected</Text>
          <Text style={styles.copy}>Tap a player on the leaderboard or friends list to view their profile.</Text>
        </Frame>
      )}
    </Screen>
  );
}

function FriendSection({ title, rows, empty, children }: { title: string; rows: FriendWithProfile[]; empty: string; children: (friend: FriendWithProfile) => React.ReactNode }) {
  return (
    <Frame style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.copy}>{empty}</Text> : null}
      {rows.map((friend) => (
        <View key={friend.id} style={styles.friendCard}>
          {friend.friend ? <MiniProfile row={friend.friend} /> : <Text style={styles.copy}>Player profile unavailable.</Text>}
          {children(friend)}
        </View>
      ))}
    </Frame>
  );
}

function PlayerRow({ row, actionLabel, onPress, onOpen }: { row: LeaderboardRow; actionLabel: string; onPress: () => void; onOpen: () => void }) {
  return (
    <View style={styles.friendCard}>
      <MiniProfile row={row} onPress={onOpen} />
      <Pressable style={styles.smallButton} onPress={onPress}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function MiniProfile({ row, onPress }: { row: LeaderboardRow; onPress?: () => void }) {
  return (
    <Pressable style={styles.miniProfile} onPress={onPress}>
      <View style={styles.portraitWrap}>
        {row.portrait_thumb_url || row.portrait_url ? <CachedGameImage uri={row.portrait_thumb_url ?? row.portrait_url} style={styles.portrait} /> : <Text style={styles.initial}>{row.character_name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.name}>{row.character_name}</Text>
        <Text style={styles.copy}>{row.display_name} / Lv {row.level}</Text>
      </View>
    </Pressable>
  );
}

function LeaderboardCard({ row, rank, metric, onOpen }: { row: LeaderboardRow; rank: number; metric: LeaderboardMetric; onOpen: () => void }) {
  return (
    <Pressable style={[styles.rankCard, rank <= 3 && styles.topRankCard]} onPress={onOpen}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View style={styles.portraitWrap}>
        {row.portrait_thumb_url || row.portrait_url ? <CachedGameImage uri={row.portrait_thumb_url ?? row.portrait_url} style={styles.portrait} /> : <Text style={styles.initial}>{row.character_name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.name}>{row.character_name}</Text>
        <Text style={styles.copy}>{row.display_name}</Text>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{formatMetricValue(row, metric)}</Text>
        <Text style={styles.scoreLabel}>{leaderboardMetrics.find((item) => item.key === metric)?.label}</Text>
      </View>
    </Pressable>
  );
}

function TrophyLeaderboardCard({ row, rank }: { row: TrophyLeaderboardRow; rank: number }) {
  return (
    <View style={[styles.rankCard, rank <= 3 && styles.topRankCard]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View style={styles.trophyImageWrap}>
        {row.enemy_image_thumb_url || row.enemy_image_url ? <CachedGameImage uri={row.enemy_image_thumb_url ?? row.enemy_image_url} style={styles.trophyImage} /> : <Text style={styles.initial}>{(row.enemy_name ?? "T").slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.name}>{row.enemy_name ?? row.species ?? "Trophy Animal"}</Text>
        <Text style={styles.copy}>{row.character_name} / {row.display_name}</Text>
        <Text style={styles.copy}>{formatTrophyMeasurements(row)}</Text>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{Number(row.trophy_score).toFixed(2)}</Text>
        <Text style={styles.scoreLabel}>Score</Text>
      </View>
    </View>
  );
}

function formatMetricValue(row: LeaderboardRow, metric: LeaderboardMetric) {
  if (metric === "total_distance_walked_meters") {
    return formatDistance(row.total_distance_walked_meters);
  }

  return Number(row[metric] ?? 0).toLocaleString();
}

function formatTrophyMeasurements(row: TrophyLeaderboardRow) {
  const parts = [
    row.species,
    Number(row.weight) > 0 ? `${Number(row.weight).toFixed(1)} lb` : null,
    Number(row.antler_spread) > 0 ? `${Number(row.antler_spread).toFixed(1)} in spread` : null,
    Number(row.horn_length) > 0 ? `${Number(row.horn_length).toFixed(1)} in horn` : null,
    Number(row.skull_size) > 0 ? `${Number(row.skull_size).toFixed(1)} in skull` : null,
    Number(row.pelt_quality) > 0 ? `${row.pelt_quality}% pelt` : null,
  ].filter(Boolean);

  return parts.join(" / ");
}

function formatDistance(meters: number) {
  if (meters < 160.9344) {
    return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
  }

  return `${(meters / 1609.344).toFixed(2)} mi`;
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
  headerText: {
    flex: 1,
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
  tabs: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  tabActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  tabText: {
    color: colors.text,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#dff6ff",
  },
  stack: {
    gap: 12,
  },
  panel: {
    marginHorizontal: 12,
    padding: 14,
    gap: 10,
  },
  heroCard: {
    marginHorizontal: 12,
    padding: 16,
    gap: 8,
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
  message: {
    color: colors.gold,
    marginHorizontal: 12,
    marginBottom: 8,
    fontWeight: "800",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
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
  smallButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 61, 86, 0.58)",
  },
  dangerButton: {
    minHeight: 40,
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
  friendCard: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  friendActions: {
    flexDirection: "row",
    gap: 8,
  },
  miniProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
  },
  metricTab: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  metricTabActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  metricTabText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  metricTabTextActive: {
    color: "#dff6ff",
  },
  scopeTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  scopeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 170, 93, 0.12)",
  },
  board: {
    margin: 12,
    padding: 12,
    gap: 10,
  },
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(174, 126, 55, 0.24)",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  topRankCard: {
    borderColor: "rgba(217, 170, 93, 0.64)",
    backgroundColor: "rgba(217, 170, 93, 0.08)",
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  rankText: {
    color: colors.gold,
    fontWeight: "900",
  },
  portraitWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
  trophyImageWrap: {
    width: 64,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061118",
  },
  trophyImage: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  scoreBox: {
    minWidth: 78,
    alignItems: "flex-end",
  },
  score: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  rankDivider: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
    marginTop: 8,
  },
  profileWrap: {
    margin: 12,
  },
});
