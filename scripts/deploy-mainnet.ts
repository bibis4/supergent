// OWNER-EXECUTED ONLY. Deliberately does not import Hardhat or dotenv.
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface, emitKeypressEvents } from "node:readline";
import {
  Contract, ContractFactory, JsonRpcProvider, Wallet, getCreateAddress,
  keccak256, formatEther, MaxUint256, TransactionRequest,
} from "ethers";
import { MAINNET, assertMainnetConfig } from "../config/mainnet";

const root = resolve(__dirname, "..");
const recordPath = resolve(root, "deployments/bscMainnet.json");
const contractNames = ["SupergentShare", "SupergentToken", "SupergentRedeem"] as const;
type Step = { request: { to: string | null; data: string; nonce: number }; hash?: string; address?: string };
type RecordFile = {
  version: 1; chainId: 56; registry: string; projectWallet: string;
  baseURI: string; artifactHashes: string[]; steps: Record<string, Step>;
  status: "in-progress" | "complete"; updatedAt: string;
};

export function deploymentPlan() {
  assertMainnetConfig(MAINNET);
  return {
    network: "BNB Smart Chain MAINNET", chainId: 56,
    registry: MAINNET.registry, deployer: MAINNET.projectWallet,
    owner: MAINNET.projectWallet, proceedsWallet: MAINNET.projectWallet,
    redeemOpenTime: MAINNET.redeemOpenTime.toString(),
    redemption: "CLOSED; no opening date set",
    baseURI: MAINNET.baseURI,
    transactions: ["Deploy SupergentShare", "Deploy SupergentToken", "Deploy SupergentRedeem",
      "SupergentShare.setRedeemContract", "SupergentToken.setRedeemContract"],
    excluded: ["Mock registry", "QA harness", "Liquidity mint", "Redeem opening", "Withdrawals", "Smoke-test mints"],
  };
}

// No echo, no env/file fallback. The owner types the key only in THEIR terminal.
// This function must never be invoked by an agent, recording terminal, or CI.
async function readSecret(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Interactive terminal required.");
  process.stdout.write("Private key (hidden; owner only; Ctrl+C cancels): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolveKey, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") { value = ""; cleanup(); reject(new Error("Cancelled.")); return; }
      if (key.name === "return" || key.name === "enter") { cleanup(); resolveKey(value); value = ""; return; }
      if (key.name === "backspace") { value = value.slice(0, -1); return; }
      if (text && /^[0-9a-fAx]+$/.test(text)) value += text;
    };
    process.stdin.on("keypress", onKey);
  });
}

async function confirmOwner() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Owner terminal required.");
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(done => reader.question(
    "Owner only: type DEPLOY SUPERGENT MAINNET to authorize these five transactions: ", done));
  reader.close();
  if (answer !== "DEPLOY SUPERGENT MAINNET") throw new Error("Not authorized.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--plan", "--broadcast"].includes(args[0])) {
    throw new Error("Use exactly --plan or --broadcast.");
  }
  console.log(JSON.stringify(deploymentPlan(), null, 2));
  if (args[0] === "--plan") return; // Offline. No RPC, secret, or transaction.

  // Require a terminal BEFORE any signing path. Never use DEPLOYER_PRIVATE_KEY.
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Owner terminal required.");
  const provider = new JsonRpcProvider(process.env.SUPERGENT_MAINNET_RPC_URL || "https://bsc-dataseed.bnbchain.org");
  try {
    assertMainnetConfig({ ...MAINNET, chainId: (await provider.getNetwork()).chainId });
    if (await provider.getCode(MAINNET.registry) === "0x") throw new Error("Registry code missing.");
    const artifacts = await Promise.all(contractNames.map(async name => JSON.parse(await readFile(
      resolve(root, `artifacts/contracts/${name}.sol/${name}.json`), "utf8"))));
    const hashes = artifacts.map(a => keccak256(a.bytecode));
    let record: RecordFile;
    try {
      record = JSON.parse(await readFile(recordPath, "utf8"));
      assertMainnetConfig({ chainId: BigInt(record.chainId), registry: record.registry,
        projectWallet: record.projectWallet, redeemOpenTime: MAINNET.redeemOpenTime });
      if (record.version !== 1 || record.baseURI !== MAINNET.baseURI
        || JSON.stringify(record.artifactHashes) !== JSON.stringify(hashes)) throw new Error("Record mismatch.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      record = { version: 1, chainId: 56, registry: MAINNET.registry, projectWallet: MAINNET.projectWallet,
        baseURI: MAINNET.baseURI, artifactHashes: hashes, steps: {}, status: "in-progress", updatedAt: "" };
    }
    console.log(`Project balance: ${formatEther(await provider.getBalance(MAINNET.projectWallet))} BNB`);
    console.log("Never paste the key in chat, .env, a command argument, or an agent-controlled terminal.");
    await confirmOwner();
    let secret = await readSecret();
    const signer = new Wallet(secret, provider);
    secret = ""; // JS memory is not securely erasable; exit this process after completion.
    if (signer.address !== MAINNET.projectWallet) throw new Error("Signer mismatch.");
    const save = async () => {
      record.updatedAt = new Date().toISOString();
      await mkdir(resolve(root, "deployments"), { recursive: true });
      await writeFile(recordPath + ".tmp", JSON.stringify(record, null, 2) + "\n", { flag: "w" });
      await rename(recordPath + ".tmp", recordPath);
    };

    const send = async (name: string, request: TransactionRequest) => {
      assertMainnetConfig({ ...MAINNET, chainId: BigInt(await provider.send("eth_chainId", [])) });
      const expected = { to: request.to ? String(request.to) : null, data: String(request.data) };
      let step = record.steps[name];
      if (step) {
        if (step.request.to !== expected.to || step.request.data !== expected.data || !step.hash) {
          throw new Error("Ambiguous or mismatched checkpoint; reconcile manually, NEVER resend blindly.");
        }
      } else {
        const latest = await provider.getTransactionCount(signer.address, "latest");
        const pending = await provider.getTransactionCount(signer.address, "pending");
        if (latest !== pending) throw new Error("Unrelated pending transaction; stop and reconcile.");
        step = { request: { ...expected, nonce: pending } };
        record.steps[name] = step;
        await save(); // Intent saved BEFORE send. Missing hash after interruption requires manual reconciliation.
        const tx = await signer.sendTransaction({ ...request, value: 0n, nonce: pending });
        step.hash = tx.hash;
        await save();
      }
      console.log(`${name}: https://bscscan.com/tx/${step.hash}`);
      const tx = await provider.getTransaction(step.hash!);
      if (!tx || tx.from !== MAINNET.projectWallet || tx.to !== expected.to
        || tx.data !== expected.data || tx.value !== 0n || tx.nonce !== step.request.nonce || tx.chainId !== 56n) {
        throw new Error("On-chain transaction mismatch.");
      }
      const receipt = await tx.wait(2);
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed.");
      if (!expected.to) {
        const predicted = getCreateAddress({ from: MAINNET.projectWallet, nonce: tx.nonce });
        if (receipt.contractAddress !== predicted || await provider.getCode(predicted) === "0x") {
          throw new Error("Deployment address/code mismatch.");
        }
        step.address = predicted;
      }
      await save();
      return step;
    };

    const shareFactory = new ContractFactory(artifacts[0].abi, artifacts[0].bytecode, signer);
    const shareStep = await send("share", await shareFactory.getDeployTransaction(MAINNET.registry, MAINNET.projectWallet, MAINNET.baseURI));
    const tokenFactory = new ContractFactory(artifacts[1].abi, artifacts[1].bytecode, signer);
    const tokenStep = await send("token", await tokenFactory.getDeployTransaction());
    const redeemFactory = new ContractFactory(artifacts[2].abi, artifacts[2].bytecode, signer);
    const redeemStep = await send("redeem", await redeemFactory.getDeployTransaction(shareStep.address!, tokenStep.address!));
    const share = new Contract(shareStep.address!, artifacts[0].abi, provider);
    const token = new Contract(tokenStep.address!, artifacts[1].abi, provider);
    const redeem = new Contract(redeemStep.address!, artifacts[2].abi, provider);

    const validate = async () => {
      for (const c of [share, token, redeem]) if (await c.owner() !== MAINNET.projectWallet) throw new Error("Wrong owner.");
      if (await share.registry() !== MAINNET.registry || await share.proceedsWallet() !== MAINNET.projectWallet
        || await redeem.share() !== shareStep.address || await redeem.token() !== tokenStep.address
        || await redeem.redeemOpenTime() !== MaxUint256 || await redeem.isOpen()) throw new Error("Unsafe initial state.");
      const checks: Array<[Promise<bigint>, bigint]> = [
        [share.MAX_SUPPLY(), 20160n], [share.MAX_PER_AGENT_ID(), 10n], [share.EARLY_BIRD_LIMIT(), 1000n],
        [share.PRICE_EARLY(), 1000000000000000n], [share.PRICE_FLAT(), 2000000000000000n],
        [token.cap(), 21000000n * 10n ** 18n], [token.decimals(), 18n],
        [token.REDEEM_ALLOCATION(), 20160000n * 10n ** 18n], [token.LIQUIDITY_ALLOCATION(), 840000n * 10n ** 18n],
        [redeem.REWARD_PER_NFT(), 1000n * 10n ** 18n],
      ];
      for (const [value, expected] of checks) if (await value !== expected) throw new Error("Blueprint parameter mismatch.");
      if (await token.liquidityMinted()) throw new Error("Unexpected liquidity mint.");
    };
    await validate();
    for (const [name, c] of [["shareLink", share], ["tokenLink", token]] as const) {
      const linked = await c.redeemContract();
      if (linked !== "0x0000000000000000000000000000000000000000" && linked !== redeemStep.address) {
        throw new Error("Unexpected redeem linkage.");
      }
      if (linked === redeemStep.address && !record.steps[name]) {
        throw new Error("Link already exists without a recorded transaction; reconcile manually.");
      }
      await send(name, { to: await c.getAddress(), data: c.interface.encodeFunctionData("setRedeemContract", [redeemStep.address]) });
    }
    await validate();
    if (await share.redeemContract() !== redeemStep.address || await token.redeemContract() !== redeemStep.address) {
      throw new Error("Link verification failed.");
    }
    record.status = "complete";
    await save();
    console.log("Five transactions verified. Redemption CLOSED. Public record: deployments/bscMainnet.json");
    console.log(`Share: ${shareStep.address}\nToken: ${tokenStep.address}\nRedeem: ${redeemStep.address}`);
  } finally {
    provider.destroy();
  }
}

if (require.main === module) main().catch(() => {
  // NEVER print provider/Wallet errors: they can include sensitive request material.
  console.error("Deployment stopped safely. Do not delete the public checkpoint or resend blindly. No raw error is logged.");
  process.exitCode = 1;
});
