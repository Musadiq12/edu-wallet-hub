import { readFile, writeFile } from "node:fs/promises";

const configPaths = [".output/server/wrangler.json", "dist/_worker.js/wrangler.json"];
let configPath;
let rawConfig;

for (const candidate of configPaths) {
  try {
    rawConfig = await readFile(candidate, "utf8");
    configPath = candidate;
    break;
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

if (!configPath || !rawConfig) {
  throw new Error("Could not find generated Wrangler config in .output/server or dist/_worker.js.");
}

const config = JSON.parse(rawConfig);

// Enable Workers Cache for public HTML caching on the storefront.
config.cache = { ...(config.cache ?? {}), enabled: true };

// Wrangler preview requires an explicit previews block.
// Nitro output location differs between Worker and Pages build environments.
if (!config.previews || typeof config.previews !== "object" || Array.isArray(config.previews)) {
  config.previews = {};
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
