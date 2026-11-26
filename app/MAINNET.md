# Supergent mainnet website

## Public configuration

`src/mainnet-config.ts` pins chain ID 56, the official registry, all three
deployment addresses, public RPCs, the receipt-verified Share deployment block,
and the owner's redemption target. No Cloudflare environment variables, secrets,
wallet credentials, or ignored local files are needed for the website build.

The legacy local `VITE_*` variable names are retained for compatibility, but
contract/network selection comes from the versioned config so local overrides
cannot silently select another network. Never expose server secrets with VITE_.

## Cloudflare Pages (Git integration)

- Branch: `main`.
- Root directory: `app`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Use Node.js 20 or later.
- Pages Functions directory: `app/functions` (relative to repo), i.e. `functions`
  within the selected Pages root. Deploy through Pages Git integration so Functions
  are bundled too; uploading only dist assets omits the dynamic metadata route.
- Attach custom domains `supergent.xyz` and `www.supergent.xyz` in Pages settings.

This file records deployment settings, not proof of a successful live deployment.
Pushes can trigger Pages only if the owner has already connected this Git repo.

## NFT metadata

`npm run metadata` deterministically creates `public/nft/1.json` through
`public/nft/1000.json`; Vite copies them to `dist/nft/` at build time. Static
metadata is committed so existing and near-future IDs have public files.
Every JSON uses `https://supergent.xyz/nft/share.png` as its `image`. The owner's
supplied logo is preserved at full resolution as `public/nft/share.png` (converted
from JPEG to PNG without cropping or redesign), and copied to `dist/nft/share.png`.
The metadata Function passes the logo request through to this static asset.
`functions/nft/[file].js` uses the same template and serves valid IDs up to the
collection cap (20,160), including future IDs beyond the static batch. Invalid IDs
return 404. Metadata availability does not assert an NFT exists: ownerOf is the
source of truth. Redeemed status must always be read from the contract, not JSON.

## Redemption date versus on-chain state

All displayed dates use **7 Dec 2026, 12:00 UTC**, timestamp `1796644800`.
The site reads `redeemOpenTime()` and `isOpen()` on mainnet. If the owner has not
configured this time, the countdown is clearly marked as a target, not an on-chain
schedule. Reaching zero never enables the redeem button; the controller must
actually report open. This website release does not change on-chain settings.

## Local build

Run commands inside `app`, not the root Hardhat build. Vite reads only app's env
directory; this frontend task never needs the project root `.env`.

```powershell
npm run build
npm run lint
npm run test:metadata
```
