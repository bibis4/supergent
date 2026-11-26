import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import type { Interface } from "ethers";

type Deployment = {
  network: string;
  deployer: string;
  registry: string;
  proceedsWallet: string;
  share: string;
  token: string;
  redeem: string;
  shareDeploymentBlock: number;
};

async function main() {
  if (network.name !== "bscTestnet") {
    throw new Error("E2E script only runs on BNB Testnet.");
  }

  const deploymentPath = join(process.cwd(), "deployments", "bscTestnet.json");
  const deployment = JSON.parse(await readFile(deploymentPath, "utf8")) as Deployment;
  if (deployment.network !== "bscTestnet") throw new Error("Deployment config is not for BNB Testnet.");

  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 97n) throw new Error(`Expected BNB Testnet chain ID 97; got ${chain.chainId}.`);

  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== deployment.deployer.toLowerCase()) {
    throw new Error("Configured deployer does not match the recorded testnet deployment owner.");
  }

  const registry = await ethers.getContractAt("MockAgentID", deployment.registry, deployer);
  const share = await ethers.getContractAt("SupergentShare", deployment.share, deployer);
  const token = await ethers.getContractAt("SupergentToken", deployment.token, deployer);
  const redeem = await ethers.getContractAt("SupergentRedeem", deployment.redeem, deployer);
  const checkpointPath = join(process.cwd(), "deployments", "e2e-bscTestnet-progress.json");
  let results: Array<Record<string, unknown>> = [];
  try {
    const previous = JSON.parse(await readFile(checkpointPath, "utf8"));
    if (previous.deployer?.toLowerCase() === deployer.address.toLowerCase()
      && previous.share?.toLowerCase() === deployment.share.toLowerCase()) results = previous.scenarios;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const record = async (scenario: string, status: string, details: Record<string, unknown> = {}) => {
    const entry = { scenario, status, ...details };
    const existing = results.findIndex((item) => item.scenario === scenario);
    if (existing < 0) results.push(entry); else results[existing] = entry;
    await writeFile(checkpointPath, `${JSON.stringify({
      network: "bscTestnet", chainId: 97, deployer: deployer.address,
      share: deployment.share, updatedAt: new Date().toISOString(), scenarios: results,
    }, null, 2)}\n`, "utf8");
  };
  const send = async (scenario: string, tx: Promise<any>) => {
    console.log(`[E2E] ${scenario}`);
    const response = await tx;
    const receipt = await response.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${scenario} did not succeed.`);
    await record(scenario, "PASS", { txHash: receipt.hash, blockNumber: receipt.blockNumber });
    return receipt;
  };
  const expectCustomError = async (scenario: string, iface: Interface, call: () => Promise<unknown>, expected: string) => {
    console.log(`[E2E] ${scenario}`);
    try {
      await call();
    } catch (error) {
      const actual = parseCustomError(iface, error);
      if (actual !== expected) throw new Error(`${scenario}: expected ${expected}; received ${actual ?? "unknown revert"}.`);
      await record(scenario, "PASS", { expectedRevert: actual, method: "eth_call (no transaction broadcast)" });
      return;
    }
    throw new Error(`${scenario}: expected ${expected}, but call succeeded.`);
  };

  let handle = `sg-e2e-${Date.now().toString(36)}`;
  const priorBalance = await registry.balanceOf(deployer.address);
  if (priorBalance === 0n) {
    await send("Mint test Agent ID", registry.mintDummy(deployer.address, handle));
  } else if (priorBalance !== 1n) {
    throw new Error("Unexpected number of Agent IDs on the deployment wallet.");
  } else {
    handle = await registry.handleOf(deployer.address);
    await record("Reuse test Agent ID from interrupted E2E attempt", "PASS", { handle });
  }
  const resolvedHandle = await registry.handleOf(deployer.address);
  const agentId = BigInt(ethers.keccak256(ethers.toUtf8Bytes(resolvedHandle)));
  const alreadyMinted = await share.mintedCount(agentId);
  const startingTotalMinted = (await share.totalMinted()) - alreadyMinted;
  const startingUniqueMinters = (await share.uniqueMinterCount()) - (alreadyMinted > 0n ? 1n : 0n);
  const startingTokenSupply = (await token.totalSupply()) - (await share.redeemedCount(agentId)) * ethers.parseEther("1000");

  if (alreadyMinted === 0n) {
    const freePrice = await share.priceNextShare(agentId);
    if (freePrice !== 0n) throw new Error(`First mint was not free: got ${freePrice}.`);
    await send("First share free mint", share.mint({ value: 0n }));
  } else {
    const tokenIds = await share.shareTokenIds(agentId);
    if (alreadyMinted > 10n || !tokenIds.length
      || (await share.originWallet(tokenIds[0])).toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("Existing test state cannot be safely resumed.");
    }
    const freeTokenId = tokenIds[0];
    const topic = share.interface.getEvent("ShareMinted")!.topicHash;
    const latestBlock = await ethers.provider.getBlockNumber();
    const logs = await readLogsInChunks({
      address: deployment.share,
      fromBlock: ethers.toQuantity(deployment.shareDeploymentBlock),
      toBlock: ethers.toQuantity(latestBlock),
      topics: [
        topic,
        ethers.zeroPadValue(ethers.toBeHex(agentId), 32),
        ethers.zeroPadValue(ethers.toBeHex(freeTokenId), 32),
      ],
    });
    const freeMintLog = logs.find((log: any) => share.interface.parseLog(log)?.args.price === 0n);
    if (!freeMintLog) throw new Error("Unable to confirm the first free mint event.");
    await record("First share free mint (confirmed from interrupted run)", "PASS", {
      txHash: freeMintLog.transactionHash,
      blockNumber: Number(BigInt(freeMintLog.blockNumber)),
    });
    if (alreadyMinted >= 2n) {
      const paidLogs = await readLogsInChunks({
        address: deployment.share,
        fromBlock: ethers.toQuantity(deployment.shareDeploymentBlock),
        toBlock: ethers.toQuantity(latestBlock),
        topics: [topic, ethers.zeroPadValue(ethers.toBeHex(agentId), 32)],
      });
      for (const log of paidLogs) {
        const parsed = share.interface.parseLog(log);
        if (parsed?.args.price !== ethers.parseEther("0.001")) continue;
        await record(`Paid share #${parsed.args.tokenId} (confirmed from interrupted run)`, "PASS", {
          txHash: log.transactionHash, blockNumber: Number(BigInt(log.blockNumber)),
          priceWei: parsed.args.price.toString(),
        });
      }
    }
  }
  const paidPrice = await share.priceNextShare(agentId);
  if (alreadyMinted < 2n) {
    if (paidPrice !== ethers.parseEther("0.001")) throw new Error(`Second mint price is not 0.001 BNB: got ${paidPrice}; expected ${ethers.parseEther("0.001")}.`);
    await send("Second share paid mint (0.001 BNB)", share.mint({ value: paidPrice }));
  }

  for (let shareNumber = Number(alreadyMinted < 2n ? 3n : alreadyMinted + 1n); shareNumber <= 10; shareNumber++) {
    const price = await share.priceNextShare(agentId);
    if (price !== ethers.parseEther("0.001")) throw new Error(`Unexpected price for share ${shareNumber}.`);
    await send(`Share ${shareNumber} paid mint`, share.mint({ value: price }));
  }

  const actualMintCount = await share.mintedCount(agentId);
  if (actualMintCount !== 10n) throw new Error(`Expected 10 shares; got ${actualMintCount}.`);
  await expectCustomError(
    "11th mint for the same Agent ID reverts",
    share.interface,
    () => share.mint.staticCall({ value: ethers.parseEther("0.001") }),
    "AgentShareLimitReached",
  );

  const noIdWallet = new ethers.VoidSigner("0x000000000000000000000000000000000000b0b1", ethers.provider);
  await expectCustomError(
    "Wallet without Agent ID cannot mint",
    share.interface,
    () => share.connect(noIdWallet).mint.staticCall({ value: 0n }),
    "NoAgentId",
  );

  const Harness = await ethers.getContractFactory("SupergentShareHarness", deployer);
  const priorHarness = results.find((item) => item.scenario === "Deploy isolated test-only threshold harness");
  let harness;
  if (priorHarness?.address) {
    harness = await ethers.getContractAt("SupergentShareHarness", String(priorHarness.address), deployer);
  } else {
    harness = await Harness.deploy(deployment.registry);
    await harness.waitForDeployment();
    const harnessDeployment = await harness.deploymentTransaction()?.wait();
    if (!harnessDeployment || harnessDeployment.status !== 1) throw new Error("QA threshold harness deployment failed.");
    await record("Deploy isolated test-only threshold harness", "PASS", {
      address: await harness.getAddress(), txHash: harnessDeployment.hash, blockNumber: harnessDeployment.blockNumber,
    });
  }
  const thresholdDone = results.some((item) => item.scenario === "QA paid mint at 1,000 unique minters (0.002 BNB)" && item.status === "PASS");
  if (!thresholdDone) {
  await send("Set QA threshold just below 1,000 unique minters", harness.seedAgentState(agentId, 1, 999, 1000));
  const beforeThresholdPrice = await harness.priceNextShare(agentId);
  if (beforeThresholdPrice !== ethers.parseEther("0.001")) throw new Error("QA harness did not report 0.001 BNB below threshold.");
  await record("QA threshold price below 1,000", "PASS", { paidSharePriceWei: beforeThresholdPrice.toString() });
  await send("Set QA threshold at 1,000 unique minters", harness.seedAgentState(agentId, 1, 1000, 1001));
  const thresholdPrice = await harness.priceNextShare(agentId);
  if (thresholdPrice !== ethers.parseEther("0.002")) throw new Error("QA harness did not report 0.002 BNB at threshold.");
  await record("QA threshold price at 1,000", "PASS", { paidSharePriceWei: thresholdPrice.toString() });
  await send("QA paid mint at 1,000 unique minters (0.002 BNB)", harness.mint({ value: thresholdPrice }));
  }

  const wasClosed = !(await redeem.isOpen());
  if (!wasClosed && !results.some((item) => item.scenario === "Redeem before open time reverts" && item.status === "PASS")) {
    throw new Error("Redeem unexpectedly open with no recorded closed-window test.");
  }
  const tokenIdsForAgent = await share.shareTokenIds(agentId);
  const redeemTokenId = tokenIdsForAgent[0];
  if (wasClosed) await expectCustomError(
    "Redeem before open time reverts",
    redeem.interface,
    () => redeem.redeem.staticCall(redeemTokenId),
    "RedeemNotOpen",
  );
  const buyer = "0x000000000000000000000000000000000000b0b0";
  if ((await share.ownerOf(redeemTokenId)).toLowerCase() !== buyer.toLowerCase()) {
    await send(`Transfer share #${redeemTokenId} to test buyer`, share.transferFrom(deployer.address, buyer, redeemTokenId));
  }
  if (wasClosed) await send("Open testnet redeem window at past timestamp", redeem.setRedeemOpenTime(1n));
  if (!(await redeem.isOpen())) throw new Error("Redeem did not open after the test timestamp was set.");
  await expectCustomError(
    "Buyer who received the NFT cannot redeem",
    share.interface,
    () => redeem.connect(new ethers.VoidSigner(buyer, ethers.provider)).redeem.staticCall(redeemTokenId),
    "NotOriginWallet",
  );
  if (!(await share.redeemed(redeemTokenId))) {
    await send(`Original mint wallet redeems transferred share #${redeemTokenId}`, redeem.redeem(redeemTokenId));
  }
  const received = await token.balanceOf(deployer.address);
  if (received !== ethers.parseEther("1000")) throw new Error(`Expected exactly 1,000 SUPERGENT; got ${received}.`);
  await expectCustomError(
    "Redeeming the same share twice reverts",
    share.interface,
    () => redeem.redeem.staticCall(redeemTokenId),
    "TokenAlreadyRedeemed",
  );

  const dashboard = {
    chainId: Number(chain.chainId),
    agentHandle: resolvedHandle,
    uniqueMinterCount: (await share.uniqueMinterCount()).toString(),
    totalMinted: (await share.totalMinted()).toString(),
    agentMinted: (await share.mintedCount(agentId)).toString(),
    tokenSupply: (await token.totalSupply()).toString(),
    originWalletTokenBalance: received.toString(),
    redeemOpen: await redeem.isOpen(),
    redeemOpenTime: (await redeem.redeemOpenTime()).toString(),
  };
  if (BigInt(dashboard.uniqueMinterCount) !== startingUniqueMinters + 1n
    || BigInt(dashboard.totalMinted) !== startingTotalMinted + 10n
    || dashboard.agentMinted !== "10") {
    throw new Error("Dashboard counters do not match the production testnet contract state.");
  }
  if (BigInt(dashboard.tokenSupply) !== startingTokenSupply + ethers.parseEther("1000")) {
    throw new Error("Dashboard token supply does not match the redemption result.");
  }
  await record("Contract values match E2E expectations (browser verification separate)", "PASS", { values: dashboard });

  const report = {
    network: "BNB Testnet",
    chainId: Number(chain.chainId),
    deployer: deployer.address,
    share: deployment.share,
    harness: await harness.getAddress(),
    testnetOnly: true,
    scenarios: results,
    finalDashboardState: dashboard,
  };
  await mkdir(join(process.cwd(), "deployments"), { recursive: true });
  await writeFile(join(process.cwd(), "deployments", "e2e-bscTestnet.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

async function readLogsInChunks(filter: { address: string; fromBlock: string; toBlock: string; topics: string[] }) {
  const logs: any[] = [];
  const last = Number(BigInt(filter.toBlock));
  for (let first = Number(BigInt(filter.fromBlock)); first <= last; first += 40_000) {
    logs.push(...await ethers.provider.send("eth_getLogs", [{
      ...filter, fromBlock: ethers.toQuantity(first), toBlock: ethers.toQuantity(Math.min(first + 39_999, last)),
    }]));
  }
  return logs;
}

function parseCustomError(iface: Interface, error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { data?: string; info?: { error?: { data?: string } }; error?: { data?: string } };
  const data = e.data ?? e.info?.error?.data ?? e.error?.data;
  if (!data) return null;
  try {
    return iface.parseError(data)?.name ?? null;
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Testnet E2E failed.");
  process.exitCode = 1;
});
