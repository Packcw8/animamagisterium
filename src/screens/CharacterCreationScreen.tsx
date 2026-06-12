import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { Tables } from "../lib/supabase";
import { AvatarAssetType, CharacterCreationInput, CharacterWithDetails, createCharacter } from "../services/characterService";

type CharacterCreationScreenProps = {
  assets: Tables["avatar_assets"][];
  onCreated: (character: CharacterWithDetails) => void;
};

const origins = ["Wayfarer", "Scholar", "Laborer", "Outcast", "Builder", "Guardian"];
const paths = ["Warrior", "Ranger", "Sage", "Artificer", "Merchant", "Guardian"];
const skinTones = ["Moonlit", "Olive", "Umber", "Bronze", "Rose", "Ash"];
const steps = ["Origin", "Path", "Appearance", "Gear", "Name", "Save"];

export function CharacterCreationScreen({ assets, onCreated }: CharacterCreationScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState(origins[0]);
  const [path, setPath] = useState(paths[0]);
  const [skinTone, setSkinTone] = useState(skinTones[0]);
  const [selectedAssets, setSelectedAssets] = useState<Partial<Record<AvatarAssetType, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedAssets = useMemo(() => {
    return assets.reduce<Partial<Record<AvatarAssetType, Tables["avatar_assets"][]>>>((groups, asset) => {
      groups[asset.type] = [...(groups[asset.type] ?? []), asset];
      return groups;
    }, {});
  }, [assets]);

  function selectAsset(type: AvatarAssetType, assetId: string) {
    setSelectedAssets((current) => ({
      ...current,
      [type]: assetId,
    }));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Character name is required.");
      setStep(4);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: CharacterCreationInput = {
        name,
        origin,
        path,
        appearance: {
          baseAssetId: selectedAssets.base,
          faceAssetId: selectedAssets.face,
          hairAssetId: selectedAssets.hair,
          armorAssetId: selectedAssets.armor,
          weaponAssetId: selectedAssets.weapon,
          cloakAssetId: selectedAssets.cloak,
          skinTone,
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
          <ChoiceGrid title="Choose Origin" options={origins} selected={origin} onSelect={setOrigin} />
        ) : step === 1 ? (
          <ChoiceGrid title="Choose Path" options={paths} selected={path} onSelect={setPath} />
        ) : step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Choose Appearance</Text>
            <AssetSection type="base" assets={groupedAssets.base ?? []} selectedId={selectedAssets.base} onSelect={selectAsset} />
            <AssetSection type="face" assets={groupedAssets.face ?? []} selectedId={selectedAssets.face} onSelect={selectAsset} />
            <AssetSection type="hair" assets={groupedAssets.hair ?? []} selectedId={selectedAssets.hair} onSelect={selectAsset} />
            <Text style={styles.subhead}>Skin Tone</Text>
            <View style={styles.grid}>
              {skinTones.map((tone) => (
                <Pressable key={tone} style={[styles.choice, skinTone === tone && styles.selected]} onPress={() => setSkinTone(tone)}>
                  <Text style={styles.choiceTitle}>{tone}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : step === 3 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Choose Gear</Text>
            <AssetSection type="armor" assets={groupedAssets.armor ?? []} selectedId={selectedAssets.armor} onSelect={selectAsset} />
            <AssetSection type="weapon" assets={groupedAssets.weapon ?? []} selectedId={selectedAssets.weapon} onSelect={selectAsset} />
            <AssetSection type="cloak" assets={groupedAssets.cloak ?? []} selectedId={selectedAssets.cloak} onSelect={selectAsset} />
          </View>
        ) : step === 4 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Name Character</Text>
            <Text style={styles.copy}>The name will be written into your Supabase character record.</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Character name" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.title}>Save Character</Text>
            <Summary label="Origin" value={origin} />
            <Summary label="Path" value={path} />
            <Summary label="Name" value={name || "Unnamed"} />
            <Summary label="Skin Tone" value={skinTone} />
            <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#120e08" /> : <Text style={styles.saveText}>Create Character</Text>}
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || isSaving}>
            <Text style={styles.navText}>Back</Text>
          </Pressable>
          {step < steps.length - 1 ? (
            <Pressable style={styles.nextButton} onPress={() => setStep(Math.min(steps.length - 1, step + 1))}>
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
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {options.map((option) => (
          <Pressable key={option} style={[styles.choice, selected === option && styles.selected]} onPress={() => onSelect(option)}>
            <Text style={styles.choiceTitle}>{option}</Text>
            <Text style={styles.choiceMeta}>Origin Sigil</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AssetSection({
  type,
  assets,
  selectedId,
  onSelect,
}: {
  type: AvatarAssetType;
  assets: Tables["avatar_assets"][];
  selectedId?: string;
  onSelect: (type: AvatarAssetType, assetId: string) => void;
}) {
  return (
    <View style={styles.assetSection}>
      <Text style={styles.subhead}>{type}</Text>
      <View style={styles.grid}>
        {assets.map((asset) => (
          <Pressable key={asset.id} style={[styles.assetCard, selectedId === asset.id && styles.selected]} onPress={() => onSelect(type, asset.id)}>
            <Text style={styles.assetType}>{asset.type}</Text>
            <Text style={styles.choiceTitle}>{asset.name}</Text>
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
    margin: 14,
    padding: 14,
  },
  section: {
    gap: 12,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choice: {
    width: "48%",
    minHeight: 86,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 9, 0.86)",
  },
  assetCard: {
    width: "48%",
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(4, 7, 10, 0.86)",
  },
  selected: {
    borderColor: colors.blue,
    backgroundColor: "rgba(25, 69, 94, 0.65)",
  },
  choiceTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
  choiceMeta: {
    color: colors.gold,
    marginTop: 6,
    fontSize: 12,
  },
  assetType: {
    color: colors.gold,
    textTransform: "uppercase",
    fontSize: 11,
    marginBottom: 8,
  },
  assetSection: {
    gap: 9,
  },
  subhead: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 17,
    textTransform: "uppercase",
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 10,
  },
  summaryLabel: {
    color: colors.muted,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "800",
  },
  saveButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: colors.gold,
    marginTop: 8,
  },
  saveText: {
    color: "#120e08",
    fontWeight: "900",
  },
  error: {
    color: "#ffb4aa",
    marginTop: 14,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
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
    flex: 1,
    minHeight: 48,
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
