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

const ancestryGuidance = {
  Human: "realistic human adventurer, grounded and believable",
  Elf: "elegant forest-blooded ancestry, subtle pointed ears, graceful features",
  Dwarf: "sturdy mountain-blooded ancestry, strong build, practical ornamental gear",
  Woodkin: "nature-attuned, bark/leather textures, forest influence, no cartoon features",
  Drakesoul: "dragon-blooded presence, subtle scale accents, powerful aura, no oversized horns",
  Stoneborn: "earth and mountain influence, grounded features, stone-like ornamental motifs",
  "Fae-Touched": "ethereal magical ancestry, elegant otherworldly presence, subtle glow",
  Aetherborn: "infused with blue arcane energy, mystical markings, refined magical presence",
};

function validateInput(input) {
  const requiredFields = ["original_photo_url", "gender", "ancestry", "homeland", "origin", "path", "trait"];
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

Apply:
- dark fantasy realism
- bronze and gold ornamental detailing
- deep blue magical crystal energy
- cinematic lighting
- premium RPG character portrait style
- modern real life blended with epic fantasy

Character choices:
- Gender: ${input.gender}
- Ancestry: ${input.ancestry}
- Homeland: ${input.homeland}
- Origin: ${input.origin}
- Path: ${input.path}
- Trait: ${input.trait}

Ancestry guidance:
${ancestryGuidance[input.ancestry] || ancestryGuidance.Human}

Avoid:
- copyrighted D&D settings, names, monsters, or lore
- cartoon style
- anime style
- distorted face
- exaggerated horns
- oversexualized clothing
- unreadable background
- changing the person beyond recognition`;
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
