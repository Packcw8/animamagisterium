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
      process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
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

function validateInput(input) {
  const requiredFields = ["original_photo_url", "gender", "race", "origin"];
  const missingFields = requiredFields.filter((field) => !input[field]);

  if (missingFields.length > 0) {
    return `Missing required field(s): ${missingFields.join(", ")}`;
  }

  return null;
}

function buildPrompt(input) {
  return `Transform the uploaded person into an Animamagisterium fantasy RPG character.

Preserve:
- facial identity
- eye shape
- facial structure
- recognizable likeness
- apparent age and youthful/aged cues from the uploaded photo
- natural facial proportions, skin texture, and face fullness

Apply:
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
- aging the person up
- adding wrinkles, gray hair, gaunt cheeks, or age lines that are not in the photo
- exaggerated horns
- oversexualized clothing
- unreadable background
- changing the person beyond recognition
- preset combat-role weapons, uniforms, or starting-role identity`;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  try {
    const input = request.body || {};
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

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
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

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    console.log("[generate-avatar] received original_photo_url", {
      original_photo_url: input.original_photo_url,
    });
    console.log("[generate-avatar] using OpenAI image model", { model });

    const imageResponse = await fetch(input.original_photo_url);

    if (!imageResponse.ok) {
      return response.status(400).json({ error: "Unable to read uploaded selfie image." });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    const imageFile = await toFile(imageBuffer, "selfie.png", { type: mimeType });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const result = await client.images.edit({
      model,
      image: imageFile,
      prompt: buildPrompt(input),
      size: "1024x1024",
    });

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
        return response.status(500).json({ error: "OpenAI returned an image URL, but it could not be downloaded." });
      }

      binary = Buffer.from(await generatedResponse.arrayBuffer());
    } else {
      return response.status(502).json({ error: "OpenAI did not return an image." });
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
      return response.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage.from("character-portraits").getPublicUrl(portraitPath);
    const portrait_url = data.publicUrl;

    if (!portrait_url) {
      return response.status(500).json({ error: "Supabase did not return a public portrait URL." });
    }

    console.log("[generate-avatar] final portrait_url", {
      portrait_url,
    });

    return response.status(200).json({
      portrait_url,
    });
  } catch (error) {
    console.error("[generate-avatar] failed", {
      message: error instanceof Error ? error.message : "Unable to generate avatar.",
    });

    return response.status(500).json({
      error: error instanceof Error ? error.message : "Unable to generate avatar.",
    });
  }
};
