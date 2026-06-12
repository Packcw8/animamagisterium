import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase, Tables } from "../lib/supabase";
import { CharacterCreationInput, CharacterWithDetails, createCharacter } from "../services/characterService";

type CharacterCreationScreenProps = {
  assets: Tables["avatar_assets"][];
  onCreated: (character: CharacterWithDetails) => void;
};

type PickedPhoto = {
  file: File;
  previewUrl: string;
};

const genders = ["Male", "Female"];
const ancestries = ["Human", "Elf", "Dwarf", "Woodkin", "Drakesoul", "Stoneborn", "Fae-Touched", "Aetherborn"];
const homelands = ["Valewood", "Frostmark", "Duskwold", "Sunspire", "Ironvale", "Moonfen"];
const origins = ["Wayfarer", "Scholar", "Laborer", "Outcast", "Builder", "Guardian", "Noble Exile", "Village Healer"];
const paths = ["Warrior", "Ranger", "Druid", "Sage", "Artificer", "Merchant", "Guardian", "Shadow Scout"];
const traits = ["Calm Resolve", "Bright-Eyed", "Scarred Veteran", "Stern Watcher", "Mirthful Rogue", "Haunted Scholar", "Gentle Healer", "Iron-Willed"];
const steps = ["Upload Photo", "Identity", "Generate Avatar", "Save"];

export function CharacterCreationScreen({ assets, onCreated }: CharacterCreationScreenProps) {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState("");
  const [portraitUrl, setPortraitUrl] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState(genders[0]);
  const [ancestry, setAncestry] = useState(ancestries[0]);
  const [homeland, setHomeland] = useState(homelands[0]);
  const [origin, setOrigin] = useState(origins[0]);
  const [path, setPath] = useState(paths[0]);
  const [trait, setTrait] = useState(traits[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackAssets = useMemo(() => {
    return {
      base: assets.find((asset) => asset.type === "base")?.id,
      face: assets.find((asset) => asset.type === "face")?.id,
      hair: assets.find((asset) => asset.type === "hair")?.id,
      armor: assets.find((asset) => asset.type === "armor")?.id,
      weapon: assets.find((asset) => asset.type === "weapon")?.id,
      cloak: assets.find((asset) => asset.type === "cloak")?.id,
    };
  }, [assets]);

  function pickPhoto() {
    setError(null);

    if (typeof document === "undefined") {
      setError("Photo upload is currently available in the web app.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "user";
    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      setPhoto({
        file,
        previewUrl: URL.createObjectURL(file),
      });
      setOriginalPhotoUrl("");
      setPortraitUrl("");
    };
    input.click();
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

      const extension = photo.file.name.split(".").pop() || "png";
      const storagePath = `${user.id}/selfie-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("user-selfies").upload(storagePath, photo.file, {
        contentType: photo.file.type || "image/png",
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("user-selfies").getPublicUrl(storagePath);
      setOriginalPhotoUrl(data.publicUrl);
      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function generateAvatar() {
    setIsGenerating(true);
    setError(null);

    try {
      const imageUrl = await uploadOriginalPhoto();
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        throw new Error("You must be signed in before generating a portrait.");
      }

      const response = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          imageUrl,
          gender,
          ancestry,
          homeland,
          origin,
          path,
          trait,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to generate avatar.");
      }

      if (!result.portraitUrl) {
        throw new Error("Avatar generated, but no portrait URL was returned.");
      }

      setPortraitUrl(result.portraitUrl);
      setStep(3);
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
      setError("Generate your fantasy portrait before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: CharacterCreationInput = {
        name,
        gender,
        ancestry,
        homeland,
        origin,
        path,
        trait,
        originalPhotoUrl,
        portraitUrl,
        appearance: {
          baseAssetId: fallbackAssets.base,
          faceAssetId: fallbackAssets.face,
          hairAssetId: fallbackAssets.hair,
          armorAssetId: fallbackAssets.armor,
          weaponAssetId: fallbackAssets.weapon,
          cloakAssetId: fallbackAssets.cloak,
          skinTone: ancestry,
        },
      };

      onCreated(await createCharacter(payload));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save character.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Text style={styles.stepLabel}>Step {step + 1} of {steps.length}: {steps[step]}</Text>
      </View>

      <Frame style={styles.panel}>
        {step === 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Upload Photo</Text>
            <Text style={styles.copy}>Upload or take a selfie/profile image. This original image is stored in Supabase Storage before avatar generation.</Text>
            {photo ? <Image source={{ uri: photo.previewUrl }} style={styles.preview} /> : <View style={styles.emptyPreview}><Text style={styles.emptyText}>No photo selected</Text></View>}
            <Pressable style={styles.primaryButton} onPress={pickPhoto} disabled={isUploading}>
              <Text style={styles.primaryText}>{photo ? "Choose Different Photo" : "Upload Photo"}</Text>
            </Pressable>
          </View>
        ) : step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Character Identity</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Character name" placeholderTextColor={colors.muted} style={styles.input} />
            <ChoiceGrid title="Gender" options={genders} selected={gender} onSelect={setGender} />
            <ChoiceGrid title="Ancestry" options={ancestries} selected={ancestry} onSelect={setAncestry} />
            <ChoiceGrid title="Homeland" options={homelands} selected={homeland} onSelect={setHomeland} />
            <ChoiceGrid title="Origin" options={origins} selected={origin} onSelect={setOrigin} />
            <ChoiceGrid title="Path" options={paths} selected={path} onSelect={setPath} />
            <ChoiceGrid title="Trait" options={traits} selected={trait} onSelect={setTrait} />
          </View>
        ) : step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Generate Avatar</Text>
            {photo ? <Image source={{ uri: photo.previewUrl }} style={styles.preview} /> : null}
            <Summary label="Ancestry" value={ancestry} />
            <Summary label="Path" value={path} />
            <Summary label="Trait" value={trait} />
            <Pressable style={styles.primaryButton} onPress={() => void generateAvatar()} disabled={isGenerating || isUploading}>
              {isGenerating || isUploading ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>Generate Fantasy Portrait</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.title}>Save Character</Text>
            {portraitUrl ? <Image source={{ uri: portraitUrl }} style={styles.portrait} /> : null}
            <Summary label="Name" value={name || "Unnamed"} />
            <Summary label="Gender" value={gender} />
            <Summary label="Ancestry" value={ancestry} />
            <Summary label="Homeland" value={homeland} />
            <Summary label="Origin" value={origin} />
            <Summary label="Path" value={path} />
            <Summary label="Trait" value={trait} />
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>Save Character</Text>}
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || isSaving || isGenerating}>
            <Text style={styles.navText}>Back</Text>
          </Pressable>
          {step < steps.length - 1 ? (
            <Pressable
              style={styles.nextButton}
              onPress={() => {
                if (step === 0 && !photo) {
                  setError("Upload a photo before continuing.");
                  return;
                }
                if (step === 2 && !portraitUrl) {
                  setError("Generate your avatar before continuing.");
                  return;
                }
                setError(null);
                setStep(Math.min(steps.length - 1, step + 1));
              }}
              disabled={isSaving || isGenerating}
            >
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
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
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
