import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import {
  blankStoryCard,
  blankStoryDeck,
  deleteStoryCard,
  deleteStoryDeck,
  formatStoryDeckLabel,
  getStoryCards,
  getStoryDecks,
  resolveStoryDeckAssetUri,
  saveStoryCard,
  saveStoryDeck,
  storyCardTextPositions,
  storyCardTextStyles,
  storyDeckTriggerTypes,
  storyDeckTypes,
  type StoryCard,
  type StoryDeck,
} from "../../services/storyDeckService";
import { AdminImageUploadButton } from "./AdminImageUploadButton";
import { colors, fonts } from "../theme";

type StoryDeckDraft = ReturnType<typeof blankStoryDeck> & { id?: string };
type StoryCardDraft = ReturnType<typeof blankStoryCard> & { id?: string };

export function StoryDeckAdminPanel() {
  const [decks, setDecks] = useState<StoryDeck[]>([]);
  const [cards, setCards] = useState<StoryCard[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [deckDraft, setDeckDraft] = useState<StoryDeckDraft>(blankStoryDeck());
  const [cardDraft, setCardDraft] = useState<StoryCardDraft>(blankStoryCard());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedDeck = useMemo(() => decks.find((deck) => deck.id === selectedDeckId) ?? null, [decks, selectedDeckId]);
  const scopedDecks = useMemo(() => [...decks].sort(sortDecks), [decks]);
  const previewImage = resolveStoryDeckAssetUri(cardDraft.image_url);

  useEffect(() => {
    void loadDecks();
  }, []);

  async function loadDecks() {
    setLoading(true);
    try {
      const loaded = await getStoryDecks();
      setDecks(loaded);
      if (!selectedDeckId && loaded[0]) {
        void selectDeck(loaded[0]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load story decks.");
    } finally {
      setLoading(false);
    }
  }

  async function selectDeck(deck: StoryDeck) {
    setSelectedDeckId(deck.id);
    setDeckDraft({
      id: deck.id,
      title: deck.title,
      description: deck.description,
      deck_type: deck.deck_type,
      trigger_type: deck.trigger_type,
      trigger_key: deck.trigger_key,
      season_number: deck.season_number,
      chapter_number: deck.chapter_number,
      play_once: deck.play_once,
      save_to_journal: deck.save_to_journal,
      replayable: deck.replayable,
      is_published: deck.is_published,
      is_active: deck.is_active,
      sort_order: deck.sort_order,
    });
    const loadedCards = await getStoryCards(deck.id);
    setCards(loadedCards);
    setCardDraft(blankStoryCard(deck.id));
  }

  function newDeck() {
    setSelectedDeckId(null);
    setDeckDraft(blankStoryDeck());
    setCards([]);
    setCardDraft(blankStoryCard());
    setMessage(null);
  }

  function editCard(card: StoryCard) {
    setCardDraft({
      id: card.id,
      deck_id: card.deck_id,
      title: card.title,
      body: card.body,
      image_url: card.image_url,
      text_position: card.text_position,
      text_style: card.text_style,
      button_text: card.button_text,
      sound_url: card.sound_url,
      sort_order: card.sort_order,
    });
  }

  async function saveDeckDraft() {
    if (!deckDraft.title.trim()) {
      setMessage("Deck title is required.");
      return;
    }

    try {
      const saved = await saveStoryDeck(deckDraft);
      setDecks((current) => [saved, ...current.filter((deck) => deck.id !== saved.id)].sort(sortDecks));
      setSelectedDeckId(saved.id);
      setDeckDraft({ ...deckDraft, id: saved.id });
      setCardDraft((current) => ({ ...current, deck_id: saved.id }));
      setMessage("Story deck saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save story deck. Confirm the migration has run.");
    }
  }

  async function removeDeck(deckId: string) {
    try {
      await deleteStoryDeck(deckId);
      setDecks((current) => current.filter((deck) => deck.id !== deckId));
      if (selectedDeckId === deckId) newDeck();
      setMessage("Story deck deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete story deck.");
    }
  }

  async function saveCardDraft() {
    const deckId = selectedDeckId ?? deckDraft.id;
    if (!deckId) {
      setMessage("Save the story deck before adding cards.");
      return;
    }
    if (!cardDraft.body.trim()) {
      setMessage("Card text is required.");
      return;
    }

    try {
      const saved = await saveStoryCard({ ...cardDraft, deck_id: deckId });
      setCards((current) => [saved, ...current.filter((card) => card.id !== saved.id)].sort(sortCards));
      setCardDraft(blankStoryCard(deckId));
      setMessage("Story card saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save story card.");
    }
  }

  async function removeCard(cardId: string) {
    try {
      await deleteStoryCard(cardId);
      setCards((current) => current.filter((card) => card.id !== cardId));
      if (cardDraft.id === cardId) setCardDraft(blankStoryCard(selectedDeckId ?? ""));
      setMessage("Story card deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete story card.");
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Narrative Cards</Text>
          <Text style={styles.title}>Story Deck Builder</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={newDeck}>
          <Text style={styles.smallButtonText}>New Deck</Text>
        </Pressable>
      </View>
      <Text style={styles.copy}>Create illustrated lore scenes, chapter recaps, tutorials, and dramatic story slides. Decks can be saved to the Journey journal for replay.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.deckList}>
        {loading ? <Text style={styles.copy}>Loading story decks...</Text> : null}
        {scopedDecks.map((deck) => (
          <Pressable key={deck.id} style={[styles.deckChip, selectedDeckId === deck.id && styles.deckChipActive]} onPress={() => void selectDeck(deck)}>
            <Text style={styles.deckChipTitle}>{deck.title}</Text>
            <Text style={styles.deckChipMeta}>S{deck.season_number} / C{deck.chapter_number} / {formatStoryDeckLabel(deck.trigger_type)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>{selectedDeck ? "Edit Deck" : "Create Deck"}</Text>
        <TextInput value={deckDraft.title} onChangeText={(value) => setDeckDraft((current) => ({ ...current, title: value }))} placeholder="Deck title" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={deckDraft.description ?? ""} onChangeText={(value) => setDeckDraft((current) => ({ ...current, description: value }))} placeholder="Admin description optional" placeholderTextColor={colors.muted} style={[styles.input, styles.textArea]} multiline />
        <Text style={styles.label}>Deck Type</Text>
        <View style={styles.chips}>
          {storyDeckTypes.map((type) => <Chip key={type} label={formatStoryDeckLabel(type)} active={deckDraft.deck_type === type} onPress={() => setDeckDraft((current) => ({ ...current, deck_type: type }))} />)}
        </View>
        <Text style={styles.label}>Trigger</Text>
        <View style={styles.chips}>
          {storyDeckTriggerTypes.map((trigger) => <Chip key={trigger} label={formatStoryDeckLabel(trigger)} active={deckDraft.trigger_type === trigger} onPress={() => setDeckDraft((current) => ({ ...current, trigger_type: trigger }))} />)}
        </View>
        <TextInput value={deckDraft.trigger_key ?? ""} onChangeText={(value) => setDeckDraft((current) => ({ ...current, trigger_key: value }))} placeholder="Trigger key optional, like marker id, chapter_1_complete, raven_rest" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.grid}>
          <TextInput value={String(deckDraft.season_number)} onChangeText={(value) => setDeckDraft((current) => ({ ...current, season_number: Number(value) || 1 }))} placeholder="Season" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={String(deckDraft.chapter_number)} onChangeText={(value) => setDeckDraft((current) => ({ ...current, chapter_number: Number(value) || 1 }))} placeholder="Chapter" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={String(deckDraft.sort_order)} onChangeText={(value) => setDeckDraft((current) => ({ ...current, sort_order: Number(value) || 0 }))} placeholder="Sort" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <View style={styles.chips}>
          <Chip label={`Play Once: ${deckDraft.play_once ? "Yes" : "No"}`} active={deckDraft.play_once} onPress={() => setDeckDraft((current) => ({ ...current, play_once: !current.play_once }))} />
          <Chip label={`Save To Journal: ${deckDraft.save_to_journal ? "Yes" : "No"}`} active={deckDraft.save_to_journal} onPress={() => setDeckDraft((current) => ({ ...current, save_to_journal: !current.save_to_journal }))} />
          <Chip label={`Replayable: ${deckDraft.replayable ? "Yes" : "No"}`} active={deckDraft.replayable} onPress={() => setDeckDraft((current) => ({ ...current, replayable: !current.replayable }))} />
          <Chip label={`Published: ${deckDraft.is_published ? "Yes" : "No"}`} active={deckDraft.is_published} onPress={() => setDeckDraft((current) => ({ ...current, is_published: !current.is_published }))} />
          <Chip label={`Active: ${deckDraft.is_active ? "Yes" : "No"}`} active={deckDraft.is_active} onPress={() => setDeckDraft((current) => ({ ...current, is_active: !current.is_active }))} />
        </View>
        <View style={styles.row}>
          <Pressable style={styles.saveButton} onPress={() => void saveDeckDraft()}>
            <Text style={styles.saveButtonText}>{selectedDeck ? "Save Deck" : "Create Deck"}</Text>
          </Pressable>
          {selectedDeck ? (
            <Pressable style={styles.deleteButton} onPress={() => void removeDeck(selectedDeck.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Cards</Text>
        <Text style={styles.copy}>Cards play in sort order. Keep each card short so it feels dramatic on mobile.</Text>
        <TextInput value={cardDraft.title ?? ""} onChangeText={(value) => setCardDraft((current) => ({ ...current, title: value }))} placeholder="Card title optional" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={cardDraft.body} onChangeText={(value) => setCardDraft((current) => ({ ...current, body: value }))} placeholder="Card text" placeholderTextColor={colors.muted} style={[styles.input, styles.cardBody]} multiline />
        <TextInput value={cardDraft.image_url ?? ""} onChangeText={(value) => setCardDraft((current) => ({ ...current, image_url: value }))} placeholder="Image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
        <AdminImageUploadButton folder="story-cards" onUploaded={(url) => setCardDraft((current) => ({ ...current, image_url: url }))} onMessage={setMessage} />
        {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} /> : null}
        <TextInput value={cardDraft.sound_url ?? ""} onChangeText={(value) => setCardDraft((current) => ({ ...current, sound_url: value }))} placeholder="Sound URL optional" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={cardDraft.button_text} onChangeText={(value) => setCardDraft((current) => ({ ...current, button_text: value }))} placeholder="Button text" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.grid}>
          <TextInput value={String(cardDraft.sort_order)} onChangeText={(value) => setCardDraft((current) => ({ ...current, sort_order: Number(value) || 0 }))} placeholder="Sort" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <Text style={styles.label}>Text Position</Text>
        <View style={styles.chips}>
          {storyCardTextPositions.map((position) => <Chip key={position} label={formatStoryDeckLabel(position)} active={cardDraft.text_position === position} onPress={() => setCardDraft((current) => ({ ...current, text_position: position }))} />)}
        </View>
        <Text style={styles.label}>Text Style</Text>
        <View style={styles.chips}>
          {storyCardTextStyles.map((style) => <Chip key={style} label={formatStoryDeckLabel(style)} active={cardDraft.text_style === style} onPress={() => setCardDraft((current) => ({ ...current, text_style: style }))} />)}
        </View>
        <View style={styles.row}>
          <Pressable style={styles.saveButton} onPress={() => void saveCardDraft()}>
            <Text style={styles.saveButtonText}>{cardDraft.id ? "Save Card" : "Add Card"}</Text>
          </Pressable>
          {cardDraft.id ? (
            <Pressable style={styles.smallButton} onPress={() => setCardDraft(blankStoryCard(selectedDeckId ?? ""))}>
              <Text style={styles.smallButtonText}>New Card</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.cardList}>
        {cards.length === 0 ? <Text style={styles.copy}>No cards in this deck yet.</Text> : null}
        {cards.map((card) => (
          <View key={card.id} style={styles.cardRow}>
            {resolveStoryDeckAssetUri(card.image_url) ? <Image source={{ uri: resolveStoryDeckAssetUri(card.image_url)! }} style={styles.cardThumb} /> : null}
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{card.title || `Card ${card.sort_order + 1}`}</Text>
              <Text style={styles.cardMeta}>Sort {card.sort_order} / {formatStoryDeckLabel(card.text_position)} / {formatStoryDeckLabel(card.text_style)}</Text>
              <Text style={styles.cardBodyText} numberOfLines={3}>{card.body}</Text>
            </View>
            <Pressable style={styles.rowButton} onPress={() => editCard(card)}>
              <Text style={styles.rowButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => void removeCard(card.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.activeChip]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.activeChipText]}>{label}</Text>
    </Pressable>
  );
}

function sortDecks(a: StoryDeck, b: StoryDeck) {
  return Number(a.season_number) - Number(b.season_number)
    || Number(a.chapter_number) - Number(b.chapter_number)
    || Number(a.sort_order) - Number(b.sort_order)
    || a.title.localeCompare(b.title);
}

function sortCards(a: StoryCard, b: StoryCard) {
  return Number(a.sort_order) - Number(b.sort_order) || a.created_at.localeCompare(b.created_at);
}

const styles = StyleSheet.create({
  activeChip: {
    backgroundColor: "rgba(0, 174, 255, 0.18)",
    borderColor: colors.blue,
  },
  activeChipText: {
    color: colors.blue,
  },
  cardBody: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  cardBodyText: {
    color: colors.muted,
    lineHeight: 18,
  },
  cardList: {
    gap: 10,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  cardRow: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardThumb: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    height: 64,
    width: 64,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  chip: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  deckChip: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  deckChipActive: {
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    borderColor: colors.gold,
  },
  deckChipMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  deckChipTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  deckList: {
    gap: 8,
  },
  deleteButton: {
    alignItems: "center",
    borderColor: colors.red,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: colors.red,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  form: {
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 13,
    textTransform: "uppercase",
  },
  message: {
    color: colors.gold,
    fontWeight: "800",
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  previewImage: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 160,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowButton: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    color: "#090704",
    fontWeight: "900",
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  smallButton: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: "top",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
});
