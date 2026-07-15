import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { resolveStoryDeckAssetUri, type StoryCard, type StoryDeck } from "../../services/storyDeckService";
import { colors, fonts } from "../theme";

type StoryDeckViewerProps = {
  deck: StoryDeck;
  cards: StoryCard[];
  onClose: () => void;
  onComplete?: () => void;
};

export function StoryDeckViewer({ deck, cards, onClose, onComplete }: StoryDeckViewerProps) {
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const orderedCards = useMemo(() => [...cards].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [cards]);
  const activeCard = orderedCards[index] ?? null;
  const imageUri = resolveStoryDeckAssetUri(activeCard?.image_url);
  const isLastCard = index >= orderedCards.length - 1;

  function advance() {
    if (!isLastCard) {
      setIndex((current) => Math.min(current + 1, orderedCards.length - 1));
      return;
    }

    onComplete?.();
    onClose();
  }

  if (!activeCard) {
    return (
      <View style={[styles.shell, { minHeight: height }]}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>Story Deck</Text>
          <Text style={styles.title}>{deck.title}</Text>
          <Text style={styles.body}>No story cards have been added yet.</Text>
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.shell, { minHeight: height }]}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Story Deck</Text>
            <Text style={styles.title}>{deck.title}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          {imageUri ? <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.image} /> : <View style={styles.emptyImage} />}
          <View style={[styles.textBox, getTextPositionStyle(activeCard.text_position), getTextStyle(activeCard.text_style)]}>
            {activeCard.title ? <Text style={styles.cardTitle}>{activeCard.title}</Text> : null}
            <Text style={styles.body}>{activeCard.body}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.progress}>{index + 1} / {orderedCards.length}</Text>
          <View style={styles.actions}>
            {index > 0 ? (
              <Pressable style={styles.secondaryButton} onPress={() => setIndex((current) => Math.max(0, current - 1))}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={advance}>
              <Text style={styles.primaryButtonText}>{isLastCard ? "Done" : activeCard.button_text || "Continue"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function getTextPositionStyle(position: StoryCard["text_position"]) {
  if (position === "top") return styles.textTop;
  if (position === "center") return styles.textCenter;
  return styles.textBottom;
}

function getTextStyle(style: StoryCard["text_style"]) {
  if (style === "light") return styles.lightBox;
  if (style === "gold") return styles.goldBox;
  return styles.darkBox;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  cardTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  closeButton: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeText: {
    color: colors.blue,
    fontWeight: "900",
  },
  darkBox: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  emptyImage: {
    backgroundColor: "rgba(0,0,0,0.45)",
    ...StyleSheet.absoluteFillObject,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  goldBox: {
    backgroundColor: "rgba(44, 30, 9, 0.82)",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    width: "100%",
  },
  kicker: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  lightBox: {
    backgroundColor: "rgba(238, 229, 209, 0.88)",
  },
  panel: {
    backgroundColor: "rgba(3, 5, 5, 0.96)",
    flex: 1,
    gap: 14,
    padding: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#090704",
    fontWeight: "900",
  },
  progress: {
    color: colors.muted,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  shell: {
    backgroundColor: "#010505",
    flex: 1,
    width: "100%",
  },
  stage: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    position: "relative",
  },
  textBottom: {
    bottom: 0,
  },
  textBox: {
    borderColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: 8,
    left: 0,
    padding: 16,
    position: "absolute",
    right: 0,
  },
  textCenter: {
    top: "35%",
  },
  textTop: {
    top: 0,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 26,
  },
});
