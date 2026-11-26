import { expect } from "chai";
import { ethers, network } from "hardhat";
import { loadFixture, setCode, setBalance, reset } from "@nomicfoundation/hardhat-network-helpers";
import { MAINNET } from "../config/mainnet";

const mainnetRehearsal = network.name === "hardhat" && network.config.chainId === 56;

async function deployRegistry() {
  const mock = await (await ethers.getContractFactory("MockAgentID")).deploy();
  await mock.waitForDeployment();
  if (!mainnetRehearsal) return mock;
  // LOCAL ONLY: simulate the registry read surface at the configured mainnet address.
  // This is not a fork or a test of the live official registry implementation.
  await setCode(MAINNET.registry, await ethers.provider.getCode(await mock.getAddress()));
  return ethers.getContractAt("MockAgentID", MAINNET.registry);
}

describe("Supergent — blueprint scenarios", function () {
  beforeEach(async function () {
    // Fixed-address registry storage must not leak between independent fixtures.
    if (mainnetRehearsal) await reset();
  });
  async function deploy() {
    let [owner, alice, bob, proceeds] = await ethers.getSigners();
    if (mainnetRehearsal) {
      await setBalance(MAINNET.projectWallet, ethers.parseEther("100"));
      owner = await ethers.getImpersonatedSigner(MAINNET.projectWallet);
      proceeds = owner;
    }
    const registry = await deployRegistry();

    const Share = await ethers.getContractFactory("SupergentShare", owner);
    const share = await Share.deploy(await registry.getAddress(), proceeds.address,
      mainnetRehearsal ? MAINNET.baseURI : "ipfs://supergent/");
    await share.waitForDeployment();

    const Token = await ethers.getContractFactory("SupergentToken", owner);
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Redeem = await ethers.getContractFactory("SupergentRedeem", owner);
    const redeem = await Redeem.deploy(await share.getAddress(), await token.getAddress());
    await redeem.waitForDeployment();

    await share.setRedeemContract(await redeem.getAddress());
    await token.setRedeemContract(await redeem.getAddress());

    return { owner, alice, bob, proceeds, registry, share, token, redeem };
  }

  async function deployHarness() {
    const [owner, alice, bob] = await ethers.getSigners();
    const registry = await deployRegistry();
    const Harness = await ethers.getContractFactory("SupergentShareHarness");
    const share = await Harness.deploy(await registry.getAddress());
    await share.waitForDeployment();
    return { owner, alice, bob, registry, share };
  }

  async function mintAgent(registry: any, wallet: any, handle: string) {
    await registry.mintDummy(wallet.address, handle);
    return BigInt(ethers.keccak256(ethers.toUtf8Bytes(handle)));
  }

  it("1. Agent ID holder's first mint succeeds for zero BNB", async function () {
    const { owner, alice, registry, share, token, redeem } = await loadFixture(deploy);
    expect(await share.MAX_SUPPLY()).to.equal(20_160);
    expect(await share.MAX_PER_AGENT_ID()).to.equal(10);
    expect(await share.EARLY_BIRD_LIMIT()).to.equal(1000);
    expect(await share.PRICE_EARLY()).to.equal(ethers.parseEther("0.001"));
    expect(await share.PRICE_FLAT()).to.equal(ethers.parseEther("0.002"));
    expect(await token.cap()).to.equal(ethers.parseEther("21000000"));
    expect(await token.decimals()).to.equal(18);
    expect(await token.REDEEM_ALLOCATION()).to.equal(ethers.parseEther("20160000"));
    expect(await token.LIQUIDITY_ALLOCATION()).to.equal(ethers.parseEther("840000"));
    expect(await redeem.REWARD_PER_NFT()).to.equal(ethers.parseEther("1000"));
    expect(await redeem.redeemOpenTime()).to.equal(ethers.MaxUint256);
    expect(await redeem.isOpen()).to.equal(false);
    expect(await token.totalSupply()).to.equal(0);
    expect(await token.liquidityMinted()).to.equal(false);
    for (const contract of [share, token, redeem]) expect(await contract.owner()).to.equal(owner.address);
    if (mainnetRehearsal) {
      expect(await share.registry()).to.equal(MAINNET.registry);
      expect(await share.proceedsWallet()).to.equal(MAINNET.projectWallet);
      expect(owner.address).to.equal(MAINNET.projectWallet);
    }
    const agentId = await mintAgent(registry, alice, "alice");
    await expect(share.connect(alice).mint())
      .to.emit(share, "ShareMinted")
      .withArgs(agentId, 1, alice.address, 0);
    expect(await share.mintedCount(agentId)).to.equal(1);
    expect(await share.totalMinted()).to.equal(1);
  });

  it("2. The same Agent ID cannot claim the free share twice", async function () {
    const { alice, registry, share } = await loadFixture(deploy);
    await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();
    await expect(share.connect(alice).mint()).to.be.revertedWithCustomError(share, "WrongPayment");
  });

  it("3. A paid share costs exactly 0.001 BNB before the early-bird threshold", async function () {
    const { alice, registry, share } = await loadFixture(deploy);
    const agentId = await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();

    expect(await share.priceNextShare(agentId)).to.equal(ethers.parseEther("0.001"));
    await expect(share.connect(alice).mint({ value: ethers.parseEther("0.0009") }))
      .to.be.revertedWithCustomError(share, "WrongPayment");
    await expect(share.connect(alice).mint({ value: ethers.parseEther("0.001") }))
      .to.emit(share, "ShareMinted")
      .withArgs(agentId, 2, alice.address, ethers.parseEther("0.001"));
  });

  it("4. Paid price changes to 0.002 BNB at 1,000 unique Agent IDs", async function () {
    const { alice, bob, registry, share } = await loadFixture(deployHarness);
    const aliceId = await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();

    // Test-only harness places the counter at the state immediately before the
    // 1,000th unique Agent ID. The first share remains free and increments it.
    await share.seedCounters(999, 1);
    const bobId = await mintAgent(registry, bob, "bob");
    await share.connect(bob).mint();
    expect(await share.uniqueMinterCount()).to.equal(1000);
    expect(await share.priceNextShare(aliceId)).to.equal(ethers.parseEther("0.002"));
    await expect(share.connect(alice).mint({ value: ethers.parseEther("0.002") }))
      .to.emit(share, "ShareMinted")
      .withArgs(aliceId, 3, alice.address, ethers.parseEther("0.002"));
    expect(await share.mintedCount(bobId)).to.equal(1);
  });

  it("5. A new Agent ID's first share stays free after early bird ends", async function () {
    const { alice, registry, share } = await loadFixture(deployHarness);
    await share.seedCounters(1000, 1000);
    const aliceId = await mintAgent(registry, alice, "alice");
    await expect(share.connect(alice).mint()).to.emit(share, "ShareMinted");
    expect(await share.mintedCount(aliceId)).to.equal(1);
    expect(await share.totalMinted()).to.equal(1001);
    expect(await share.priceNextShare(aliceId)).to.equal(ethers.parseEther("0.002"));
  });

  it("6. The 11th share for one Agent ID reverts", async function () {
    const { alice, registry, share } = await loadFixture(deploy);
    await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();
    for (let shareNumber = 2; shareNumber <= 10; shareNumber++) {
      await share.connect(alice).mint({ value: ethers.parseEther("0.001") });
    }
    await expect(share.connect(alice).mint({ value: ethers.parseEther("0.001") }))
      .to.be.revertedWithCustomError(share, "AgentShareLimitReached");
  });

  it("7. A wallet without an Agent ID cannot mint", async function () {
    const { bob, share } = await loadFixture(deploy);
    await expect(share.connect(bob).mint()).to.be.revertedWithCustomError(share, "NoAgentId");
  });

  it("8. Minting beyond the 20,160 NFT supply reverts", async function () {
    const { alice, registry, share } = await loadFixture(deployHarness);
    await mintAgent(registry, alice, "alice");
    await share.seedCounters(1, 20_160);
    await expect(share.connect(alice).mint()).to.be.revertedWithCustomError(share, "SupplyExhausted");
  });

  it("9. Redeem is blocked before open, for non-origin wallets, and a second time", async function () {
    const { alice, bob, registry, share, redeem } = await loadFixture(deploy);
    await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();
    await share.connect(alice).transferFrom(alice.address, bob.address, 1);

    await expect(redeem.connect(alice).redeem(1)).to.be.revertedWithCustomError(redeem, "RedeemNotOpen");
    await redeem.setRedeemOpenTime(1);
    await expect(redeem.connect(bob).redeem(1)).to.be.revertedWithCustomError(share, "NotOriginWallet");
    await redeem.connect(alice).redeem(1);
    await expect(redeem.connect(alice).redeem(1)).to.be.revertedWithCustomError(share, "TokenAlreadyRedeemed");
  });

  it("10. A valid redeem mints 1,000 tokens, marks the NFT, and respects the redemption cap", async function () {
    const { owner, alice, registry, share, token, redeem } = await loadFixture(deploy);
    await mintAgent(registry, alice, "alice");
    await share.connect(alice).mint();
    await redeem.setRedeemOpenTime(1);

    await expect(redeem.connect(alice).redeem(1)).to.emit(redeem, "Redeemed");
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
    expect(await share.redeemed(1)).to.equal(true);
    expect(await share.ownerOf(1)).to.equal(alice.address);

    // Exercise the token's aggregate allocation guard without minting 20,159
    // separate NFT positions in a unit test.
    await token.setRedeemContract(owner.address);
    await token.mintRedeem(owner.address, ethers.parseEther("20159000"));
    await expect(token.mintRedeem(owner.address, ethers.parseEther("1")))
      .to.be.revertedWithCustomError(token, "RedeemAllocationExceeded");
  });
});
