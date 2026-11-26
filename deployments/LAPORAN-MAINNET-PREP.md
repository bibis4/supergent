# Supergent — persiapan mainnet Fase 1

Tanggal: 26 November 2026. **Tidak ada deploy atau transaksi mainnet.**
Tidak ada pembacaan/penyimpanan private key mainnet. Gas mainnet sesi ini: **0 BNB**.

## Konfigurasi

| Parameter | Nilai |
| --- | --- |
| Chain ID target | 56 |
| Registry resmi | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| Deployer / owner / proceeds | `0xa1BE4296e6c05E5F6904A565e0a9FdCAB3F8d96e` |
| Redeem saat launch | Tertutup, `uint256.max`; tidak ada tanggal |
| NFT | Maks 20.160; maks 10 per Agent ID |
| Harga | Pertama gratis; berikutnya 0,001 BNB sebelum 1.000 minter unik, lalu 0,002 BNB |
| Token | Cap 21.000.000; 18 desimal |
| Redeem / liquidity | 20.160.000 / 840.000; 1.000 token per NFT |

Kode Solidity produksi tidak diubah. Registry/proceeds dipilih melalui constructor
di script terpisah. Mainnet Hardhat sekarang `accounts: []`, sehingga tidak lagi
memakai key deployer testnet. Script owner tidak mengimpor Hardhat/dotenv dan tidak
mengambil key dari `.env`/environment; prompt tersembunyi hanya untuk terminal owner.

## Output asli rehearsal 10 skenario

Perintah: `npm run test:mainnet-prep`

```text
> supergent@0.1.0 test:mainnet-prep
> hardhat test --config hardhat.mainnet-test.config.ts test/Supergent.test.ts

  Supergent — blueprint scenarios
    ✔ 1. Agent ID holder's first mint succeeds for zero BNB (736ms)
    ✔ 2. The same Agent ID cannot claim the free share twice (169ms)
    ✔ 3. A paid share costs exactly 0.001 BNB before the early-bird threshold (192ms)
    ✔ 4. Paid price changes to 0.002 BNB at 1,000 unique Agent IDs (182ms)
    ✔ 5. A new Agent ID's first share stays free after early bird ends (140ms)
    ✔ 6. The 11th share for one Agent ID reverts (170ms)
    ✔ 7. A wallet without an Agent ID cannot mint (133ms)
    ✔ 8. Minting beyond the 20,160 NFT supply reverts (116ms)
    ✔ 9. Redeem is blocked before open, for non-origin wallets, and a second time (132ms)
    ✔ 10. A valid redeem mints 1,000 tokens, marks the NFT, and respects the redemption cap (180ms)

  10 passing (4s)
```

Metode: chain Hardhat lokal ID 56, bukan mainnet dan bukan fork. Owner proyek
di-impersonate lokal dengan saldo simulasi; tidak memakai key asli. Mock registry
read-surface diinjeksikan hanya ke chain lokal pada alamat registry resmi. Ini
menguji konfigurasi/resolusi ID, BUKAN implementasi registry live. Harness khusus
tes tetap dipakai untuk state batas harga/supply, tidak masuk deployment produksi.
Di skenario pertama turut dicek semua konstanta, owner/proceeds, alokasi token,
reward, supply awal nol, liquidity belum minted, dan redeem awal tertutup.

Percobaan rehearsal awal sempat 8 lulus / 2 gagal karena storage registry lokal
alamat tetap terbawa antar fixture. Diperbaiki dengan reset chain lokal dan cache
snapshot per skenario; rerun final di atas 10/10. Bukan bug transaksi mainnet.

## Output asli guard

Perintah: `npm run test:mainnet-guards`

```text
  Mainnet deployment safety guards (offline)
    ✔ accepts only the official mainnet configuration
    ✔ rejects testnet and local chain IDs
    ✔ rejects mock/unofficial registries
    ✔ rejects the old testnet owner/proceeds wallet
    ✔ rejects open AND scheduled redemption at launch
    ✔ plans exactly three deployments and two links, without extra actions (61ms)

  6 passing (97ms)
```

- `npm test`: **16 passing (3s)** (10 blueprint regresi + 6 guard).
- `npm run mainnet:plan`: lulus, offline; menampilkan tiga deploy + dua linking saja.
- Type-check terarah `scripts/deploy-mainnet.ts` dan `config/mainnet.ts`: lulus
  (`tsc --noEmit --skipLibCheck --target ES2020 --module commonjs --esModuleInterop --strict`).
- `npm run build`: lulus. Vite memberi warning chunk utama 500,04 kB (>500 kB);
  ini warning ukuran bundle, bukan kegagalan build.
- `npm run lint`: lulus.

## File yang disiapkan

- `config/mainnet.ts`: config publik dan guard chain/registry/wallet/redeem.
- `scripts/deploy-mainnet.ts`: alur owner-only, rencana offline, validasi parameter,
  lima transaksi, checkpoint publik/resume, tanpa pembukaan redeem/mint liquidity.
- `hardhat.mainnet-test.config.ts`: rehearsal tanpa RPC/secret.
- `docs/mainnet/OWNER-RUNBOOK.md`: perintah lengkap owner dan verifikasi source.
- `docs/mainnet/llms.template.txt`: panduan mainnet BELUM TERBIT; alamat kontrak
  sengaja `NOT_DEPLOYED`, tidak boleh dipakai bertransaksi.
- FAQ frontend diperjelas: hak tetap di wallet Agent ID asal bahkan setelah NFT
  ditransfer; penerima NFT tidak mendapat hak token, NFT ditandai bukan dibakar.

Frontend aktif dan dua file `/llms.txt` yang sudah ada tetap testnet. Tidak ada
aktivasi mainnet/Cloudflare/GitHub. Tidak ada `bscMainnet.json` hasil deployment.

## Batas pembuktian dan prasyarat berikutnya

Prompt key serta broadcast/resume owner belum dijalankan end-to-end. Tes guard
bukan audit independen dan tidak membuktikan deploy di jaringan live. Tiga source
mainnet belum terverifikasi karena belum ada kontrak mainnet.

Sebelum Fase 2, owner perlu konfirmasi saldo wallet proyek, repo GitHub publik,
keputusan redeem tetap tertutup, dan izin eksplisit saat deployment. Jika wallet
mobile/hardware tidak menyediakan metode key aman, jangan mengekspor seed;
siapkan signer eksternal terlebih dahulu. Agen tidak menjalankan broadcast.

Endpoint metadata `/nft/` perlu disiapkan pada pekerjaan website. Setelah Fase 2,
baru ganti frontend/panduan ke mainnet dan deploy Cloudflare Pages ke supergent.xyz
dan www.supergent.xyz. Smoke test dua Agent ID mengikuti Fase 4, izin terpisah.
