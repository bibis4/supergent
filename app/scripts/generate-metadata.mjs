import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createMetadata, STATIC_METADATA_COUNT } from "../metadata.mjs";

const directory = fileURLToPath(new URL("../public/nft/", import.meta.url));
const logo = await readFile(new URL("../public/nft/share.png", import.meta.url));
if (logo.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  throw new Error("The owner-supplied public/nft/share.png must be a valid PNG.");
}
await mkdir(directory, { recursive: true });
for (let id = 1; id <= STATIC_METADATA_COUNT; id++) {
  await writeFile(`${directory}/${id}.json`, JSON.stringify(createMetadata(id), null, 2) + "\n");
}
console.log(`Generated ${STATIC_METADATA_COUNT} static ERC-721 metadata files in public/nft/.`);
