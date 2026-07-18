import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import type { EquippedPartyCompanion, PartyCompanionOption } from "../../services/partyCompanionService";

type CharacterCompanionSheetProps = {
  options: PartyCompanionOption[];
  equipped: EquippedPartyCompanion | null;
  message: string | null;
  onClose: () => void;
  onRefreshOwnSnapshot: () => void;
  onEquip: (userId: string) => void;
  onUnequip: () => void;
};

export function CharacterCompanionSheet({
  options,
  equipped,
  message,
  onClose,
  onRefreshOwnSnapshot,
  onEquip,
  onUnequip,
}: CharacterCompanionSheetProps) {
  const activeSnapshot = equipped?.snapshot ?? null;

  return (
    <Screen>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Party</Text>
            <Text style={styles.title}>Companion</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.activePanel}>
          <Text style={styles.panelLabel}>Active Companion</Text>
          <View style={styles.activeRow}>
            <Portrait uri={activeSnapshot?.portrait_url ?? null} name={activeSnapshot?.character_name ?? "None"} size={64} />
            <View style={styles.flex}>
              <Text style={styles.activeTitle}>{activeSnapshot?.character_name ?? "No Companion Equipped"}</Text>
              <Text style={styles.copy}>
                {activeSnapshot
                  ? `Lv ${activeSnapshot.level} ${activeSnapshot.active_class_key ?? "Party Ally"} joins eligible battles.`
                  : "Equip one active party member to travel with you as a battle companion."}
              </Text>
            </View>
          </View>
          {activeSnapshot ? (
            <Pressable style={styles.secondaryButton} onPress={onUnequip}>
              <Text style={styles.secondaryText}>Unequip Companion</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable style={styles.primaryButton} onPress={onRefreshOwnSnapshot}>
          <Text style={styles.primaryText}>Refresh My Party Snapshot</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {options.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Party Members</Text>
              <Text style={styles.copy}>Join or create a party from Social to equip a companion.</Text>
            </View>
          ) : null}
          {options.map((option) => {
            const profile = option.member.profile;
            const snapshot = option.snapshot;
            const name = snapshot?.character_name ?? profile?.character_name ?? "Unknown Player";
            return (
              <View key={option.member.id} style={[styles.card, option.isEquipped && styles.cardActive]}>
                <Portrait uri={snapshot?.portrait_url ?? profile?.portrait_url ?? null} name={name} size={58} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{name}</Text>
                  <Text style={styles.cardMeta}>
                    {snapshot ? `Lv ${snapshot.level} / ${snapshot.active_class_key ?? "Party Ally"}` : option.unavailableReason}
                  </Text>
                  {snapshot ? (
                    <Text style={styles.copy} numberOfLines={2}>
                      HP {snapshot.max_health} / STA {snapshot.max_stamina} / Mana {snapshot.max_magika}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.equipButton, (!snapshot || option.isEquipped) && styles.disabledButton]}
                  onPress={() => onEquip(option.member.user_id)}
                  disabled={!snapshot || option.isEquipped}
                >
                  <Text style={styles.equipText}>{option.isEquipped ? "Equipped" : "Equip"}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}

function Portrait({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  return (
    <View style={[styles.portraitWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri }} style={styles.portrait} resizeMode="cover" fadeDuration={0} /> : <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: 14,
    padding: 14,
    paddingBottom: 96,
  },
  header: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  closeButton: {
    minHeight: 42,
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  closeText: {
    color: colors.blue,
    fontWeight: "900",
  },
  activePanel: {
    borderWidth: 1,
    borderColor: "rgba(217, 170, 93, 0.35)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(0, 8, 10, 0.72)",
  },
  panelLabel: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  message: {
    color: colors.gold,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#050505",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  list: {
    gap: 12,
    paddingBottom: 32,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  card: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  cardActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 170, 93, 0.1)",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  cardMeta: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  equipButton: {
    minHeight: 42,
    minWidth: 76,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  equipText: {
    color: "#050505",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  portraitWrap: {
    borderWidth: 2,
    borderColor: colors.gold,
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
    fontSize: 24,
  },
});
