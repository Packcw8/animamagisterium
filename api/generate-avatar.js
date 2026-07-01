const OpenAI = require("openai").default;
const { toFile } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^[']|[']$/g, "").replace(/^[\"]|[\"]$/g, "");
    }
  }
}

loadLocalEnv();

const raceGuidance = {
  Human: "realistic human adventurer, grounded and believable",
  Elf: "elegant forest-blooded ancestry, subtle pointed ears, graceful features",
  Dwarf: "sturdy mountain-blooded ancestry, strong build, practical ornamental gear",
  Beastkin: "subtle animal-inspired fantasy traits, expressive eyes, grounded realistic features, no cartoon muzzle",
  Orc: "strong tusked fantasy ancestry, powerful presence, realistic skin texture, not monstrous or exaggerated",
  Halfling: "warm expressive face, compact heroic presence, practical adventurer styling",
};

function isCustomAvatar(input) {
  return input.custom_avatar === true || input.avatar_mode === "custom";
}

function validateInput(input) {
  const requiredFields = ["gender", "race", "origin"];

  if (!isCustomAvatar(input)) {
    requiredFields.unshift("original_photo_url");
  }

  const missingFields = requiredFields.filter((field) => !input[field]);

  if (missingFields.length > 0) {
    return `Missing required field(s): ${missingFields.join(", ")}`;
  }

  return null;
}

function buildSharedStylePrompt(input) {
  return `Apply:
- front-facing head-and-shoulders character portrait composition
- primary player avatar framing suitable for a game profile image
- dark fantasy realism
- subtle bronze and gold clothing or background detailing
- deep blue magical energy only as faint ambient background light or small distant accents
- cinematic lighting
- premium RPG character portrait style
- modern real life blended with epic fantasy
- simple neckline and practical fantasy clothing without a necklace or amulet

Character choices:
- Gender: ${input.gender}
- Race: ${input.race}
- Origin: ${input.origin}

Race guidance:
${raceGuidance[input.race] || raceGuidance.Human}

Origin flavor:
${input.origin} should influence clothing texture, mood, and background details only. It must not imply special powers, combat abilities, stat bonuses, or starting skills.

Avoid:
- copyrighted D&D settings, names, monsters, or lore
- cartoon style
- anime style
- full-body image
- side profile
- necklace
- amulet
- pendant
- glowing blue jewelry
- glowing blue object on the neck or chest
- distorted face
- exaggerated horns
- oversexualized clothing
- unreadable background
- preset combat-role weapons, uniforms, or starting-role identity`;
}

function buildPhotoPrompt(input) {
  return `Transform the uploaded person into an Animamagisterium fantasy RPG character.

Preserve:
- facial identity
- eye shape
- facial structure
- recognizable likeness
- apparent age and youthful/aged cues from the uploaded photo
- natural facial proportions, skin texture, and face fullness

${buildSharedStylePrompt(input)}

Additional avoid rules:
- changing the person beyond recognition
- aging the person up
- adding wrinkles, gray hair, gaunt cheeks, or age lines that are not in the photo`;
}

function buildCustomPrompt(input) {
  return `Create an original Animamagisterium fantasy RPG character portrait for a player who chose not to upload a photo.

Identity direction:
- Do not resemble a real private person or celebrity.
- Make the character feel like a grounded, believable adventurer at the beginning of a long journey.
- Use a front-facing face-focused portrait suitable as the player's primary avatar.

${buildSharedStylePrompt(input)}`;
}

function normalizeImageMimeType(contentType) {
  const cleanType = String(contentType || "").split(";")[0].trim().toLowerCase();

  if (cleanType === "image/jpg") {
    return "image/jpeg";
  }

  if (["image/jpeg", "image/png", "image/webp"].includes(cleanType)) {
    return cleanType;
  }

  return null;
}

function getImageFileName(mimeType) {
  if (mimeType === "image/png") {
    return "selfie.png";
  }

  if (mimeType === "image/webp") {
    return "selfie.webp";
  }

  return "selfie.jpg";
}

async function claimGenerationSlot(supabase, userId, mode) {
  const { data, error } = await supabase
    .from("user_avatar_generations")
    .insert({ user_id: userId, status: "started", mode })
    .select("id")
    .single();

  if (error?.code === "23505") {
    throw new Error("This account has already used its avatar generation. You can continue with the generated portrait or contact support if generation failed.");
  }

  if (error) {
    console.warn("[generate-avatar] generation limit table unavailable", { message: error.message });
    return null;
  }

  return data?.id ?? null;
}

async function updateGenerationSlot(supabase, generationId, values) {
  if (!generationId) {
    return;
  }

  const { error } = await supabase
    .from("user_avatar_generations")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", generationId);

  if (error) {
    console.warn("[generate-avatar] could not update generation slot", { message: error.message });
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  let generationId = null;
  let supabase = null;

  try {
    const input = request.body || {};
    const mode = isCustomAvatar(input) ? "custom" : "photo";
    const authHeader = request.headers.authorization || "";
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const validationError = validateInput(input);

    if (validationError) {
      return response.status(400).json({ error: validationError });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return response.status(401).json({ error: "Missing Supabase bearer token." });
    }

    if (!supabaseUrl || !supabasePublishableKey) {
      return response.status(500).json({ error: "Supabase environment variables are not configured on the server." });
    }

    supabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return response.status(401).json({ error: userError?.message || "Invalid Supabase session." });
    }

    const existingCharacter = await supabase
      .from("characters")
      .select("id, portrait_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCharacter.data?.portrait_url) {
      return response.status(409).json({ error: "This account already has a character portrait." });
    }

    generationId = await claimGenerationSlot(supabase, user.id, mode);

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    console.log("[generate-avatar] request", {
      mode,
      original_photo_url: input.original_photo_url || null,
    });
    console.log("[generate-avatar] using OpenAI image model", { model });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let result;

    if (mode === "photo") {
      const imageResponse = await fetch(input.original_photo_url);

      if (!imageResponse.ok) {
        throw new Error("Unable to read uploaded selfie image.");
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const mimeType = normalizeImageMimeType(imageResponse.headers.get("content-type"));

      console.log("[generate-avatar] source image", {
        content_type: imageResponse.headers.get("content-type") || null,
        normalized_type: mimeType,
        bytes: imageBuffer.byteLength,
      });

      if (!mimeType) {
        throw new Error("Unsupported photo format. Please use a JPEG, PNG, or WebP image. On iPhone, retake or re-upload the photo so the app can convert it to JPEG.");
      }

      if (imageBuffer.byteLength <= 0) {
        throw new Error("Uploaded selfie image was empty.");
      }

      const imageFile = await toFile(imageBuffer, getImageFileName(mimeType), { type: mimeType });

      result = await client.images.edit({
        model,
        image: imageFile,
        prompt: buildPhotoPrompt(input),
        size: "1024x1024",
      });
    } else {
      result = await client.images.generate({
        model,
        prompt: buildCustomPrompt(input),
        size: "1024x1024",
      });
    }

    const imageBase64 = result.data?.[0]?.b64_json;
    const generatedImageUrl = result.data?.[0]?.url;

    console.log("[generate-avatar] OpenAI returned image data", {
      has_b64_json: Boolean(imageBase64),
      has_url: Boolean(generatedImageUrl),
    });

    let binary;

    if (imageBase64) {
      binary = Buffer.from(imageBase64, "base64");
    } else if (generatedImageUrl) {
      const generatedResponse = await fetch(generatedImageUrl);

      if (!generatedResponse.ok) {
        throw new Error("OpenAI returned an image URL, but it could not be downloaded.");
      }

      binary = Buffer.from(await generatedResponse.arrayBuffer());
    } else {
      throw new Error("OpenAI did not return an image.");
    }

    console.log("[generate-avatar] generated file size", {
      bytes: binary.byteLength,
    });

    const portraitPath = `${user.id}/portrait-${Date.now()}.png`;

    console.log("[generate-avatar] Supabase upload path", {
      portrait_path: portraitPath,
    });

    const { error: uploadError } = await supabase.storage.from("character-portraits").upload(portraitPath, binary, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from("character-portraits").getPublicUrl(portraitPath);
    const portrait_url = data.publicUrl;

    if (!portrait_url) {
      throw new Error("Supabase did not return a public portrait URL.");
    }

    await updateGenerationSlot(supabase, generationId, { status: "succeeded", portrait_url });

    console.log("[generate-avatar] final portrait_url", {
      portrait_url,
    });

    return response.status(200).json({
      portrait_url,
      original_photo_url: input.original_photo_url || null,
      mode,
    });
  } catch (error) {
    if (supabase && generationId) {
      await updateGenerationSlot(supabase, generationId, {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unable to generate avatar.",
      });
    }

    console.error("[generate-avatar] failed", {
      message: error instanceof Error ? error.message : "Unable to generate avatar.",
    });

    const status = error instanceof Error && error.message.includes("already used") ? 429 : 500;
    return response.status(status).json({
      error: error instanceof Error ? error.message : "Unable to generate avatar.",
    });
  }
};
