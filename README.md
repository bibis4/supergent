# Supergent

Supergent is an Agent ID-gated Genesis Share project on BNB Chain. This repository contains the smart-contract suite and an original green-on-dark website. The active app remains testnet-only. A separate owner-executed mainnet deployment script is prepared, but has not been broadcast.

## Current status

### Mainnet preparation (not deployed)

Project deployer / owner / proceeds wallet: `0xa1BE4296e6c05E5F6904A565e0a9FdCAB3F8d96e`.
The separate owner-run script is `scripts/deploy-mainnet.ts`. It never loads
dotenv or the testnet signer; Hardhat mainnet is read/verification-only with no
configured accounts. Mainnet redemption must stay closed at launch.
See [owner runbook](docs/mainnet/OWNER-RUNBOOK.md) for exact commands and security
constraints. `npm run mainnet:plan` is offline and does not broadcast.
The mainnet guide is staged in `docs/mainnet/llms.template.txt`; the active app
and `/llms.txt` remain testnet until checklist Phase 3. No mainnet deployment,
funding check, GitHub publication, or Cloudflare deployment is implied.

### Testnet status

- Contracts and tests: implemented; the **10/10** blueprint scenarios pass. `npm test` now includes six deployment guards, for **16/16** total; the isolated mainnet-configuration rehearsal passes **10/10** separately.
- Frontend: built around the approved testnet MVP. It reads chain state after contract addresses are configured.
- Testnet deployment: deployed to BNB Testnet (chain ID 97) and all four contracts verified on BscScan. Contract-level Phase 4 E2E checks passed; live global dashboard counters, activity and leaderboard were checked in Chromium. See [testnet report](deployments/LAPORAN-TESTNET.md).
- Mainnet: disabled in the testnet deployment script and browser UI. The separate owner-only flow above requires explicit authorization and review; no mainnet contracts have been deployed.
- Proceeds wallet: `0xD8720C10593981AE7C31bB34A152b14636cbE533` (testnet only). Paid mint proceeds remain in the share contract until the owner withdraws them.
- Redeem time: closed by default; this testnet instance was opened at timestamp `1` for the authorized redemption QA. No mainnet opening date has been set.

### BNB Testnet deployment

Current testnet signer / contract owner: `0xb1a55710AB91Ff8CA39D457877083E24Aa00D068`.

Final QA state: 2 unique Agent IDs, 11 shares total (10 from the current QA wallet plus 1 from the interrupted initial run), and 1,000 SUPERGENT redeemed. NFT #2 is held by the test buyer; the original mint wallet redeemed it successfully. Threshold pricing was tested using a separate verified `SupergentShareHarness` at `0x36610947e410AaE606dF50d8AdB618Dd692E34B6`, not by creating 1,000 real minters on the active share contract. Rejection scenarios used `eth_call`; browser-wallet signing was not tested.

| Contract | Address | Verified source |
| --- | --- | --- |
| Mock Agent ID registry | `0x77E7F69663C72eD5531394B619019fF1E171613d` | [BscScan Testnet](https://testnet.bscscan.com/address/0x77E7F69663C72eD5531394B619019fF1E171613d#code) |
| Genesis Share | `0xA437bD2Fb00B2548d0EAEcC0F8E0Bf1511742826` | [BscScan Testnet](https://testnet.bscscan.com/address/0xA437bD2Fb00B2548d0EAEcC0F8E0Bf1511742826#code) |
| SUPERGENT token | `0xfE36f2770a4f67E85f9469b9158100d5Fa8aeC2b` | [BscScan Testnet](https://testnet.bscscan.com/address/0xfE36f2770a4f67E85f9469b9158100d5Fa8aeC2b#code) |
| Redeem controller | `0x0Db8Bc17377A9f35eB763994236D581133CBCA2C` | [BscScan Testnet](https://testnet.bscscan.com/address/0x0Db8Bc17377A9f35eB763994236D581133CBCA2C#code) |

Deployment/owner-change transaction hashes and the testnet E2E run report are recorded in `deployments/bscTestnet.json` and `deployments/e2e-bscTestnet.json` when the E2E run completes.

## Stack

- Solidity 0.8.24, OpenZeppelin 5.x, Hardhat
- React, TypeScript, Vite, viem
- Local and BNB Testnet mock Agent ID registry

## Local setup

```bash
npm install
npm --prefix app install
npm run compile
npm test
npm run dev
```

Open the Vite URL shown by the dev server. Without deployed testnet addresses, the site intentionally renders a non-interactive deployment state.

## Testnet deployment

1. Create `.env` from `.env.example` and set `DEPLOYER_PRIVATE_KEY` to a dedicated, disposable testnet-only key. Do not use a wallet with production funds.
2. Fund that address with BNB Testnet faucet funds.
3. Run `npm run deploy:testnet` and record the addresses and block numbers from the output/transactions.
4. Copy `app/.env.example` to `app/.env.local`; enter the returned registry, share, token and redeem addresses plus the SupergentShare deployment block.
5. Restart the Vite dev server. Mint dummy testnet Agent IDs through `MockAgentID.mintDummy(address, handle)` from the deployer account, then connect a wallet holding one of those IDs.

For the already deployed testnet instance, use `npm run test:e2e:testnet` after funding the current owner wallet. The script checks chain ID 97 before it makes any transactions.

The deployment script creates a fresh MockAgentID on BNB Testnet. Mainnet deployment is intentionally not included in this MVP script.

## Security and product notes

- Mainnet Agent ID resolution uses `handleOf(wallet)`, then derives `uint256(keccak256(bytes(handle)))` and verifies `ownerOf(tokenId) == wallet`. This matches SPACE ID's published Agent ID interface and avoids assuming an unpublished `tokenIdOf` function.
- Each Agent ID may mint one free share and up to nine paid shares. Paid shares cost 0.001 BNB while the pre-transaction unique minter count is below 1,000; otherwise 0.002 BNB. Payment overages are refunded.
- A share is transferable, but redemption stays attached to its original wallet. Secondary-market buyers cannot redeem another wallet's share.
- The first 20,160,000 $SUPERGENT can only be minted by the redeem contract. The 840,000 liquidity allocation can be minted once by the token owner. Token hard cap is 21,000,000 with 18 decimals.
- Owner controls are limited to setting the proceeds wallet, redeem contract, base NFT URI, and redeem open timestamp; the owner can also withdraw accumulated mint proceeds to the configured wallet and mint the one-time liquidity allocation.
- The dashboard is a browser-wallet testnet tool for status checks/manual testing. Binance Agentic Wallet is not assumed to support browser dApp connections. AI agents can use the plain-text instructions in [`llms.txt`](./llms.txt) and invoke `mint()` directly through their wallet's transaction-call interface.
- The leaderboard is derived from mint logs. Set `VITE_DEPLOY_BLOCK` to the share contract deployment block for a complete post-deployment scan; before that, only a recent block window is available.

## Environment variables

See `.env.example` and `app/.env.example`. Actual `.env` files are ignored by git.
