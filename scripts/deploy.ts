import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const isLocal = network.name === "hardhat";

  let registry: string;
  let registryDeploymentHash: string | null = null;
  if (isLocal) {
    const Mock = await ethers.getContractFactory("MockAgentID");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    registryDeploymentHash = (await mock.deploymentTransaction()?.wait())?.hash ?? null;
    registry = await mock.getAddress();
  } else if (network.name === "bscTestnet") {
    const Mock = await ethers.getContractFactory("MockAgentID");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    registryDeploymentHash = (await mock.deploymentTransaction()?.wait())?.hash ?? null;
    registry = await mock.getAddress();
  } else {
    throw new Error("This deployment script is intentionally limited to local and BNB Testnet. Mainnet requires a separate explicit release process.");
  }

  const proceedsWallet = network.name === "bscTestnet"
    ? ethers.getAddress(process.env.TESTNET_PROCEEDS_WALLET || "0xD8720C10593981AE7C31bB34A152b14636cbE533")
    : ethers.ZeroAddress;

  const Share = await ethers.getContractFactory("SupergentShare");
  const share = await Share.deploy(registry, proceedsWallet, "https://supergent.example/nft/");
  await share.waitForDeployment();
  const shareReceipt = await share.deploymentTransaction()?.wait();

  const Token = await ethers.getContractFactory("SupergentToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenReceipt = await token.deploymentTransaction()?.wait();

  const Redeem = await ethers.getContractFactory("SupergentRedeem");
  const redeem = await Redeem.deploy(await share.getAddress(), await token.getAddress());
  await redeem.waitForDeployment();
  const redeemReceipt = await redeem.deploymentTransaction()?.wait();

  const shareLinkTx = await share.setRedeemContract(await redeem.getAddress());
  const shareLinkReceipt = await shareLinkTx.wait();
  const tokenLinkTx = await token.setRedeemContract(await redeem.getAddress());
  const tokenLinkReceipt = await tokenLinkTx.wait();

  const deployment = {
    network: network.name,
    deployer: deployer.address,
    registry,
    proceedsWallet,
    share: await share.getAddress(),
    token: await token.getAddress(),
    redeem: await redeem.getAddress(),
    shareDeploymentBlock: shareReceipt?.blockNumber ?? null,
    transactions: {
      mockRegistryDeployment: registryDeploymentHash,
      shareDeployment: shareReceipt?.hash ?? null,
      tokenDeployment: tokenReceipt?.hash ?? null,
      redeemDeployment: redeemReceipt?.hash ?? null,
      shareRedeemLink: shareLinkReceipt?.hash ?? null,
      tokenRedeemLink: tokenLinkReceipt?.hash ?? null,
    },
  };

  await mkdir(join(process.cwd(), "deployments"), { recursive: true });
  await writeFile(
    join(process.cwd(), "deployments", `${network.name}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
