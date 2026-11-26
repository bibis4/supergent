import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createMetadata, MAX_SUPPLY, STATIC_METADATA_COUNT } from "../metadata.mjs";
import { onRequestGet } from "../functions/nft/[file].js";

const imageUrl = "https://supergent.xyz/nft/share.png";
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root));

for (const directory of ["public/nft/", "dist/nft/"]) {
  const files = await readdir(new URL(directory, root));
  assert.equal(files.filter((file) => /^\d+\.json$/.test(file)).length, STATIC_METADATA_COUNT);
  for (let id = 1; id <= STATIC_METADATA_COUNT; id++) {
    const json = JSON.parse(await read(`${directory}${id}.json`));
    assert.deepEqual(json, createMetadata(id));
    assert.equal(json.name, `Supergent Genesis Share #${id}`);
    assert.equal(json.image, imageUrl);
  }
}

const logo = await read("public/nft/share.png");
assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.deepEqual(await read("dist/nft/share.png"), logo);
assert.deepEqual(await read("public/llms.txt"), await readFile(new URL("../llms.txt", root)));
assert.deepEqual(await read("dist/llms.txt"), await read("public/llms.txt"));

for (const id of [1, 1000, 1001, MAX_SUPPLY]) {
  const response = await onRequestGet({ params: { file: `${id}.json` } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /^application\/json/);
  assert.deepEqual(await response.json(), createMetadata(id));
}
for (const file of ["0.json", "01.json", "-1.json", "1.5.json", "20161.json", "9007199254740992.json", "1.JSON", "bad.json"]) {
  const response = await onRequestGet({ params: { file } });
  assert.equal(response.status, 404, file);
}

let assetRequests = 0;
const imageResponse = await onRequestGet({
  params: { file: "share.png" },
  next: async () => {
    assetRequests++;
    return new Response(logo, { headers: { "Content-Type": "image/png" } });
  },
});
assert.equal(assetRequests, 1);
assert.equal(imageResponse.status, 200);
assert.equal(imageResponse.headers.get("Content-Type"), "image/png");
assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), logo);

for (const id of [0, -1, 1.5, NaN, MAX_SUPPLY + 1]) {
  assert.throws(() => createMetadata(id), RangeError);
}
for (let id = 1; id <= MAX_SUPPLY; id++) assert.equal(createMetadata(id).image, imageUrl);
console.log("PASS: 1,000 public + 1,000 built metadata files; logo copied byte-for-byte; shared guide; future/invalid IDs; static logo routing; image URL for all 20,160 IDs.");
