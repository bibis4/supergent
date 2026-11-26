# Supergent — owner-run mainnet deployment

Status: **persiapan Fase 1, BUKAN izin deploy**. Ikuti blueprint dan checklist owner.
Agent tidak menjalankan perintah broadcast atau menangani key mainnet.

## Konfigurasi tetap

- Chain ID: **56**; registry resmi: `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.
- Deployer / owner sejak constructor / proceeds: `0xa1BE4296e6c05E5F6904A565e0a9FdCAB3F8d96e`.
- Supply NFT 20.160, maksimal 10 per Agent ID, pertama gratis; 0,001 BNB saat
  minter unik <1.000, lalu 0,002 BNB untuk share berbayar.
- Token cap 21.000.000, 18 desimal; redeem 20.160.000, liquidity 840.000 sekali.
- Redeem **TERTUTUP** (`uint256.max`); script tidak punya langkah membuka redeem.
- Metadata base URI: `https://supergent.xyz/nft/`. Endpoint metadata belum
  dipublikasikan; siapkan aset/endpoint dalam pekerjaan website Fase 3.

## Sebelum owner mengizinkan Fase 2

1. Konfirmasi saldo wallet proyek (checklist: 0,02 BNB buffer). Angka gas estimasi
   bukan jaminan; harga jaringan berubah. Agen belum memverifikasi pendanaan ini.
2. Siapkan URL repo GitHub publik dan source yang akan dirilis; jangan upload
   `.env`, key, seed, node_modules atau data akun pribadi. Folder belum menjadi
   repo Git pada saat persiapan ini. Publikasi repo belum dilakukan.
3. Setujui redeem tetap tertutup; jadwal bisa diputuskan belakangan.
4. Review tiga kontrak dan script. Unit test bukan audit independen. Owner punya
   hak mengganti redeem links, proceeds, metadata URI, jadwal redeem, dan mint
   liquidity sekali; jangan mengklaim protokol tanpa kontrol owner.
5. Owner memberi perintah eksplisit saat akan deploy. Tidak ada izin otomatis
   karena alamat publik wallet sudah diberikan.

## Perintah persiapan — tidak broadcast

Jalankan dari PowerShell, folder proyek:

```powershell
Set-Location 'C:\Users\zakia\Downloads\WEB3 WEBSITE'
npm run compile
npm run test:mainnet-prep
npm run test:mainnet-guards
npm run mainnet:plan
```

`mainnet:plan` offline: tidak memakai RPC, tidak meminta key, tidak menulis record.
Rehearsal memakai Hardhat lokal chain ID 56, signer impersonasi lokal, dan mock
read-surface yang dipasang hanya di memori pada alamat registry resmi. Ini BUKAN
fork atau bukti interaksi dengan implementasi registry mainnet yang live.

## OWNER SAJA — setelah izin eksplisit Fase 2

**Jangan minta agen menjalankan perintah berikut.** Buka terminal pribadi yang
tidak dikendalikan agen dan tidak direkam/transcript/screen-share. Hentikan agen
sebelum memasukkan key. Jangan pernah menaruh key di `.env`, chat, command line,
clipboard bersama, file workspace, atau environment variable.

Jika menggunakan hardware/mobile wallet tanpa akses key yang aman, **jangan
mengekspor seed untuk mengikuti runbook ini**. Tunda dan minta alur signer eksternal.

```powershell
Set-Location 'C:\Users\zakia\Downloads\WEB3 WEBSITE'
npm run mainnet:owner-deploy
```

Script mengharuskan terminal interaktif, cek chain ID 56 serta kode registry,
menampilkan rencana, lalu meminta teks `DEPLOY SUPERGENT MAINNET`. Owner memasukkan
private key di prompt tersembunyi. Key hanya di memori proses owner, tidak ditulis
ke file/log atau dikirim ke agen. Penghapusan string JavaScript tidak menjamin
zeroization memori; jangan jalankan di mesin/terminal yang tidak dipercaya.
Signer selain wallet proyek ditolak. `.env` dan key testnet **tidak dibaca** script.
RPC publik default dapat diganti melalui `SUPERGENT_MAINNET_RPC_URL` (bukan key).

Tepat lima transaksi, semuanya value 0 BNB selain gas:

1. Deploy SupergentShare (registry resmi, proceeds wallet proyek, metadata URI).
2. Deploy SupergentToken.
3. Deploy SupergentRedeem (Share, Token).
4. Share.setRedeemContract(Redeem).
5. Token.setRedeemContract(Redeem).

Tidak ada mock/harness, mint liquidity, withdraw, pembukaan redeem, atau smoke mint.
Script cek ulang owner, parameter blueprint, waktu redeem tertutup, dan linking.

Output publik: `deployments/bscMainnet.json`, hanya alamat/hash/config publik dan
calldata. **Jangan hapus record ini** jika ada gangguan. Hash tersimpan setelah
submit; langkah bertanda hash dikonfirmasi lagi saat resume, tidak dibroadcast ulang.
Jika ada intent tanpa hash (crash saat submit), script berhenti: cocokkan nonce dan
riwayat transaksi secara manual dahulu. Jangan menghapus checkpoint agar bisa retry.
Kesalahan ditulis secara generik supaya raw wallet/provider error tidak bocor.
Script baru diuji guard/rehearsal lokal; jalur interaktif owner belum dieksekusi.

## Verifikasi source — setelah kelima transaksi terkonfirmasi

Owner memasukkan API key Etherscan V2 sendiri ke konfigurasi lokal bila perlu;
**bukan private key wallet**. Network Hardhat `bsc` tidak punya signer (`accounts: []`).
Perintah berikut mempublikasikan source ke explorer, tidak mengirim transaksi chain.

```powershell
$d = Get-Content '.\deployments\bscMainnet.json' -Raw | ConvertFrom-Json
npx hardhat verify --network bsc $d.steps.share.address $d.registry $d.projectWallet $d.baseURI
npx hardhat verify --network bsc $d.steps.token.address
npx hardhat verify --network bsc $d.steps.redeem.address $d.steps.share.address $d.steps.token.address
```

Jangan klaim verified sampai semua hasil sukses dan halaman `#code` diperiksa.
Bagikan hanya file publik/alamat/tx hash kepada agen untuk laporan dan spot-check.

## Sesudah Fase 2, bukan sekarang

- Fase 3: config frontend mainnet saja, isi alamat di `docs/mainnet/llms.template.txt`,
  publikasikan sebagai root dan `app/public/llms.txt`; deploy Cloudflare Pages ke
  supergent.xyz + www.supergent.xyz, bukan Vercel. Periksa HTTPS/dashboard/disclaimer.
- Fase 4: dua mint gratis owner dari Agent ID asli, izin terpisah dan verifikasi Muse.
- Submission sebelum **9 Desember 2026, 15:00 WIB**, sesuai checklist. Syarat ≥30
  alamat Agent ID harus interaksi organik; tidak boleh akun buatan/manipulasi.
- Panduan testnet aktif dan alamat frontend saat ini sengaja belum dialihkan.
