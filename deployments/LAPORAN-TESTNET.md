# Laporan Supergent — BNB Testnet

Mainnet tidak disentuh. Unit test: 10/10. Build frontend: lulus.

## Kontrak terverifikasi

| Kontrak | Alamat | Sumber |
| --- | --- | --- |
| registry | `0x77E7F69663C72eD5531394B619019fF1E171613d` | [BscScan](https://testnet.bscscan.com/address/0x77E7F69663C72eD5531394B619019fF1E171613d#code) |
| share | `0xA437bD2Fb00B2548d0EAEcC0F8E0Bf1511742826` | [BscScan](https://testnet.bscscan.com/address/0xA437bD2Fb00B2548d0EAEcC0F8E0Bf1511742826#code) |
| token | `0xfE36f2770a4f67E85f9469b9158100d5Fa8aeC2b` | [BscScan](https://testnet.bscscan.com/address/0xfE36f2770a4f67E85f9469b9158100d5Fa8aeC2b#code) |
| redeem | `0x0Db8Bc17377A9f35eB763994236D581133CBCA2C` | [BscScan](https://testnet.bscscan.com/address/0x0Db8Bc17377A9f35eB763994236D581133CBCA2C#code) |
| Harness QA terpisah | `0x36610947e410AaE606dF50d8AdB618Dd692E34B6` | [BscScan](https://testnet.bscscan.com/address/0x36610947e410AaE606dF50d8AdB618Dd692E34B6#code) |

## Hasil Fase 4

Penolakan diuji melalui eth_call ke kontrak testnet; tidak disiarkan sebagai transaksi gagal, sehingga tidak memiliki tx hash.
Harga di ambang 1.000 diuji pada harness QA dengan state yang di-seed; bukan klaim 1.000 wallet memint di kontrak aktif.

| Skenario | Status | Bukti |
| --- | --- | --- |
| Reuse test Agent ID from interrupted E2E attempt | PASS | "sg-e2e-rotate-mwvqaivw" |
| First share free mint (confirmed from interrupted run) | PASS | [`0x19d0e449ccdb581f7843b2bcb31180470f5483af95131cf9606945bba36db6c4`](https://testnet.bscscan.com/tx/0x19d0e449ccdb581f7843b2bcb31180470f5483af95131cf9606945bba36db6c4) |
| Paid share #3 (confirmed from interrupted run) | PASS | [`0xf16c9260793687522d5138167f762d539da2f52b08c91ec3299bca758d944e06`](https://testnet.bscscan.com/tx/0xf16c9260793687522d5138167f762d539da2f52b08c91ec3299bca758d944e06) |
| Paid share #4 (confirmed from interrupted run) | PASS | [`0x80667dfb5abe432ade8cbfafb8f1edee904b472aa14ee89b8ec59f5708f21075`](https://testnet.bscscan.com/tx/0x80667dfb5abe432ade8cbfafb8f1edee904b472aa14ee89b8ec59f5708f21075) |
| Paid share #5 (confirmed from interrupted run) | PASS | [`0x150a5fdfc6c7780f112dce86cd1ead25d7517ce33abb93f592f39b631e057e38`](https://testnet.bscscan.com/tx/0x150a5fdfc6c7780f112dce86cd1ead25d7517ce33abb93f592f39b631e057e38) |
| Paid share #6 (confirmed from interrupted run) | PASS | [`0x795cc50dc64d16eaa7759487e9ba000a66cbeae64feeb9a55d3d04f823636a41`](https://testnet.bscscan.com/tx/0x795cc50dc64d16eaa7759487e9ba000a66cbeae64feeb9a55d3d04f823636a41) |
| Paid share #7 (confirmed from interrupted run) | PASS | [`0xc47306b233eacc6045e9b793575fd0b9862ecee55e00174a8e2cacb5b29a9e90`](https://testnet.bscscan.com/tx/0xc47306b233eacc6045e9b793575fd0b9862ecee55e00174a8e2cacb5b29a9e90) |
| Paid share #8 (confirmed from interrupted run) | PASS | [`0x02c8229dab5d9c936bc0b906b77513dc4e99d45b1045bff0215c59d99fed6c70`](https://testnet.bscscan.com/tx/0x02c8229dab5d9c936bc0b906b77513dc4e99d45b1045bff0215c59d99fed6c70) |
| Paid share #9 (confirmed from interrupted run) | PASS | [`0xb4d23d192d8450cd61318e392d1966ce15e5d6ce2262c998c9d1f243f702542d`](https://testnet.bscscan.com/tx/0xb4d23d192d8450cd61318e392d1966ce15e5d6ce2262c998c9d1f243f702542d) |
| Paid share #10 (confirmed from interrupted run) | PASS | [`0xe40e9bf7f886f82c60706172d4a369447e5034a7e95def406f4150978fed20cf`](https://testnet.bscscan.com/tx/0xe40e9bf7f886f82c60706172d4a369447e5034a7e95def406f4150978fed20cf) |
| Share 10 paid mint | PASS | [`0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6`](https://testnet.bscscan.com/tx/0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6) |
| 11th mint for the same Agent ID reverts | PASS | eth_call: AgentShareLimitReached |
| Wallet without Agent ID cannot mint | PASS | eth_call: NoAgentId |
| Deploy isolated test-only threshold harness | PASS | [`0x0308e32f7f9e4756432fa77119d8de03b50437ad5b99088e460da370be0a236b`](https://testnet.bscscan.com/tx/0x0308e32f7f9e4756432fa77119d8de03b50437ad5b99088e460da370be0a236b) |
| Set QA threshold just below 1,000 unique minters | PASS | [`0x57f30800b51fa842d5366548e0fe13752bab7cc9a2420c0461063655c2488ea5`](https://testnet.bscscan.com/tx/0x57f30800b51fa842d5366548e0fe13752bab7cc9a2420c0461063655c2488ea5) |
| QA threshold price below 1,000 | PASS | "1000000000000000" |
| Set QA threshold at 1,000 unique minters | PASS | [`0x2e7a8d64b4a4ab15d5be9c89574fb3e604b2c810f53f07c12b2b83ab065ac44a`](https://testnet.bscscan.com/tx/0x2e7a8d64b4a4ab15d5be9c89574fb3e604b2c810f53f07c12b2b83ab065ac44a) |
| QA threshold price at 1,000 | PASS | "2000000000000000" |
| QA paid mint at 1,000 unique minters (0.002 BNB) | PASS | [`0x55d4d3f374a92f7cbfcf2683bf11816e6c0a7ac6bf0efae0ef2ea5af57da5e21`](https://testnet.bscscan.com/tx/0x55d4d3f374a92f7cbfcf2683bf11816e6c0a7ac6bf0efae0ef2ea5af57da5e21) |
| Redeem before open time reverts | PASS | eth_call: RedeemNotOpen |
| Transfer share #2 to test buyer | PASS | [`0x31af9b573342a99eb8927448880d2b83cd80ff0cb557041e9b4016c347fe5b2d`](https://testnet.bscscan.com/tx/0x31af9b573342a99eb8927448880d2b83cd80ff0cb557041e9b4016c347fe5b2d) |
| Open testnet redeem window at past timestamp | PASS | [`0x9cb24dbe71b456539ec80730f42238b9e6ee01c2ee672abcb5b7b7c77d86bf59`](https://testnet.bscscan.com/tx/0x9cb24dbe71b456539ec80730f42238b9e6ee01c2ee672abcb5b7b7c77d86bf59) |
| Paid share #11 (confirmed from interrupted run) | PASS | [`0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6`](https://testnet.bscscan.com/tx/0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6) |
| Buyer who received the NFT cannot redeem | PASS | eth_call: NotOriginWallet |
| Original mint wallet redeems transferred share #2 | PASS | [`0x6a18ca360a2fded90788b152f67f624ca7f217d4f5c58be8def267f5eaae5c76`](https://testnet.bscscan.com/tx/0x6a18ca360a2fded90788b152f67f624ca7f217d4f5c58be8def267f5eaae5c76) |
| Redeeming the same share twice reverts | PASS | eth_call: TokenAlreadyRedeemed |
| Contract values match E2E expectations (browser verification separate) | PASS | {"chainId":97,"agentHandle":"sg-e2e-rotate-mwvqaivw","uniqueMinterCount":"2","totalMinted":"11","agentMinted":"10","tokenSupply":"1000000000000000000000","originWalletTokenBalance":"1000000000000000000000","redeemOpen":true,"redeemOpenTime":"1"} |

## Dashboard browser

Status: PASS. Browser Chromium nyata, tanpa mock RPC.
Agent ID unik: **2 / 1,000**; share: **11 / 20,160**; token redeemed: **1,000**.
Leaderboard: 10 dan 1 share. Recent mint: #11 sampai #6. Tidak ada error console/toast saat pemeriksaan.
Browser wallet signing dan UI collection per-wallet tidak diuji; transaksi E2E dikirim lewat signer lokal khusus testnet.

## State akhir

```json
{
  "chainId": 97,
  "agentHandle": "sg-e2e-rotate-mwvqaivw",
  "uniqueMinterCount": "2",
  "totalMinted": "11",
  "agentMinted": "10",
  "tokenSupply": "1000000000000000000000",
  "originWalletTokenBalance": "1000000000000000000000",
  "redeemOpen": true,
  "redeemOpenTime": "1"
}
```
Redeem testnet terbuka (timestamp 1) untuk QA. Ini bukan tanggal launch/redeem mainnet.
Proceeds wallet testnet: `0xD8720C10593981AE7C31bB34A152b14636cbE533`. Proceeds mint tidak ditarik.

## Gas (transaksi dalam catatan)

Total gas tercatat: **0.0070224921 tBNB**, dari 27 transaksi sukses unik.
Only the successful transactions in deployment, rotation and E2E records. Excludes partial initial deployments and old interrupted runs absent from those records. Mint payments are not gas.

## Transaksi deployment, rotasi, dan E2E

| Aksi | Tx hash | Gas tBNB |
| --- | --- | --- |
| mockRegistryDeployment | [`0x30172184f2e8d29c8a460c2a56b51fa41970397f72c60887e142afa2556704e1`](https://testnet.bscscan.com/tx/0x30172184f2e8d29c8a460c2a56b51fa41970397f72c60887e142afa2556704e1) | 0.001355781 |
| shareDeployment | [`0x71e5991fc8b2818209ef1de87e190daf99d7c81e04e0ac2dfda16f8c09de895c`](https://testnet.bscscan.com/tx/0x71e5991fc8b2818209ef1de87e190daf99d7c81e04e0ac2dfda16f8c09de895c) | 0.00210875 |
| tokenDeployment | [`0xd4d3d6646db66bc003d66e466412672d64e249a77eb4a93cfb2c9cd309ffb4ec`](https://testnet.bscscan.com/tx/0xd4d3d6646db66bc003d66e466412672d64e249a77eb4a93cfb2c9cd309ffb4ec) | 0.000792451 |
| redeemDeployment | [`0xdb49258d839fbb866ad1b86af90be88ed6c10d9696a9e369532ea204f2384422`](https://testnet.bscscan.com/tx/0xdb49258d839fbb866ad1b86af90be88ed6c10d9696a9e369532ea204f2384422) | 0.000595201 |
| shareRedeemLink | [`0xd396ccabc11a350c6a6a514a7a00c3ed82c16a3edf4657a174c4d0f1807a7a8c`](https://testnet.bscscan.com/tx/0xd396ccabc11a350c6a6a514a7a00c3ed82c16a3edf4657a174c4d0f1807a7a8c) | 0.00004728 |
| tokenRedeemLink | [`0x699449d0744302a8323e0a5d9ff4fcb5644cc91b9309d0ae28f52a50311ec41a`](https://testnet.bscscan.com/tx/0x699449d0744302a8323e0a5d9ff4fcb5644cc91b9309d0ae28f52a50311ec41a) | 0.000047352 |
| mint replacement test Agent ID | [`0xe3ed62e590bae40e38c2cedd0de02789f8153239f94159c6550a4a018cb44021`](https://testnet.bscscan.com/tx/0xe3ed62e590bae40e38c2cedd0de02789f8153239f94159c6550a4a018cb44021) | 0.0000118077 |
| transfer share ownership | [`0xfdf83172518bb517dac7875184007f1be3a80102a48e7de2207c95838ad7499f`](https://testnet.bscscan.com/tx/0xfdf83172518bb517dac7875184007f1be3a80102a48e7de2207c95838ad7499f) | 0.0000028682 |
| transfer token ownership | [`0x4fbc216df802d5bffd8ba7ca04fa441f7db7bd12dc42cf69b90f93d8419277cb`](https://testnet.bscscan.com/tx/0x4fbc216df802d5bffd8ba7ca04fa441f7db7bd12dc42cf69b90f93d8419277cb) | 0.0000028666 |
| transfer redeem ownership | [`0xf9b6fb1fe6d912675f0fde6c64fbbb469100710e053df61bfe2c1bd098aa84f9`](https://testnet.bscscan.com/tx/0xf9b6fb1fe6d912675f0fde6c64fbbb469100710e053df61bfe2c1bd098aa84f9) | 0.0000028584 |
| First share free mint (confirmed from interrupted run) | [`0x19d0e449ccdb581f7843b2bcb31180470f5483af95131cf9606945bba36db6c4`](https://testnet.bscscan.com/tx/0x19d0e449ccdb581f7843b2bcb31180470f5483af95131cf9606945bba36db6c4) | 0.000213016 |
| Paid share #3 (confirmed from interrupted run) | [`0xf16c9260793687522d5138167f762d539da2f52b08c91ec3299bca758d944e06`](https://testnet.bscscan.com/tx/0xf16c9260793687522d5138167f762d539da2f52b08c91ec3299bca758d944e06) | 0.000158735 |
| Paid share #4 (confirmed from interrupted run) | [`0x80667dfb5abe432ade8cbfafb8f1edee904b472aa14ee89b8ec59f5708f21075`](https://testnet.bscscan.com/tx/0x80667dfb5abe432ade8cbfafb8f1edee904b472aa14ee89b8ec59f5708f21075) | 0.000158735 |
| Paid share #5 (confirmed from interrupted run) | [`0x150a5fdfc6c7780f112dce86cd1ead25d7517ce33abb93f592f39b631e057e38`](https://testnet.bscscan.com/tx/0x150a5fdfc6c7780f112dce86cd1ead25d7517ce33abb93f592f39b631e057e38) | 0.000158735 |
| Paid share #6 (confirmed from interrupted run) | [`0x795cc50dc64d16eaa7759487e9ba000a66cbeae64feeb9a55d3d04f823636a41`](https://testnet.bscscan.com/tx/0x795cc50dc64d16eaa7759487e9ba000a66cbeae64feeb9a55d3d04f823636a41) | 0.000158735 |
| Paid share #7 (confirmed from interrupted run) | [`0xc47306b233eacc6045e9b793575fd0b9862ecee55e00174a8e2cacb5b29a9e90`](https://testnet.bscscan.com/tx/0xc47306b233eacc6045e9b793575fd0b9862ecee55e00174a8e2cacb5b29a9e90) | 0.000158735 |
| Paid share #8 (confirmed from interrupted run) | [`0x02c8229dab5d9c936bc0b906b77513dc4e99d45b1045bff0215c59d99fed6c70`](https://testnet.bscscan.com/tx/0x02c8229dab5d9c936bc0b906b77513dc4e99d45b1045bff0215c59d99fed6c70) | 0.000158735 |
| Paid share #9 (confirmed from interrupted run) | [`0xb4d23d192d8450cd61318e392d1966ce15e5d6ce2262c998c9d1f243f702542d`](https://testnet.bscscan.com/tx/0xb4d23d192d8450cd61318e392d1966ce15e5d6ce2262c998c9d1f243f702542d) | 0.000158735 |
| Paid share #10 (confirmed from interrupted run) | [`0xe40e9bf7f886f82c60706172d4a369447e5034a7e95def406f4150978fed20cf`](https://testnet.bscscan.com/tx/0xe40e9bf7f886f82c60706172d4a369447e5034a7e95def406f4150978fed20cf) | 0.000158735 |
| Paid share #11 (confirmed from interrupted run) | [`0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6`](https://testnet.bscscan.com/tx/0xf6e5a7f6384c97a11b487540a1043e169404c133bd41518f6c3f471f990b93f6) | 0.000031747 |
| Deploy isolated test-only threshold harness | [`0x0308e32f7f9e4756432fa77119d8de03b50437ad5b99088e460da370be0a236b`](https://testnet.bscscan.com/tx/0x0308e32f7f9e4756432fa77119d8de03b50437ad5b99088e460da370be0a236b) | 0.0004265602 |
| Set QA threshold just below 1,000 unique minters | [`0x57f30800b51fa842d5366548e0fe13752bab7cc9a2420c0461063655c2488ea5`](https://testnet.bscscan.com/tx/0x57f30800b51fa842d5366548e0fe13752bab7cc9a2420c0461063655c2488ea5) | 0.0000181884 |
| Set QA threshold at 1,000 unique minters | [`0x2e7a8d64b4a4ab15d5be9c89574fb3e604b2c810f53f07c12b2b83ab065ac44a`](https://testnet.bscscan.com/tx/0x2e7a8d64b4a4ab15d5be9c89574fb3e604b2c810f53f07c12b2b83ab065ac44a) | 0.0000073684 |
| QA paid mint at 1,000 unique minters (0.002 BNB) | [`0x55d4d3f374a92f7cbfcf2683bf11816e6c0a7ac6bf0efae0ef2ea5af57da5e21`](https://testnet.bscscan.com/tx/0x55d4d3f374a92f7cbfcf2683bf11816e6c0a7ac6bf0efae0ef2ea5af57da5e21) | 0.0000385892 |
| Transfer share #2 to test buyer | [`0x31af9b573342a99eb8927448880d2b83cd80ff0cb557041e9b4016c347fe5b2d`](https://testnet.bscscan.com/tx/0x31af9b573342a99eb8927448880d2b83cd80ff0cb557041e9b4016c347fe5b2d) | 0.0000119372 |
| Open testnet redeem window at past timestamp | [`0x9cb24dbe71b456539ec80730f42238b9e6ee01c2ee672abcb5b7b7c77d86bf59`](https://testnet.bscscan.com/tx/0x9cb24dbe71b456539ec80730f42238b9e6ee01c2ee672abcb5b7b7c77d86bf59) | 0.0000059674 |
| Original mint wallet redeems transferred share #2 | [`0x6a18ca360a2fded90788b152f67f624ca7f217d4f5c58be8def267f5eaae5c76`](https://testnet.bscscan.com/tx/0x6a18ca360a2fded90788b152f67f624ca7f217d4f5c58be8def267f5eaae5c76) | 0.0000320224 |
