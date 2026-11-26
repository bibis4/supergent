import { expect } from "chai";
import { MaxUint256 } from "ethers";
import { MAINNET, assertMainnetConfig } from "../config/mainnet";
import { deploymentPlan } from "../scripts/deploy-mainnet";

describe("Mainnet deployment safety guards (offline)", () => {
  it("accepts only the official mainnet configuration", () => {
    expect(() => assertMainnetConfig(MAINNET)).not.to.throw();
  });
  it("rejects testnet and local chain IDs", () => {
    for (const chainId of [97n, 31337n]) expect(() => assertMainnetConfig({ ...MAINNET, chainId })).to.throw("56");
  });
  it("rejects mock/unofficial registries", () => {
    expect(() => assertMainnetConfig({ ...MAINNET, registry: MAINNET.projectWallet })).to.throw("registry");
  });
  it("rejects the old testnet owner/proceeds wallet", () => {
    expect(() => assertMainnetConfig({ ...MAINNET, projectWallet: "0xb1a55710AB91Ff8CA39D457877083E24Aa00D068" })).to.throw("wallet");
  });
  it("rejects open AND scheduled redemption at launch", () => {
    for (const redeemOpenTime of [0n, 1n, 2000000000n]) {
      expect(() => assertMainnetConfig({ ...MAINNET, redeemOpenTime })).to.throw("closed");
    }
    expect(MAINNET.redeemOpenTime).to.equal(MaxUint256);
  });
  it("plans exactly three deployments and two links, without extra actions", () => {
    const plan = deploymentPlan();
    expect(plan.transactions).to.have.length(5);
    expect(plan.owner).to.equal(MAINNET.projectWallet);
    expect(plan.proceedsWallet).to.equal(MAINNET.projectWallet);
    expect(plan.transactions.join(" ")).not.to.match(/Mock|Harness|mintLiquidity|setRedeemOpenTime|withdraw/);
  });
});
