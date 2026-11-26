import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  fallback,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnetConfig } from "./mainnet-config";

export const bscMainnet = defineChain({
  id: mainnetConfig.chainId,
  name: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [mainnetConfig.rpcUrl, mainnetConfig.fallbackRpcUrl],
    },
  },
  blockExplorers: { default: { name: "BscScan", url: mainnetConfig.explorerUrl } },
});

export const addresses = {
  registry: mainnetConfig.registry as Address,
  share: mainnetConfig.share as Address,
  token: mainnetConfig.token as Address,
  redeem: mainnetConfig.redeem as Address,
};

export const deploymentBlock = mainnetConfig.shareDeploymentBlock;
export const contractsReady = Boolean(addresses.registry && addresses.share && addresses.token && addresses.redeem);

export const registryAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function handleOf(address owner) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

export const shareAbi = parseAbi([
  "function MAX_SUPPLY() view returns (uint256)",
  "function MAX_PER_AGENT_ID() view returns (uint256)",
  "function EARLY_BIRD_LIMIT() view returns (uint256)",
  "function PRICE_EARLY() view returns (uint256)",
  "function PRICE_FLAT() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function uniqueMinterCount() view returns (uint256)",
  "function mintedCount(uint256 agentId) view returns (uint256)",
  "function priceNextShare(uint256 agentId) view returns (uint256)",
  "function redeemedCount(uint256 agentId) view returns (uint256)",
  "function originAgentId(uint256 tokenId) view returns (uint256)",
  "function originWallet(uint256 tokenId) view returns (address)",
  "function redeemed(uint256 tokenId) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function shareTokenIds(uint256 agentId) view returns (uint256[])",
  "function mint() payable returns (uint256 tokenId)",
  "event ShareMinted(uint256 indexed agentId, uint256 indexed tokenId, address indexed wallet, uint256 price)",
]);

export const redeemAbi = parseAbi([
  "function redeemOpenTime() view returns (uint256)",
  "function isOpen() view returns (bool)",
  "function redeem(uint256 tokenId)",
]);

export const tokenAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function redeemedSupply() view returns (uint256)",
]);

export const publicClient = createPublicClient({
  chain: bscMainnet,
  transport: fallback([http(mainnetConfig.rpcUrl), http(mainnetConfig.fallbackRpcUrl)]),
});

export function getWalletClient(provider: { request: (...args: any[]) => Promise<any> }, account: Address) {
  return createWalletClient({
    account,
    chain: bscMainnet,
    transport: custom(provider),
  });
}
