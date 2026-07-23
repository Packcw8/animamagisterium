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
import { getItemDefinitions, resolveInventoryThumbnailUri, type ItemDefinition } from "../services/inventoryService";
import { getLeaderboardWithRankForPeriod, getTrophyLeaderboardWithRankForPeriod, getWeeklyLeaderboardRewards, LeaderboardMetric, LeaderboardPeriod, LeaderboardRow, leaderboardMetrics, searchLeaderboardPlayers, settleWeeklyLeaderboardRewards, weeklyLeaderboardMetrics, weeklyRewardMetrics, type TrophyLeaderboardRow, type WeeklyLeaderboardReward } from "../services/leaderboardService";
import { FriendWithProfile, getCurrentUserId, getFriendRows, removeFriend, sendFriendRequest, updateFriendRequest } from "../services/socialService";

type SocialTab = "friends" | "partyGuild" | "leaderboard" | "profile";
type LeaderboardScope = "all" | "friends";
type SocialLeaderboardMetric = LeaderboardMetric | "trophies";

let hasAttemptedWeeklyRewardSettlement = false;
const rankOptions = [1, 2, 3] as const;

export function SocialScreen() {
  const [activeTab, setActiveTab] = useState<SocialTab>("leaderboard");
  const [activeMetric, setActiveMetric] = useState<SocialLeaderboardMetric>("total_distance_walked_meters");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
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
  const [weeklyRewards, setWeeklyRewards] = useState<WeeklyLeaderboardReward[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [showWeeklyPrizes, setShowWeeklyPrizes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const visibleLeaderboardMetrics = period === "weekly" ? weeklyLeaderboardMetrics : leaderboardMetrics;
  const activeLabel = useMemo(() => activeMetric === "trophies" ? "Trophy Animals" : visibleLeaderboardMetrics.find((metric) => metric.key === activeMetric)?.label ?? "Leaderboard", [activeMetric, visibleLeaderboardMetrics]);
  const acceptedFriendIds = useMemo(
    () => friends.filter((friend) => friend.status === "accepted").map((friend) => friend.friend_user_id),
    [friends],
  );
  const incomingRequests = friends.filter((friend) => friend.status === "pending" && friend.addressee_id === userId);
  const outgoingRequests = friends.filter((friend) => friend.status === "pending" && friend.requester_id === userId);
  const acceptedFriends = friends.filter((friend) => friend.status === "accepted");
  const topLeaderboardRows = rows.slice(0, 3);
  const remainingLeaderboardRows = rows.slice(3);
  const topTrophyRows = trophyRows.slice(0, 3);
  const remainingTrophyRows = trophyRows.slice(3);
  const selectedWeeklyRewardMetric = activeMetric === "trophies" ? "trophies" : activeMetric;
  const selectedWeeklyRewards = useMemo(
    () => rankOptions.map((rank) => weeklyRewards.find((reward) => reward.metric === selectedWeeklyRewardMetric && reward.rank === rank && reward.is_active) ?? null),
    [selectedWeeklyRewardMetric, weeklyRewards],
  );

  useEffect(() => {
    void loadSocial();
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [activeMetric, period, scope, acceptedFriendIds.join("|")]);

  useEffect(() => {
    if (activeMetric !== "trophies" && !visibleLeaderboardMetrics.some((metric) => metric.key === activeMetric)) {
      setActiveMetric("total_distance_walked_meters");
    }
  }, [activeMetric, visibleLeaderboardMetrics]);

  useEffect(() => {
    prefetchGameImages([
      ...rows.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...searchResults.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...trophyRows.map((row) => row.portrait_thumb_url ?? row.portrait_url),
      ...trophyRows.map((row) => row.enemy_image_thumb_url ?? row.enemy_image_url),
      ...selectedWeeklyRewards.map((reward) => resolveInventoryThumbnailUri(itemDefinitions.find((item) => item.id === reward?.reward_item_id))),
    ]);
  }, [rows, searchResults, trophyRows, selectedWeeklyRewards, itemDefinitions]);

  async function loadSocial() {
    setIsLoading(true);
    setMessage(null);
    try {
      const [nextUserId, nextFriends] = await Promise.all([getCurrentUserId(), getFriendRows()]);
      setUserId(nextUserId);
      setFriends(nextFriends);
      const [nextRewards, nextItems] = await Promise.all([getWeeklyLeaderboardRewards(), getItemDefinitions()]);
      setWeeklyRewards(nextRewards);
      setItemDefinitions(nextItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load social data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLeaderboard() {
    setMessage(null);
    try {
      if (period === "weekly" && !hasAttemptedWeeklyRewardSettlement) {
        hasAttemptedWeeklyRewardSettlement = true;
        try {
          await settleWeeklyLeaderboardRewards();
        } catch {
          // Older database builds may not have the settlement RPC yet. Leaderboards still load normally.
        }
      }
      const friendScopeIds = scope === "friends" ? [userId, ...acceptedFriendIds].filter(Boolean) as string[] : undefined;
      if (activeMetric === "trophies") {
        const data = await getTrophyLeaderboardWithRankForPeriod(friendScopeIds, period);
        setTrophyRows(data.rows);
        setCurrentTrophyRow(data.currentPlayerRow);
        setCurrentTrophyRank(data.currentPlayerRank);
        setRows([]);
        setCurrentPlayerRow(null);
        setCurrentPlayerRank(null);
        return;
      }

      const data = await getLeaderboardWithRankForPeriod(activeMetric, friendScopeIds, period);
      setRows(data.rows);
      setCurrentPlayerRow(data.currentPlayerRow);
      setCurrentPlayerRank(data.currentPlayerRank);
      setTrophyRows([]);
      setCurrentTrophyRow(null);
      setCurrentTrophyRank(null);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "Unable to load leaderboards right now.");
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
            <Text style={styles.copy}>{period === "weekly" ? "Climb this week’s board before rewards go out on Tuesday." : "A record of every mile, victory, and lesson earned across your journey."}</Text>
          </Frame>
          {period === "weekly" ? (
            <Frame style={styles.claimPanel}>
              <Pressable style={styles.prizeHeader} onPress={() => setShowWeeklyPrizes((value) => !value)}>
                <View style={styles.claimCopy}>
                  <Text style={styles.prizeEyebrow}>Weekly Prizes</Text>
                  <Text style={styles.prizeTitle}>Claim the Crown</Text>
                  <Text style={styles.copy}>Top 3 adventurers receive their prize by mail every Tuesday.</Text>
                </View>
                <View style={styles.prizeSeal}>
                  <Text style={styles.prizeSealText}>{showWeeklyPrizes ? "Hide" : "View"}</Text>
                </View>
              </Pressable>
              {showWeeklyPrizes ? (
                <View style={styles.prizePodium}>
                  <WeeklyPrizeCard
                    rank={2}
                    reward={selectedWeeklyRewards[1]}
                    item={itemDefinitions.find((item) => item.id === selectedWeeklyRewards[1]?.reward_item_id) ?? null}
                  />
                  <WeeklyPrizeCard
                    rank={1}
                    reward={selectedWeeklyRewards[0]}
                    item={itemDefinitions.find((item) => item.id === selectedWeeklyRewards[0]?.reward_item_id) ?? null}
                  />
                  <WeeklyPrizeCard
                    rank={3}
                    reward={selectedWeeklyRewards[2]}
                    item={itemDefinitions.find((item) => item.id === selectedWeeklyRewards[2]?.reward_item_id) ?? null}
                  />
                </View>
              ) : null}
            </Frame>
          ) : null}

          <View style={styles.periodTabs}>
            <Pressable style={[styles.periodButton, period === "weekly" && styles.periodActive]} onPress={() => setPeriod("weekly")}>
              <Text style={[styles.periodText, period === "weekly" && styles.periodTextActive]}>Weekly</Text>
            </Pressable>
            <Pressable style={[styles.periodButton, period === "all_time" && styles.periodActive]} onPress={() => setPeriod("all_time")}>
              <Text style={[styles.periodText, period === "all_time" && styles.periodTextActive]}>All-Time</Text>
            </Pressable>
          </View>

          <View style={styles.metricTabs}>
            {visibleLeaderboardMetrics.map((metric) => (
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

          {activeMetric === "trophies" && currentTrophyRow && currentTrophyRank ? (
            <CurrentRankPanel
              rank={currentTrophyRank}
              title={currentTrophyRow.enemy_name ?? currentTrophyRow.species ?? "Trophy Animal"}
              subtitle={formatTrophyMeasurements(currentTrophyRow)}
              value={Number(currentTrophyRow.trophy_score).toFixed(2)}
              label="Score"
            />
          ) : activeMetric !== "trophies" && currentPlayerRow && currentPlayerRank ? (
            <CurrentRankPanel
              rank={currentPlayerRank}
              title={currentPlayerRow.character_name}
              subtitle={`${currentPlayerRow.display_name} / Lv ${currentPlayerRow.level}`}
              value={formatMetricValue(currentPlayerRow, activeMetric)}
              label={getMetricLabel(activeMetric)}
            />
          ) : null}

          <Frame style={styles.board}>
            {isLoading ? <Text style={styles.copy}>Loading leaderboard...</Text> : null}
            {activeMetric === "trophies" ? (
              <>
                {!isLoading && trophyRows.length === 0 ? <Text style={styles.copy}>{period === "weekly" ? "No trophy animals have been recorded this week yet." : "No trophy animals have been recorded yet."}</Text> : null}
                {topTrophyRows.length > 0 ? (
                  <View style={styles.podiumWrap}>
                    {topTrophyRows.map((row, index) => (
                      <TrophyPodiumCard key={row.id} row={row} rank={index + 1} />
                    ))}
                  </View>
                ) : null}
                {remainingTrophyRows.map((row, index) => (
                  <TrophyLeaderboardCard key={row.id} row={row} rank={index + 4} />
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
                {!isLoading && rows.length === 0 ? <Text style={styles.copy}>{period === "weekly" ? "No weekly leaderboard entries yet." : "No leaderboard entries yet."}</Text> : null}
                {topLeaderboardRows.length > 0 ? (
                  <View style={styles.podiumWrap}>
                    {topLeaderboardRows.map((row, index) => (
                      <LeaderboardPodiumCard key={row.character_id} row={row} rank={index + 1} metric={activeMetric} onOpen={() => void openProfile(row)} />
                    ))}
                  </View>
                ) : null}
                {remainingLeaderboardRows.map((row, index) => (
                  <LeaderboardCard key={row.character_id} row={row} rank={index + 4} metric={activeMetric} onOpen={() => void openProfile(row)} />
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
        <Text style={styles.scoreLabel}>{getMetricLabel(metric)}</Text>
      </View>
    </Pressable>
  );
}

function LeaderboardPodiumCard({ row, rank, metric, onOpen }: { row: LeaderboardRow; rank: number; metric: LeaderboardMetric; onOpen: () => void }) {
  return (
    <Pressable style={[styles.podiumCard, getPodiumStyle(rank)]} onPress={onOpen}>
      <Text style={styles.podiumRank}>#{rank}</Text>
      <View style={styles.podiumPortraitWrap}>
        {row.portrait_thumb_url || row.portrait_url ? <CachedGameImage uri={row.portrait_thumb_url ?? row.portrait_url} style={styles.portrait} /> : <Text style={styles.initial}>{row.character_name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>{row.character_name}</Text>
      <Text style={styles.podiumScore} numberOfLines={1}>{formatMetricValue(row, metric)}</Text>
      <Text style={styles.podiumLabel} numberOfLines={1}>{getMetricLabel(metric)}</Text>
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

function TrophyPodiumCard({ row, rank }: { row: TrophyLeaderboardRow; rank: number }) {
  return (
    <View style={[styles.podiumCard, getPodiumStyle(rank)]}>
      <Text style={styles.podiumRank}>#{rank}</Text>
      <View style={styles.podiumTrophyWrap}>
        {row.enemy_image_thumb_url || row.enemy_image_url ? <CachedGameImage uri={row.enemy_image_thumb_url ?? row.enemy_image_url} style={styles.trophyImage} /> : <Text style={styles.initial}>{(row.enemy_name ?? "T").slice(0, 1).toUpperCase()}</Text>}
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>{row.enemy_name ?? row.species ?? "Trophy"}</Text>
      <Text style={styles.podiumScore} numberOfLines={1}>{Number(row.trophy_score).toFixed(2)}</Text>
      <Text style={styles.podiumLabel} numberOfLines={1}>Score</Text>
    </View>
  );
}

function CurrentRankPanel({ rank, title, subtitle, value, label }: { rank: number; title: string; subtitle: string; value: string; label: string }) {
  return (
    <Frame style={styles.currentRankPanel}>
      <View style={styles.currentRankBadge}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
      <View style={styles.currentRankText}>
        <Text style={styles.eyebrow}>Your Rank</Text>
        <Text style={styles.name} numberOfLines={1}>{title}</Text>
        <Text style={styles.copy} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{value}</Text>
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
    </Frame>
  );
}

function WeeklyPrizeCard({ rank, reward, item }: { rank: number; reward: WeeklyLeaderboardReward | null; item: ItemDefinition | null }) {
  const itemUri = resolveInventoryThumbnailUri(item);
  const hasPrize = Boolean(reward);
  const rewardParts = [
    reward && reward.reward_gold > 0 ? `${reward.reward_gold.toLocaleString()} gold` : null,
    reward && reward.reward_xp > 0 ? `${reward.reward_xp.toLocaleString()} XP` : null,
    item ? `${item.name} x${Math.max(1, reward?.reward_item_quantity ?? 1)}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.prizeCard, getPodiumStyle(rank), rank === 1 && styles.firstPrizeCard]}>
      <Text style={styles.prizeRank}>#{rank}</Text>
      <View style={styles.prizeImageWrap}>
        {itemUri ? <CachedGameImage uri={itemUri} style={styles.prizeImage} /> : <Text style={styles.prizeInitial}>{hasPrize ? "$" : "-"}</Text>}
      </View>
      <Text style={styles.prizeCardTitle} numberOfLines={1}>{reward?.title || "Prize Pending"}</Text>
      <View style={styles.prizeStats}>
        <Text style={styles.prizeStat}>{reward && reward.reward_gold > 0 ? `${reward.reward_gold.toLocaleString()}g` : "0g"}</Text>
        <Text style={styles.prizeStat}>{reward && reward.reward_xp > 0 ? `${reward.reward_xp.toLocaleString()} XP` : "0 XP"}</Text>
      </View>
      <Text style={styles.prizeItemName} numberOfLines={2}>{rewardParts.length > 0 ? rewardParts.join(" / ") : "No prize set"}</Text>
    </View>
  );
}

function formatMetricValue(row: LeaderboardRow, metric: LeaderboardMetric) {
  if (metric === "total_distance_walked_meters") {
    return formatDistance(row.total_distance_walked_meters);
  }

  return Number(row[metric] ?? 0).toLocaleString();
}

function getMetricLabel(metric: LeaderboardMetric) {
  return weeklyRewardMetrics.find((item) => item.key === metric)?.label
    ?? leaderboardMetrics.find((item) => item.key === metric)?.label
    ?? "Score";
}

function getPodiumStyle(rank: number) {
  if (rank === 1) {
    return styles.podiumFirst;
  }
  if (rank === 2) {
    return styles.podiumSecond;
  }
  return styles.podiumThird;
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
  claimPanel: {
    marginHorizontal: 12,
    gap: 12,
    padding: 12,
    backgroundColor: "rgba(29, 18, 7, 0.72)",
    borderColor: "rgba(239, 195, 95, 0.45)",
  },
  claimCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  prizeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
  },
  prizeEyebrow: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  prizeTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  prizeSeal: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 195, 95, 0.12)",
  },
  prizeSealText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
  },
  prizePodium: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingTop: 8,
  },
  prizeCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 164,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: "center",
    gap: 6,
  },
  firstPrizeCard: {
    minHeight: 184,
    paddingTop: 10,
  },
  prizeRank: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
  },
  prizeImageWrap: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 195, 95, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  prizeImage: {
    width: "100%",
    height: "100%",
  },
  prizeInitial: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 18,
  },
  prizeCardTitle: {
    width: "100%",
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
  },
  prizeStats: {
    width: "100%",
    gap: 3,
  },
  prizeStat: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 11,
    textAlign: "center",
  },
  prizeItemName: {
    width: "100%",
    minHeight: 28,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  currentRankPanel: {
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(20, 61, 86, 0.24)",
  },
  currentRankBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  currentRankText: {
    flex: 1,
    minWidth: 0,
  },
  periodTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  periodButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  periodActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 170, 93, 0.14)",
  },
  periodText: {
    color: colors.text,
    fontWeight: "900",
  },
  periodTextActive: {
    color: colors.gold,
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
  podiumWrap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  podiumCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  podiumFirst: {
    borderColor: "rgba(239, 195, 95, 0.95)",
    backgroundColor: "rgba(239, 195, 95, 0.13)",
  },
  podiumSecond: {
    borderColor: "rgba(201, 207, 215, 0.72)",
    backgroundColor: "rgba(201, 207, 215, 0.09)",
  },
  podiumThird: {
    borderColor: "rgba(190, 124, 65, 0.74)",
    backgroundColor: "rgba(190, 124, 65, 0.1)",
  },
  podiumRank: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
  },
  podiumPortraitWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061118",
  },
  podiumTrophyWrap: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061118",
  },
  podiumName: {
    width: "100%",
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
  },
  podiumScore: {
    width: "100%",
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },
  podiumLabel: {
    width: "100%",
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
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
