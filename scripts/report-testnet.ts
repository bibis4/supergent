import { readFile, writeFile } from "node:fs/promises";
import { ethers, network } from "hardhat";

async function main() {
  if (network.name !== "bscTestnet" || (await ethers.provider.getNetwork()).chainId !== 97n) {
    throw new Error("Report is limited to BNB Testnet.");
  }
  const deployment = JSON.parse(await readFile("deployments/bscTestnet.json", "utf8"));
  const e2e = JSON.parse(await readFile("deployments/e2e-bscTestnet.json", "utf8"));
  const frontend = JSON.parse(await readFile("deployments/frontend-bscTestnet.json", "utf8"));
  const transactions = new Map<string, string>();
  for (const [label, hash] of Object.entries(deployment.transactions)) transactions.set(String(hash), label);
  for (const item of deployment.ownerRotation.transactions) transactions.set(item.hash, item.action);
  for (const item of e2e.scenarios) if (item.txHash) transactions.set(item.txHash, item.scenario);
  let totalGas = 0n;
  const receipts = [];
  for (const [hash, label] of transactions) {
    const receipt = await ethers.provider.getTransactionReceipt(hash);
    if (!receipt || receipt.status !== 1) throw new Error(`Receipt missing or failed: ${hash}`);
    const fee = receipt.gasUsed * receipt.gasPrice;
    totalGas += fee;
    receipts.push({ label, hash, blockNumber: receipt.blockNumber, status: receipt.status,
      gasUsed: receipt.gasUsed.toString(), gasPriceWei: receipt.gasPrice.toString(), feeTBNB: ethers.formatEther(fee) });
  }
  const gasReport = {
    chainId: 97, uniqueSuccessfulTransactions: receipts.length,
    totalRecordedGasTBNB: ethers.formatEther(totalGas),
    note: "Only the successful transactions in deployment, rotation and E2E records. Excludes partial initial deployments and old interrupted runs absent from those records. Mint payments are not gas.",
    receipts,
  };
  await writeFile("deployments/gas-bscTestnet.json", JSON.stringify(gasReport, null, 2) + "\n");
  const lines = [
    "# Laporan Supergent — BNB Testnet", "",
    "Mainnet tidak disentuh. Unit test: 10/10. Build frontend: lulus.", "",
    "## Kontrak terverifikasi", "",
    "| Kontrak | Alamat | Sumber |", "| --- | --- | --- |",
    ...["registry", "share", "token", "redeem"].map(key => `| ${key} | \`${deployment[key]}\` | [BscScan](https://testnet.bscscan.com/address/${deployment[key]}#code) |`),
    `| Harness QA terpisah | \`${e2e.harness}\` | [BscScan](https://testnet.bscscan.com/address/${e2e.harness}#code) |`,
    "", "## Hasil Fase 4", "",
    "Penolakan diuji melalui eth_call ke kontrak testnet; tidak disiarkan sebagai transaksi gagal, sehingga tidak memiliki tx hash.",
    "Harga di ambang 1.000 diuji pada harness QA dengan state yang di-seed; bukan klaim 1.000 wallet memint di kontrak aktif.",
    "", "| Skenario | Status | Bukti |", "| --- | --- | --- |",
    ...e2e.scenarios.map((item: any) => `| ${item.scenario} | ${item.status} | ${item.txHash ? `[\`${item.txHash}\`](https://testnet.bscscan.com/tx/${item.txHash})` : item.expectedRevert ? `eth_call: ${item.expectedRevert}` : JSON.stringify(item.values ?? item.paidSharePriceWei ?? item.handle ?? "view read")} |`),
    "", "## Dashboard browser", "",
    `Status: ${frontend.status}. Browser Chromium nyata, tanpa mock RPC.`,
    `Agent ID unik: **${frontend.metrics.uniqueAgentIds}**; share: **${frontend.metrics.sharesMinted}**; token redeemed: **${frontend.metrics.tokenRedeemed}**.`,
    "Leaderboard: 10 dan 1 share. Recent mint: #11 sampai #6. Tidak ada error console/toast saat pemeriksaan.",
    "Browser wallet signing dan UI collection per-wallet tidak diuji; transaksi E2E dikirim lewat signer lokal khusus testnet.",
    "", "## State akhir", "",
    `\`\`\`json\n${JSON.stringify(e2e.finalDashboardState, null, 2)}\n\`\`\``,
    "Redeem testnet terbuka (timestamp 1) untuk QA. Ini bukan tanggal launch/redeem mainnet.",
    `Proceeds wallet testnet: \`${deployment.proceedsWallet}\`. Proceeds mint tidak ditarik.`,
    "", "## Gas (transaksi dalam catatan)", "",
    `Total gas tercatat: **${gasReport.totalRecordedGasTBNB} tBNB**, dari ${receipts.length} transaksi sukses unik.`,
    gasReport.note, "",
    "## Transaksi deployment, rotasi, dan E2E", "",
    "| Aksi | Tx hash | Gas tBNB |", "| --- | --- | --- |",
    ...receipts.map(item => `| ${item.label} | [\`${item.hash}\`](https://testnet.bscscan.com/tx/${item.hash}) | ${item.feeTBNB} |`), "",
  ];
  await writeFile("deployments/LAPORAN-TESTNET.md", lines.join("\n"), "utf8");
  console.log(JSON.stringify({ report: "deployments/LAPORAN-TESTNET.md", gasReport: "deployments/gas-bscTestnet.json",
    totalRecordedGasTBNB: gasReport.totalRecordedGasTBNB, successfulTransactions: receipts.length }));
}

main().catch(() => { console.error("Gagal membuat laporan; periksa koneksi testnet dan receipt."); process.exitCode = 1; });
