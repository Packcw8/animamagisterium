import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase, Tables } from "../lib/supabase";
import { CharacterCreationInput, CharacterWithDetails, createCharacter } from "../services/characterService";
import { pickCharacterPhoto, PickedImage } from "../services/nativeMediaService";

type CharacterCreationScreenProps = {
  assets: Tables["avatar_assets"][];
  onCreated: (character: CharacterWithDetails) => void;
};

const genders = ["Male", "Female"];
const races = ["Human", "Elf", "Dwarf", "Beastkin", "Orc", "Halfling"];
const origins = ["Farmhand", "Scholar", "Hunter", "Orphan", "Merchant's Child", "Exiled Noble", "Street Survivor", "Wanderer"];
const steps = ["Upload Image", "Generate Avatar", "Begin Adventure"];

export function CharacterCreationScreen({ onCreated }: CharacterCreationScreenProps) {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState("");
  const [portraitUrl, setPortraitUrl] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState(genders[0]);
  const [race, setRace] = useState(races[0]);
  const [origin, setOrigin] = useState(origins[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto() {
    setError(null);

    try {
      const pickedPhoto = await pickCharacterPhoto();

      if (!pickedPhoto) {
        return;
      }

      setPhoto(pickedPhoto);
      setOriginalPhotoUrl("");
      setPortraitUrl("");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to open camera or photo picker.");
    }
  }

  async function uploadOriginalPhoto() {
    if (!photo) {
      throw new Error("Upload a selfie or profile image first.");
    }

    if (originalPhotoUrl) {
      return originalPhotoUrl;
    }

    setIsUploading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in before uploading a photo.");
      }

      const extension = photo.fileName.split(".").pop() || "png";
      const storagePath = `${user.id}/selfie-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("user-selfies").upload(storagePath, photo.uploadBody, {
        contentType: photo.contentType || "image/png",
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("user-selfies").getPublicUrl(storagePath);
      setOriginalPhotoUrl(data.publicUrl);
      console.log("[character-creation] uploaded original_photo_url", {
        original_photo_url: data.publicUrl,
      });
      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function generateAvatar() {
    setIsGenerating(true);
    setError(null);

    try {
      const uploadedOriginalPhotoUrl = await uploadOriginalPhoto();
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        throw new Error("You must be signed in before generating a portrait.");
      }

      const payload = {
        original_photo_url: uploadedOriginalPhotoUrl,
        gender,
        race,
        origin,
      };

      console.log("[character-creation] generate-avatar request payload", payload);

      const response = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      console.log("[character-creation] generate-avatar response JSON", result);

      if (!response.ok) {
        throw new Error(result.error || "Unable to generate avatar.");
      }

      const { portrait_url } = result;

      if (!portrait_url) {
        throw new Error("Avatar generated, but no portrait URL was returned.");
      }

      console.log("[character-creation] final portrait_url state", {
        portrait_url,
      });

      setPortraitUrl(portrait_url);
      setStep(2);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate avatar.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Character name is required.");
      return;
    }

    if (!originalPhotoUrl || !portraitUrl) {
      setError("Generate your fantasy portrait before beginning your adventure.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: CharacterCreationInput = {
        name,
        gender,
        race,
        origin,
        original_photo_url: originalPhotoUrl,
        portrait_url: portraitUrl,
        appearance: {
          skinTone: race,
        },
      };

      onCreated(await createCharacter(payload));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save character.");
    } finally {
      setIsSaving(false);
    }
  }

  function goNext() {
    if (step === 0 && !photo) {
      setError("Upload an image before continuing.");
      return;
    }

    if (step === 1 && !portraitUrl) {
      setError("Generate your avatar before continuing.");
      return;
    }

    setError(null);
    setStep(Math.min(steps.length - 1, step + 1));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.stepLabel}>Step {step + 1} of {steps.length}: {steps[step]}</Text>
        </View>
      </View>

      <Frame style={styles.panel}>
        {step === 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Upload Image</Text>
            <Text style={styles.copy}>Begin with a clear front-facing selfie or profile image. This image becomes the foundation for your fantasy portrait.</Text>
            {photo ? <Image source={{ uri: photo.previewUrl }} style={styles.preview} /> : <View style={styles.emptyPreview}><Text style={styles.emptyText}>No image selected</Text></View>}
            <Pressable style={styles.primaryButton} onPress={() => void pickPhoto()} disabled={isUploading}>
              <Text style={styles.primaryText}>{photo ? "Choose Different Image" : "Upload Image"}</Text>
            </Pressable>
          </View>
        ) : step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Generate Fantasy Avatar</Text>
            {photo ? <Image source={{ uri: photo.previewUrl }} style={styles.preview} /> : null}
            <Text style={styles.copy}>Gender, race, and origin shape story flavor and future dialogue only. They do not grant stat bonuses, XP bonuses, passive abilities, or starting skills.</Text>
            <ChoiceGrid title="Gender" options={genders} selected={gender} onSelect={setGender} />
            <ChoiceGrid title="Race" options={races} selected={race} onSelect={setRace} />
            <ChoiceGrid title="Origin" options={origins} selected={origin} onSelect={setOrigin} />
            <Text style={styles.copy}>Your generated portrait will preserve your recognizable facial features while adapting you into Animamagisterium's dark fantasy style.</Text>
            {isGenerating || isUploading ? <Text style={styles.loadingText}>Generating avatar - this may take 20-60 seconds.</Text> : null}
            <Pressable style={[styles.primaryButton, (isGenerating || isUploading) && styles.disabledButton]} onPress={() => void generateAvatar()} disabled={isGenerating || isUploading}>
              {isGenerating || isUploading ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>Generate Avatar</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.title}>Begin Adventure</Text>
            {portraitUrl ? <Image source={{ uri: portraitUrl }} style={styles.portrait} /> : null}
            <TextInput value={name} onChangeText={setName} placeholder="Character name" placeholderTextColor={colors.muted} style={styles.input} />
            <Summary label="Gender" value={gender} />
            <Summary label="Race" value={race} />
            <Summary label="Origin" value={origin} />
            <Pressable style={[styles.primaryButton, (!portraitUrl || isSaving) && styles.disabledButton]} onPress={() => void handleSave()} disabled={isSaving || !portraitUrl}>
              {isSaving ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>Begin Adventure</Text>}
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || isSaving || isGenerating}>
            <Text style={styles.navText}>Back</Text>
          </Pressable>
          {step === 0 ? (
            <Pressable style={styles.nextButton} onPress={goNext} disabled={isSaving || isGenerating}>
              <Text style={styles.nextText}>Next</Text>
            </Pressable>
          ) : null}
        </View>
      </Frame>
    </Screen>
  );
}

function ChoiceGrid({ title, options, selected, onSelect }: { title: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.choiceSection}>
      <Text style={styles.subhead}>{title}</Text>
      <View style={styles.grid}>
        {options.map((option) => (
          <Pressable key={option} style={[styles.choice, selected === option && styles.selected]} onPress={() => onSelect(option)}>
            <Text style={styles.choiceTitle}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 23,
    letterSpacing: 0,
  },
  stepLabel: {
    color: colors.blue,
    marginTop: 8,
    fontWeight: "700",
  },
  panel: {
    margin: 12,
    padding: 14,
  },
  section: {
    gap: 12,
  },
  choiceSection: {
    gap: 9,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "800",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  preview: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  portrait: {
    width: "100%",
    height: 360,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  emptyPreview: {
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  emptyText: {
    color: colors.muted,
  },
  input: {
    minHeight: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  grid: {
    flexDirection: "column",
    gap: 10,
  },
  choice: {
    width: "100%",
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 9, 0.86)",
  },
  selected: {
    borderColor: colors.blue,
    backgroundColor: "rgba(25, 69, 94, 0.65)",
  },
  choiceTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
  },
  subhead: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 17,
    textTransform: "uppercase",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 10,
    gap: 14,
  },
  summaryLabel: {
    color: colors.muted,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
  primaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: colors.gold,
    marginTop: 8,
  },
  primaryText: {
    color: "#120e08",
    fontWeight: "900",
  },
  error: {
    color: "#ffb4aa",
    marginTop: 14,
    lineHeight: 20,
  },
  loadingText: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.48,
  },
  navRow: {
    flexDirection: "column",
    gap: 12,
    marginTop: 18,
  },
  navButton: {
    width: "100%",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  navText: {
    color: colors.gold,
    fontWeight: "800",
  },
  nextButton: {
    width: "100%",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(30, 168, 236, 0.84)",
  },
  nextText: {
    color: "#031018",
    fontWeight: "900",
  },
});
