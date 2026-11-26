import { createMetadata, MAX_SUPPLY } from "../../metadata.mjs";

// Cloudflare Pages route also serves future IDs 1001..20160, beyond static files.
// No RPC, signing, private key, or external service is required.
export function onRequestGet({ params, next }) {
  // This route also matches the logo; let Pages serve its static public asset.
  if (params.file === "share.png") return next();
  const match = /^([1-9]\d*)\.json$/.exec(String(params.file));
  const id = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_SUPPLY) {
    return new Response("Metadata not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(JSON.stringify(createMetadata(id), null, 2) + "\n", {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
