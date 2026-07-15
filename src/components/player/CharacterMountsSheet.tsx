import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import { getActiveMountMultiplier, resolveMountImageUri, type PlayerMountWithDefinition } from "../../services/mountService";

type CharacterMountsSheetProps = {
  mounts: PlayerMountWithDefinition[];
  activeMount: PlayerMountWithDefinition | null;
  message: string | null;
  onClose: () => void;
  onEquip: (mountId: string) => void;
  onUnmount: () => void;
};

export function CharacterMountsSheet({ mounts, activeMount, message, onClose, onEquip, onUnmount }: CharacterMountsSheetProps) {
  const activeMultiplier = getActiveMountMultiplier(activeMount);

  return (
    <Screen>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Travel</Text>
            <Text style={styles.title}>Mounts</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.activePanel}>
          <Text style={styles.panelLabel}>Active Mount</Text>
          <Text style={styles.activeTitle}>{activeMount?.mount?.name ?? "On Foot"}</Text>
          <Text style={styles.copy}>
            {activeMount?.mount
              ? `Trail progress is multiplied by ${activeMultiplier.toFixed(2)}x. Real walking distance still records normally.`
              : "Equip a mount to speed up walking path progress while keeping real distance tracking honest."}
          </Text>
          {activeMount ? (
            <Pressable style={styles.secondaryButton} onPress={onUnmount}>
              <Text style={styles.secondaryText}>Unmount</Text>
            </Pressable>
          ) : null}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <ScrollView contentContainerStyle={styles.mountList} showsVerticalScrollIndicator={false}>
          {mounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Mounts Owned</Text>
              <Text style={styles.copy}>Visit a market that sells mounts to add one to your stable.</Text>
            </View>
          ) : null}
          {mounts.map((entry) => {
            const mount = entry.mount;
            const imageUri = resolveMountImageUri(mount?.image_url);
            const equipped = entry.is_equipped;
            const multiplier = getActiveMountMultiplier(entry);

            return (
              <View key={entry.id} style={[styles.mountCard, equipped && styles.mountCardActive]}>
                <View style={styles.mountImageBox}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.mountImage} resizeMode="cover" fadeDuration={0} />
                  ) : (
                    <Text style={styles.mountFallback}>{(mount?.name ?? "?").slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.mountBody}>
                  <Text style={styles.mountName}>{mount?.name ?? "Unknown Mount"}</Text>
                  <Text style={styles.mountMeta}>{mount?.breed || "Mount"} / {mount?.rarity || "common"}</Text>
                  {mount?.description ? <Text style={styles.copy} numberOfLines={3}>{mount.description}</Text> : null}
                  <Text style={styles.boostText}>Trail progress x{multiplier.toFixed(2)}</Text>
                </View>
                <Pressable style={[styles.primaryButton, equipped && styles.disabledButton]} onPress={() => mount?.id && onEquip(mount.id)} disabled={equipped || !mount?.id}>
                  <Text style={styles.primaryText}>{equipped ? "Equipped" : "Equip"}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
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
    gap: 8,
    backgroundColor: "rgba(0, 8, 10, 0.72)",
  },
  panelLabel: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activeTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
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
  mountList: {
    gap: 12,
    paddingBottom: 32,
  },
  mountCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  mountCardActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217, 170, 93, 0.1)",
  },
  mountImageBox: {
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  mountImage: {
    width: "100%",
    height: "100%",
  },
  mountFallback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 48,
  },
  mountBody: {
    gap: 5,
  },
  mountName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  mountMeta: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  boostText: {
    color: colors.blue,
    fontSize: 13,
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
  disabledButton: {
    opacity: 0.65,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 18,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900",
  },
});
