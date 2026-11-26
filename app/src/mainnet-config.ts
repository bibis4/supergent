// Public, versioned deployment configuration. Cloudflare builds need no env vars.
// Contract addresses are pinned here; local environment files cannot replace them.
export const mainnetConfig = Object.freeze({
  chainId: 56,
  rpcUrl: "https://bsc-rpc.publicnode.com",
  fallbackRpcUrl: "https://bsc-dataseed.bnbchain.org",
  explorerUrl: "https://bscscan.com",
  registry: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
  share: "0xa17f18082ffAE73dd713A9972e3De451889FFBE0",
  token: "0xA59aB05EC4d7425Ded49F9bEe2571651E1C067c0",
  redeem: "0x1B429cc63082E0063Ce35E5D1c2BC3183B1F12e1",
  shareDeploymentBlock: 135854340n,
  plannedRedeemOpenTime: 1796644800n,
  redeemDateLabel: "7 Dec 2026, 12:00 UTC",
} as const);
