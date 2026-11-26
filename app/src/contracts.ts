import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  parseAbi,
  type Address,
} from "viem";

export const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "Test BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
    },
  },
  blockExplorers: { default: { name: "BscScan Testnet", url: "https://testnet.bscscan.com" } },
  testnet: true,
});

export const addresses = {
  registry: (import.meta.env.VITE_TESTNET_REGISTRY_ADDRESS || "") as Address,
  share: (import.meta.env.VITE_TESTNET_SHARE_ADDRESS || "") as Address,
  token: (import.meta.env.VITE_TESTNET_TOKEN_ADDRESS || "") as Address,
  redeem: (import.meta.env.VITE_TESTNET_REDEEM_ADDRESS || "") as Address,
};

export const deploymentBlock = BigInt(import.meta.env.VITE_DEPLOY_BLOCK || "0");
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
]);

export const publicClient = createPublicClient({ chain: bscTestnet, transport: http() });

export function getWalletClient(provider: { request: (...args: any[]) => Promise<any> }, account: Address) {
  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: custom(provider),
  });
}
