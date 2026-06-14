const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const assets = path.join(root, "assets");

const filesToCopy = [
  "pwa-icon-192.png",
  "pwa-icon-512.png",
  "apple-touch-icon.png",
  "favicon.png",
];

for (const file of filesToCopy) {
  fs.copyFileSync(path.join(assets, file), path.join(dist, file));
}

const publicAssetFolders = ["InventoryItems", "Chapter1StoryImages", "Enemies", "Abilities"];

for (const folder of publicAssetFolders) {
  const source = path.join(assets, folder);
  const target = path.join(dist, "assets", folder);

  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  }
}

const manifest = {
  name: "Anima Magisterium",
  short_name: "Anima",
  description: "Dark fantasy RPG character creation for Animamagisterium.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#050706",
  theme_color: "#050706",
  icons: [
    {
      src: "/pwa-icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/pwa-icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};

fs.writeFileSync(path.join(dist, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

const indexPath = path.join(dist, "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf8");
const iconTags = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
  '<link rel="icon" type="image/png" sizes="192x192" href="/pwa-icon-192.png" />',
  '<meta name="theme-color" content="#050706" />',
].join("");

if (!indexHtml.includes('rel="manifest"')) {
  indexHtml = indexHtml.replace("</head>", `${iconTags}</head>`);
}

fs.writeFileSync(indexPath, indexHtml);
console.log("Patched web app icons, manifest, and public asset folders.");
