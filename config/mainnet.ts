import { getAddress, MaxUint256 } from "ethers";

// Public configuration only. Never add a private key or load dotenv here.
export const MAINNET = Object.freeze({
  chainId: 56n,
  registry: getAddress("0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"),
  projectWallet: getAddress("0xa1BE4296e6c05E5F6904A565e0a9FdCAB3F8d96e"),
  baseURI: "https://supergent.xyz/nft/",
  redeemOpenTime: MaxUint256,
});

export function assertMainnetConfig(config: {
  chainId: bigint; registry: string; projectWallet: string; redeemOpenTime: bigint;
}) {
  if (config.chainId !== MAINNET.chainId) throw new Error("Expected chain ID 56.");
  if (getAddress(config.registry) !== MAINNET.registry) throw new Error("Unofficial registry rejected.");
  if (getAddress(config.projectWallet) !== MAINNET.projectWallet) throw new Error("Wrong project wallet.");
  if (config.redeemOpenTime !== MaxUint256) throw new Error("Redemption must remain closed without a launch date.");
}
