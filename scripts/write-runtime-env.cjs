const fs = require("fs");
const path = require("path");

const localEnvPath = path.join(__dirname, "..", ".env.local");

if (fs.existsSync(localEnvPath)) {
  const localEnv = fs.readFileSync(localEnvPath, "utf8");

  for (const line of localEnv.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const targetPath = path.join(__dirname, "..", "src", "lib", "runtimeEnv.generated.ts");
const contents = `export const runtimeEnv = {
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},
};
`;

fs.writeFileSync(targetPath, contents);
console.log(`Wrote ${path.relative(process.cwd(), targetPath)}`);
