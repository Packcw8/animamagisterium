const OpenAI = require("openai").default;
const { toFile } = require("openai");

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

    if (!input.imageUrl) {
      return response.status(400).json({ error: "imageUrl is required." });
    }

    const imageResponse = await fetch(input.imageUrl);

    if (!imageResponse.ok) {
      return response.status(400).json({ error: "Unable to read uploaded selfie image." });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    const imageFile = await toFile(imageBuffer, "selfie.png", { type: mimeType });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: buildPrompt(input),
      size: "1024x1024",
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return response.status(502).json({ error: "OpenAI did not return an image." });
    }

    return response.status(200).json({
      imageBase64,
      mimeType: "image/png",
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Unable to generate avatar.",
    });
  }
};
