import { readFile, writeFile } from "node:fs/promises";

const configPath = ".output/server/wrangler.json";
const config = JSON.parse(await readFile(configPath, "utf8"));

// Wrangler preview requires an explicit previews block. Nitro generates this
// file and currently omits the block, so add the empty default after each build.
if (!config.previews || typeof config.previews !== "object" || Array.isArray(config.previews)) {
  config.previews = {};
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
