// Génère les icônes PNG de l'app à partir de mneme.html.
// Prérequis (Mac) : Google Chrome installé, et `sips` (fourni par macOS).
// Usage : npm run icons
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../../public/icons");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(outDir, { recursive: true });

function render(query, file) {
  const url = `file://${join(here, "mneme.html")}${query}`;
  execFileSync(chrome, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=1024,1024",
    "--virtual-time-budget=2000", `--screenshot=${file}`, url,
  ], { stdio: "ignore" });
}

function resize(source, size, name) {
  const target = join(outDir, name);
  copyFileSync(source, target);
  execFileSync("sips", ["-z", String(size), String(size), target], { stdio: "ignore" });
}

const full = join(here, "icon-1024.png");
const safe = join(here, "icon-safe-1024.png");
render("", full);
render("?safe=1", safe);

resize(full, 180, "apple-touch-icon.png"); // iOS : opaque, iOS arrondit lui-même les coins
resize(full, 192, "icon-192.png");
resize(full, 512, "icon-512.png");
resize(full, 64, "favicon-64.png");
resize(safe, 512, "icon-maskable-512.png");
console.log("Icônes générées dans public/icons");
