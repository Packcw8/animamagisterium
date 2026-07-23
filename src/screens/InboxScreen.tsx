import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import { acceptFriendRequest, claimInboxReward, declineFriendRequest, getInboxState, InboxItem, markInboxRewardsSeen } from "../services/inboxService";

type InboxScreenProps = {
  character: CharacterWithDetails;
  onBack: () => void;
  onCharacterUpdated: (character: CharacterWithDetails) => void;
};

export function InboxScreen({ character, onBack, onCharacterUpdated }: InboxScreenProps) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadInbox(true);
  }, [character.id]);

  async function loadInbox(markSeen = false) {
    try {
      setIsLoading(true);
      const state = await getInboxState();
      setItems(state.items);
      setUnreadCount(state.unreadCount);

      if (markSeen) {
        const unseenRewards = state.items
          .filter((item) => item.type === "reward" && item.isUnread && item.reward)
          .map((item) => item.reward?.id)
          .filter(Boolean) as string[];
        await markInboxRewardsSeen(unseenRewards);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load inbox.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept(item: InboxItem) {
    if (!item.friendRequestId) {
      return;
    }

    try {
      await acceptFriendRequest(item.friendRequestId);
      setMessage("Friend request accepted.");
      await loadInbox();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to accept friend request.");
    }
  }

  async function handleDecline(item: InboxItem) {
    if (!item.friendRequestId) {
      return;
    }

    try {
      await declineFriendRequest(item.friendRequestId);
      setMessage("Friend request declined.");
      await loadInbox();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to decline friend request.");
    }
  }

  async function handleClaim(item: InboxItem) {
    if (!item.reward) {
      return;
    }

    try {
      const updatedCharacter = await claimInboxReward(item.reward.id);
      if (updatedCharacter) {
        onCharacterUpdated(updatedCharacter);
      }
      setMessage("Reward claimed.");
      await loadInbox();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to claim reward.");
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={52} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Inbox</Text>
          <Text style={styles.subtitle}>{unreadCount} unopened message{unreadCount === 1 ? "" : "s"}</Text>
        </View>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {isLoading ? <Text style={styles.muted}>Opening sealed letters...</Text> : null}
        {!isLoading && items.length === 0 ? (
          <Frame style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.muted}>Friend requests and reward messages will appear here.</Text>
          </Frame>
        ) : null}

        {items.map((item) => (
          <Frame key={item.id} style={styles.inboxCard}>
            <View style={styles.cardTop}>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{item.type === "friend_request" ? "Friend" : "Reward"}</Text>
              </View>
              {item.isUnread ? <Text style={styles.unreadPill}>New</Text> : null}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            {item.type === "friend_request" ? (
              <View style={styles.actions}>
                <Pressable style={styles.primaryButton} onPress={() => handleAccept(item)}>
                  <Text style={styles.primaryButtonText}>Accept</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => handleDecline(item)}>
                  <Text style={styles.secondaryButtonText}>Decline</Text>
                </Pressable>
              </View>
            ) : item.reward?.is_claimed ? (
              <View style={styles.deliveredPill}>
                <Text style={styles.deliveredText}>Delivered</Text>
              </View>
            ) : (
              <Pressable style={styles.primaryButton} onPress={() => handleClaim(item)}>
                <Text style={styles.primaryButtonText}>Claim Reward</Text>
              </Pressable>
            )}
          </Frame>
        ))}
      </ScrollView>
    </Screen>
  );
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
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.blue,
    fontWeight: "800",
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 120,
  },
  message: {
    color: colors.blue,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  inboxCard: {
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(218,164,65,0.08)",
  },
  typePillText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 12,
  },
  unreadPill: {
    color: colors.blue,
    fontWeight: "900",
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  cardBody: {
    color: colors.muted,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    color: "#070604",
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  deliveredPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(53,211,124,0.08)",
  },
  deliveredText: {
    color: "#35d37c",
    fontWeight: "900",
  },
});
