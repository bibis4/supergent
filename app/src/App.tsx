import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  ExternalLink,
  Fingerprint,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  addresses,
  bscMainnet,
  contractsReady,
  deploymentBlock,
  getWalletClient,
  publicClient,
  redeemAbi,
  registryAbi,
  shareAbi,
  tokenAbi,
} from "./contracts";
import { mainnetConfig } from "./mainnet-config";
import { formatEther, keccak256, toBytes, type Address, type Hash } from "viem";

type ShareRow = {
  tokenId: bigint;
  owner: Address;
  originWallet: Address;
  redeemed: boolean;
};

type ActivityRow = {
  agentId: bigint;
  tokenId: bigint;
  wallet: Address;
  price: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
};

type LeaderRow = { agentId: bigint; minted: number; latestBlock: bigint };

const truncate = (value?: string, left = 6, right = 4) => value
  ? `${value.slice(0, left)}…${value.slice(-right)}`
  : "—";

const formatInt = (value?: bigint | number) => value === undefined
  ? "—"
  : Number(value).toLocaleString("en-US");

function App() {
  const [wallet, setWallet] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [agentHandle, setAgentHandle] = useState("");
  const [agentId, setAgentId] = useState<bigint | null>(null);
  const [minted, setMinted] = useState<bigint | null>(null);
  const [redeemedCount, setRedeemedCount] = useState<bigint | null>(null);
  const [nextPrice, setNextPrice] = useState<bigint | null>(null);
  const [totalMinted, setTotalMinted] = useState<bigint | null>(null);
  const [uniqueMinters, setUniqueMinters] = useState<bigint | null>(null);
  const [tokenSupply, setTokenSupply] = useState<bigint | null>(null);
  const [redeemOpenTime, setRedeemOpenTime] = useState<bigint | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [recent, setRecent] = useState<ActivityRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [chainReadConfirmed, setChainReadConfirmed] = useState(false);

  const isMainnet = chainId === bscMainnet.id;
  const redeemScheduleConfirmed = redeemOpenTime === mainnetConfig.plannedRedeemOpenTime;
  const secondsToRedeem = Math.max(0, Number(mainnetConfig.plannedRedeemOpenTime) - Math.floor(now / 1000));
  const currentPriceLabel = nextPrice === null
    ? "—"
    : nextPrice === 0n
      ? "FREE"
      : `${formatEther(nextPrice)} BNB`;

  const setError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    setNotice({ kind: "error", text: message.replace(/^Error:\[[0-9;]*m/, "").slice(0, 180) });
  };

  const connectWallet = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setNotice({ kind: "error", text: "No EVM wallet found. Open this page in a browser with Rabby or MetaMask." });
      return;
    }
    setBusy(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const rawChainId = await provider.request({ method: "eth_chainId" }) as string;
      if (!accounts[0]) throw new Error("No wallet account was returned.");
      setWallet(accounts[0] as Address);
      setChainId(Number.parseInt(rawChainId, 16));
      setNotice({ kind: "success", text: "Wallet connected. Reading BNB Mainnet status; transactions require your wallet approval." });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }, []);

  const switchToMainnet = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code: number }).code : 0;
      if (code !== 4902) {
        setError(error);
        return;
      }
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: [...bscMainnet.rpcUrls.default.http],
          blockExplorerUrls: [mainnetConfig.explorerUrl],
        }],
      });
    }
  }, []);

  const refresh = useCallback(async (address = wallet) => {
    if (!contractsReady) return;
    setRefreshing(true);
    try {
      if (await publicClient.getChainId() !== bscMainnet.id) throw new Error("RPC network mismatch: expected BNB Mainnet (56).");
      const [count, unique, supply, redeemTimestamp, isOpen] = await Promise.all([
        publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "totalMinted" }),
        publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "uniqueMinterCount" }),
        publicClient.readContract({ address: addresses.token, abi: tokenAbi, functionName: "redeemedSupply" }),
        publicClient.readContract({ address: addresses.redeem, abi: redeemAbi, functionName: "redeemOpenTime" }),
        publicClient.readContract({ address: addresses.redeem, abi: redeemAbi, functionName: "isOpen" }),
      ]);
      setTotalMinted(count);
      setUniqueMinters(unique);
      setTokenSupply(supply);
      setRedeemOpenTime(redeemTimestamp);
      setRedeemOpen(isOpen);
      setChainReadConfirmed(true);

      if (address) {
        const [balance, handle] = await Promise.all([
          publicClient.readContract({ address: addresses.registry, abi: registryAbi, functionName: "balanceOf", args: [address] }),
          publicClient.readContract({ address: addresses.registry, abi: registryAbi, functionName: "handleOf", args: [address] }),
        ]);
        if (balance > 0n && handle) {
          const id = BigInt(keccak256(toBytes(handle)));
          const registryOwner = await publicClient.readContract({ address: addresses.registry, abi: registryAbi, functionName: "ownerOf", args: [id] });
          if (registryOwner.toLowerCase() !== address.toLowerCase()) throw new Error("Registry ownership does not match this Agent ID wallet.");
          setAgentId(id);
          setAgentHandle(handle);
          const [walletMinted, price, walletRedeemed, tokenIds] = await Promise.all([
            publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "mintedCount", args: [id] }),
            publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "priceNextShare", args: [id] }),
            publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "redeemedCount", args: [id] }),
            publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "shareTokenIds", args: [id] }),
          ]);
          setMinted(walletMinted);
          setNextPrice(price);
          setRedeemedCount(walletRedeemed);
          const positions = await Promise.all(tokenIds.map(async (tokenId) => {
            const [owner, originWallet, redeemed] = await Promise.all([
              publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "ownerOf", args: [tokenId] }),
              publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "originWallet", args: [tokenId] }),
              publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "redeemed", args: [tokenId] }),
            ]);
            return { tokenId, owner, originWallet, redeemed } satisfies ShareRow;
          }));
          setShares(positions.reverse());
          if (window.ethereum) {
            try {
              const estimate = await publicClient.estimateContractGas({
                address: addresses.share,
                abi: shareAbi,
                functionName: "mint",
                account: address,
                value: price,
              });
              const gasPrice = await publicClient.getGasPrice();
              setGasEstimate(estimate * gasPrice);
            } catch {
              setGasEstimate(null);
            }
          }
        } else {
          setAgentId(null);
          setAgentHandle("");
          setMinted(null);
          setNextPrice(null);
          setRedeemedCount(null);
          setShares([]);
        }
      }

      const latestBlock = await publicClient.getBlockNumber();
      const startBlock = deploymentBlock > 0n
        ? deploymentBlock
        : latestBlock > 2_000n ? latestBlock - 2_000n : 0n;
      const rows: ActivityRow[] = [];
      // Scan from the verified deployment receipt, in public-RPC-friendly chunks.
      for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += 5_000n) {
        const end = fromBlock + 4_999n;
        const logs = await publicClient.getContractEvents({
          address: addresses.share,
          abi: shareAbi,
          eventName: "ShareMinted",
          fromBlock,
          toBlock: end < latestBlock ? end : latestBlock,
        });
        rows.push(...logs.map((log) => ({
        agentId: log.args.agentId!,
        tokenId: log.args.tokenId!,
        wallet: log.args.wallet!,
        price: log.args.price!,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        })));
      }
      rows.sort((a, b) => Number(b.blockNumber - a.blockNumber));
      setRecent(rows.slice(0, 6));
      const grouped = new Map<string, LeaderRow>();
      for (const row of rows) {
        const key = row.agentId.toString();
        const current = grouped.get(key) ?? { agentId: row.agentId, minted: 0, latestBlock: 0n };
        current.minted += 1;
        if (row.blockNumber > current.latestBlock) current.latestBlock = row.blockNumber;
        grouped.set(key, current);
      }
      setLeaders([...grouped.values()].sort((a, b) => b.minted - a.minted || Number(b.latestBlock - a.latestBlock)).slice(0, 5));
    } catch (error) {
      setError(error);
    } finally {
      setRefreshing(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet || !window.ethereum) return;
    const onAccountsChanged = (accounts: string[]) => setWallet((accounts[0] as Address | undefined) ?? null);
    const onChainChanged = (value: string) => setChainId(Number.parseInt(value, 16));
    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [wallet]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const mintShare = async () => {
    if (!wallet || !window.ethereum || !contractsReady || !agentId) return;
    setBusy(true);
    try {
      if (!isMainnet) {
        await switchToMainnet();
        throw new Error("Switch to BNB Mainnet, then review and submit the mint again.");
      }
      const walletClient = await getWalletClient(window.ethereum, wallet);
      const price = await publicClient.readContract({ address: addresses.share, abi: shareAbi, functionName: "priceNextShare", args: [agentId] });
      const { request } = await publicClient.simulateContract({
        address: addresses.share,
        abi: shareAbi,
        functionName: "mint",
        value: price,
        account: wallet,
      });
      const txHash = await walletClient.writeContract(request);
      setNotice({ kind: "info", text: `Transaction sent: ${truncate(txHash, 10, 8)}` });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Mint transaction reverted. Check BscScan before retrying.");
      setNotice({ kind: "success", text: "Genesis Share minted on BNB Mainnet." });
      await refresh(wallet);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };

  const redeemShare = async (tokenId: bigint) => {
    if (!wallet || !window.ethereum || !contractsReady) return;
    setBusy(true);
    try {
      if (!isMainnet) {
        await switchToMainnet();
        throw new Error("Switch to BNB Mainnet, then review and submit the redeem again.");
      }
      if (!await publicClient.readContract({ address: addresses.redeem, abi: redeemAbi, functionName: "isOpen" })) throw new Error("Redemption is still closed on-chain.");
      const walletClient = await getWalletClient(window.ethereum, wallet);
      const { request } = await publicClient.simulateContract({
        address: addresses.redeem,
        abi: redeemAbi,
        functionName: "redeem",
        args: [tokenId],
        account: wallet,
      });
      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Redeem transaction reverted. Check BscScan before retrying.");
      setNotice({ kind: "success", text: `Share #${tokenId} redeemed for 1,000 $SUPERGENT.` });
      await refresh(wallet);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const closeMenu = () => setMobileMenu(false);

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="Supergent home">
          <span className="brand-mark"><Leaf size={17} strokeWidth={2.3} /></span>
          <span>supergent<span className="brand-dot">.</span></span>
          <span className="brand-divider" />
          <span className="brand-caption">GENESIS SHARES</span>
        </a>
        <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
          {mobileMenu ? <X size={19} /> : <Menu size={19} />}
        </button>
        <nav className={mobileMenu ? "nav-links nav-open" : "nav-links"}>
          <a href="#mint" onClick={closeMenu}>Mint</a>
          <a href="#collection" onClick={closeMenu}>Collection</a>
          <a href="#tokenomics" onClick={closeMenu}>Tokenomics</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
        </nav>
        <div className="header-actions">
          <div className="network-pill"><span className="live-dot" /> MAINNET</div>
          <button className="connect-button" onClick={wallet ? () => void refresh(wallet) : connectWallet} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}
            {wallet ? truncate(wallet) : "Connect wallet"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> AGENT-NATIVE ON BNB CHAIN <span className="eyebrow-tag">LIVE</span></div>
            <h1>One Agent ID.<br /><span>One Genesis Share.</span></h1>
            <p className="hero-subtitle">A permanent mark for the autonomous web. Claim your first share for gas only, then shape the network one mint at a time.</p>
            <div className="hero-points">
              <div><span className="point-index">01</span><span>First share is free</span></div>
              <div><span className="point-index">02</span><span>Up to 10 shares per Agent ID</span></div>
              <div><span className="point-index">03</span><span>1,000 $SUPERGENT per share at redeem</span></div>
            </div>
            <div className="hero-actions">
              <a className="button-primary" href="#mint">Explore mint <ArrowDownRight size={17} /></a>
              <a className="button-quiet" href="#how-it-works">How it works <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <div className="hero-art" aria-label="Supergent Genesis Share artwork">
            <div className="art-orbit orbit-large" />
            <div className="art-orbit orbit-small" />
            <div className="art-cross cross-a" />
            <div className="art-cross cross-b" />
            <div className="share-card">
              <div className="share-card-top"><span>SG / GENESIS</span><span className="share-card-number">001</span></div>
              <div className="share-figure"><div className="figure-core"><Fingerprint size={70} strokeWidth={0.7} /></div><span className="figure-ring ring-one" /><span className="figure-ring ring-two" /><span className="figure-spark spark-one" /><span className="figure-spark spark-two" /></div>
              <div className="share-card-bottom"><div><span className="micro-label">COLLECTION</span><strong>Genesis Share</strong></div><div className="share-chip">AGENT ID<br /><b>VERIFIED</b></div></div>
            </div>
            <div className="art-coordinate coord-a">BNB / 56</div>
            <div className="art-coordinate coord-b">01 — 10</div>
            <div className="art-caption"><span className="caption-dot" /> A NEW CLASS OF OWNERSHIP</div>
          </div>
          <div className="hero-bottomline"><span>01 / IDENTITY</span><span>02 / PARTICIPATION</span><span>03 / REDEMPTION</span><span className="scroll-cue">SCROLL TO EXPLORE <ChevronDown size={13} /></span></div>
        </section>

        <section className="metric-strip section-wrap" aria-label="Protocol counters">
          <div className="metric-intro"><span className="tiny-kicker">THE GENESIS RUN</span><strong>Small supply.<br />Built for agents.</strong></div>
          <Metric label="UNIQUE AGENT IDS" value={uniqueMinters === null ? "—" : `${formatInt(uniqueMinters)} / 1,000`} detail="early bird threshold" />
          <Metric label="SHARES MINTED" value={totalMinted === null ? "—" : `${formatInt(totalMinted)} / 20,160`} detail="genesis supply" />
          <Metric label="TOKEN REDEEMED" value={tokenSupply === null ? "—" : `${Number(formatEther(tokenSupply)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} detail="of 20,160,000 redeem allocation" />
          <div className="metric-status"><span className="status-icon"><Activity size={16} /></span><span><b>Network status</b><small>{chainReadConfirmed ? "Reading BNB Mainnet" : "Connecting to BNB Mainnet"}</small></span><span className="status-pulse" /></div>
        </section>

        <section id="mint" className="mint-section section-wrap">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE MINT SEQUENCE</div><h2>Earn your place<br /><em>in the genesis.</em></h2></div>
            <p>Live on BNB Mainnet. Connect an EVM wallet to inspect your Agent ID, or use the agent guide for direct contract calls from Binance Agentic Wallet.</p>
          </div>
          <div className="mint-layout">
            <div className="mint-panel panel">
              <div className="panel-top"><div className="panel-name"><span className="panel-icon"><Sparkles size={16} /></span><span>MINT CONSOLE <small>AGENT ID GATE</small></span></div><span className="panel-live"><span className="live-dot" /> LIVE READ</span></div>
              <div className="console-command"><span className="console-prompt">$</span><span>supergent mint <i>--genesis-share</i></span><span className="console-cursor" /></div>
              <div className="console-divider" />
              {!contractsReady ? (
                <div className="deployment-state">
                  <div className="empty-orb"><LockKeyhole size={20} /></div>
                  <div><strong>Mainnet configuration unavailable</strong><p>Verify the published contract configuration before interacting.</p></div>
                </div>
              ) : !wallet ? (
                <div className="connect-state"><div className="empty-orb"><Wallet size={19} /></div><strong>Connect to verify your Agent ID</strong><p>Inspect your mainnet status with an EVM wallet. Agentic Wallet agents call the contract directly using /llms.txt.</p><button className="button-primary wide" onClick={connectWallet} disabled={busy}>Connect EVM wallet <ArrowUpRight size={16} /></button></div>
              ) : !isMainnet ? (
                <div className="connect-state"><div className="empty-orb"><ShieldCheck size={19} /></div><strong>Switch to BNB Mainnet</strong><p>Genesis Shares use BNB Smart Chain, chain ID 56. Review every transaction in your wallet.</p><button className="button-primary wide" onClick={() => void switchToMainnet()}>Switch network <ArrowUpRight size={16} /></button></div>
              ) : agentId === null ? (
                <div className="connect-state"><div className="empty-orb"><Fingerprint size={20} /></div><strong>No Agent ID found</strong><p>This address does not currently hold an Agent ID in the official SPACE ID registry on BNB Mainnet.</p><button className="button-outline wide" onClick={() => void refresh(wallet)} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" size={16} /> : <Activity size={16} />} Recheck address</button></div>
              ) : (
                <>
                  <div className="identity-row"><div className="agent-avatar"><Fingerprint size={20} /></div><div className="identity-info"><span>VERIFIED AGENT ID</span><strong>{agentHandle}.ai</strong></div><span className="verified-badge"><Check size={13} /> VERIFIED</span></div>
                  <div className="mint-progress-row"><span>YOUR SHARE ALLOCATION</span><strong>{formatInt(minted ?? 0n)}<i> / 10</i></strong></div>
                  <div className="progress-track"><span style={{ width: `${Math.min(Number(minted ?? 0n) * 10, 100)}%` }} /></div>
                  <div className="mint-facts">
                    <div><span>NEXT SHARE</span><b className={nextPrice === 0n ? "price-free" : ""}>{currentPriceLabel}</b><small>{nextPrice === 0n ? "gas only" : uniqueMinters !== null && uniqueMinters < 1000n ? "early bird" : "standard era"}</small></div>
                    <div><span>REDEEM VALUE</span><b>{formatInt((minted ?? 0n) - (redeemedCount ?? 0n))} <small>× 1,000</small></b><small>{redeemStatus(redeemOpen, redeemOpenTime)}</small></div>
                    <div><span>EST. NETWORK FEE</span><b>{gasEstimate === null ? "—" : `${Number(formatEther(gasEstimate)).toFixed(5)} BNB`}</b><small>paid to validators</small></div>
                  </div>
                  <button className="button-primary mint-action" onClick={() => void mintShare()} disabled={busy || !contractsReady || (minted ?? 10n) >= 10n || (totalMinted ?? 20_160n) >= 20_160n}>
                    {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={16} />}
                    {(minted ?? 0n) === 0n ? "Claim your free share" : `Mint next share · ${currentPriceLabel}`}
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="gas-note"><ShieldCheck size={13} /> You pay the share price plus BNB network gas. Check the wallet preview before approving.</p>
                </>
              )}
              <div className="console-footer"><span>NETWORK <b>BNB MAINNET</b></span><span>CHAIN ID <b>56</b></span><span>STATUS <b>{chainReadConfirmed ? "LIVE" : "CONNECTING"}</b></span></div>
            </div>
            <div className="mint-side">
              <div className="rule-card"><span className="rule-index">01</span><div><h3>First share, free.</h3><p>Your genesis share costs 0 BNB. You only cover the network gas needed to write the mint to chain.</p></div><span className="rule-mark">01</span></div>
              <div className="rule-card"><span className="rule-index">02</span><div><h3>Up to ten per ID.</h3><p>Early participants pay 0.001 BNB for shares 2–10. After 1,000 unique Agent IDs, the price becomes 0.002 BNB.</p></div><span className="rule-mark">10</span></div>
              <div className="rule-card"><span className="rule-index">03</span><div><h3>Redeem, when open.</h3><p>Each share can redeem 1,000 $SUPERGENT. Target: {mainnetConfig.redeemDateLabel}. Access always follows the on-chain controller.</p></div><span className="rule-mark"><LockKeyhole size={17} /></span></div>
              <div className="agent-callout"><div className="callout-icon"><Fingerprint size={19} /></div><div><b>Building with an agent?</b><p>Read the plain-text integration guide and call the contract directly from your Agentic Wallet.</p><a href="/llms.txt" target="_blank" rel="noreferrer">Open agent guide <ArrowUpRight size={13} /></a></div></div>
            </div>
          </div>
        </section>

        <section className="redeem-schedule section-wrap" aria-label="Redemption schedule">
          <div className="panel redeem-schedule-panel">
            <div><div className="eyebrow"><span className="eyebrow-line" /> REDEMPTION SCHEDULE</div><h2>{mainnetConfig.redeemDateLabel}</h2><p>Only the original mint wallet can redeem.</p></div>
            <div className="redeem-countdown"><span className="micro-label">{redeemScheduleConfirmed ? "COUNTDOWN TO ON-CHAIN SCHEDULE" : "COUNTDOWN TO OWNER'S TARGET"}</span><strong aria-label="Time until planned redemption">{formatCountdown(secondsToRedeem)}</strong><p>{redeemOpen ? "On-chain redemption is OPEN." : redeemOpenTime === null ? "Checking on-chain redemption status…" : redeemScheduleConfirmed ? "On-chain redemption is CLOSED until the scheduled time." : "On-chain redemption is CLOSED. Target date is not configured on-chain yet."}</p><small>The countdown does not unlock redemption; contract status is authoritative.</small></div>
          </div>
        </section>

        <section id="collection" className="collection-section section-wrap">
          <div className="section-heading compact-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR PROOF OF PARTICIPATION</div><h2>Genesis <em>collection.</em></h2></div>
            <button className="text-action" onClick={() => void refresh(wallet)} disabled={!contractsReady || refreshing}>{refreshing ? <LoaderCircle className="spin" size={14} /> : <Activity size={14} />} Sync from chain</button>
          </div>
          <div className="collection-board panel">
            <div className="board-head"><span>SHARE / TOKEN ID</span><span>ORIGIN AGENT</span><span>CURRENT HOLDER</span><span>REDEMPTION</span><span>ACTION</span></div>
            {shares.length ? shares.map((share) => {
              const isOriginWallet = wallet?.toLowerCase() === share.originWallet.toLowerCase();
              return <div className="share-row" key={share.tokenId.toString()}>
                <span className="share-row-id"><span className="mini-share"><Leaf size={12} /></span> Genesis #{formatInt(share.tokenId)}</span>
                <span className="mono-muted">{agentHandle ? `${agentHandle}.ai` : "—"}</span>
                <span className="mono-muted">{truncate(share.owner)}</span>
                <span className={share.redeemed ? "state-pill redeemed" : "state-pill pending"}>{share.redeemed ? "REDEEMED" : "RESERVED"}</span>
                <span>{share.redeemed ? <span className="muted-action">Complete</span> : isOriginWallet && redeemOpen ? <button className="small-action" onClick={() => void redeemShare(share.tokenId)} disabled={busy}>Redeem <ArrowUpRight size={12} /></button> : <span className="muted-action">{isOriginWallet ? "Coming soon" : "Origin wallet only"}</span>}</span>
              </div>;
            }) : (
              <div className="empty-collection"><div className="empty-orb"><Leaf size={18} /></div><strong>{contractsReady && wallet ? "No Genesis Shares yet" : "Your shares will appear here"}</strong><p>{contractsReady && wallet ? "Mint a share to create your first on-chain entry." : "Connect an Agent ID wallet to view its mainnet shares and original mint rights."}</p></div>
            )}
            <div className="collection-foot"><span><span className="live-dot" /> LIVE CONTRACT DATA</span><span>Transferable NFT · redeem rights stay with original wallet</span></div>
          </div>
        </section>

        <section id="how-it-works" className="activity-section section-wrap">
          <div className="activity-grid">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> THE NETWORK IN MOTION</div>
              <h2>Small actions.<br /><em>On-chain history.</em></h2>
              <p className="section-blurb">Every Genesis Share is a permanent receipt of participation. Mint events and Agent ID progress are read directly from the contract.</p>
              <div className="timeline-list">
                <div className="timeline-item"><span className="timeline-no">01</span><span className="timeline-line" /><span className="timeline-copy"><b>Verify your identity</b><small>Agent ID ownership is checked against the registry.</small></span></div>
                <div className="timeline-item"><span className="timeline-no">02</span><span className="timeline-line" /><span className="timeline-copy"><b>Mint a Genesis Share</b><small>One NFT per on-chain transaction, max ten per Agent ID.</small></span></div>
                <div className="timeline-item"><span className="timeline-no">03</span><span className="timeline-line" /><span className="timeline-copy"><b>Redeem after launch</b><small>Original mint wallet receives 1,000 tokens once the window opens.</small></span></div>
              </div>
            </div>
            <div className="activity-panel panel">
              <div className="panel-top"><div className="panel-name"><span className="panel-icon"><Activity size={16} /></span><span>RECENT MINTS <small>ON-CHAIN ACTIVITY</small></span></div><span className="panel-live"><span className="live-dot" /> {contractsReady ? "SYNCED" : "AWAITING DATA"}</span></div>
              <div className="activity-head"><span>AGENT</span><span>SHARE</span><span>PRICE</span><span>TX</span></div>
              {recent.length ? recent.map((row) => <div className="activity-row" key={row.transactionHash}>
                <span className="agent-short">ID-{row.agentId.toString().slice(-5)}</span>
                <span className="activity-share">#{formatInt(row.tokenId)}</span>
                <span className={row.price === 0n ? "activity-free" : "activity-price"}>{row.price === 0n ? "FREE" : `${formatEther(row.price)} BNB`}</span>
                <a className="tx-link" href={`${mainnetConfig.explorerUrl}/tx/${row.transactionHash}`} target="_blank" rel="noreferrer">View <ExternalLink size={12} /></a>
              </div>) : <div className="activity-empty"><span className="empty-scan"><Activity size={22} /></span><b>No mint events indexed yet</b><small>{contractsReady ? "First transaction will appear here." : "Connect deployed contract addresses to load on-chain events."}</small></div>}
              <div className="panel-bottom-note"><span>MAINNET EVENT FEED</span><span>READ-ONLY VIEW <ArrowUpRight size={12} /></span></div>
            </div>
          </div>
        </section>

        <section className="leader-section section-wrap">
          <div className="leader-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> AGENT CONTRIBUTION</div><h2>Share the <em>signal.</em></h2></div><span className="leader-note">TOP AGENT IDS / MAINNET</span></div>
          <div className="leader-table panel">
            <div className="leader-header"><span>RANK</span><span>AGENT ID</span><span>SHARES MINTED</span><span>NETWORK</span></div>
            {leaders.length ? leaders.map((leader, index) => <div className="leader-row" key={leader.agentId.toString()}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><span className="leader-agent"><span className="leader-avatar"><Fingerprint size={14} /></span>ID-{leader.agentId.toString().slice(-6)}</span><span className="leader-count">{formatInt(leader.minted)} <small>SHARES</small></span><span className="leader-network"><span className="live-dot" /> ACTIVE</span></div>) : <div className="leader-empty">Leaderboard appears after contract events are available.</div>}
          </div>
        </section>

        <section id="tokenomics" className="tokenomics-section section-wrap">
          <div className="tokenomics-main">
            <div className="eyebrow"><span className="eyebrow-line" /> FIXED SUPPLY / NO TEAM ALLOCATION</div>
            <h2>Built around<br /><em>participation.</em></h2>
            <p className="section-blurb">$SUPERGENT has a hard cap of 21 million. The mint contract reserves 96% for Genesis Share redemption and 4% for liquidity.</p>
            <div className="tokenomics-legend"><div><i className="legend-green" /><span><b>96%</b> share redemption</span><strong>20,160,000</strong></div><div><i className="legend-dim" /><span><b>4%</b> liquidity</span><strong>840,000</strong></div></div>
          </div>
          <div className="token-visual panel">
            <div className="token-ring-wrap"><div className="token-ring"><div className="token-center"><Leaf size={25} /><b>SG</b></div></div><span className="ring-label ring-label-a">96% / HOLDERS</span><span className="ring-label ring-label-b">04% / LIQUIDITY</span><span className="ring-node node-a" /><span className="ring-node node-b" /></div>
            <div className="token-total"><span>FIXED MAX SUPPLY</span><strong>21,000,000</strong><small>$SUPERGENT · 18 DECIMALS</small></div>
            <div className="token-ratio"><span>ONE GENESIS SHARE</span><b>1,000 <i>$SUPERGENT</i></b><small>redeemable once the owner opens the window</small></div>
          </div>
        </section>

        <section className="roadmap-section section-wrap">
          <div className="roadmap-title"><div className="eyebrow"><span className="eyebrow-line" /> THE GENESIS JOURNEY</div><h2>Four steps.<br /><em>No shortcuts.</em></h2><p>Genesis mint is live on BNB Mainnet. Redemption target: {mainnetConfig.redeemDateLabel}. On-chain status determines availability.</p></div>
          <div className="roadmap-track">
            <RoadmapItem number="01" title="Protocol testing" detail="Contract scenarios · mint rules · redemption checks" state="COMPLETE" />
            <RoadmapItem number="02" title="Mainnet mint" detail="Verified contracts · Agent ID gate · genesis shares" state="LIVE" active />
            <RoadmapItem number="03" title="Token launch" detail="$SUPERGENT supply and liquidity allocation" state="PLANNED" />
            <RoadmapItem number="04" title="Redeem opens" detail={`${mainnetConfig.redeemDateLabel} · subject to on-chain schedule`} state={redeemOpen ? "OPEN" : redeemScheduleConfirmed ? "SCHEDULED" : "OWNER TARGET"} />
          </div>
        </section>

        <section id="faq" className="faq-section section-wrap">
          <div className="faq-title"><div className="eyebrow"><span className="eyebrow-line" /> CLEAR BY DESIGN</div><h2>Good questions.<br /><em>Plain answers.</em></h2><p>Review the details before interacting with any contract.</p></div>
          <div className="faq-list">
            <Faq q="Can I transfer or sell the NFT?" a="Yes. The ERC-721 is transferable, but redemption rights stay with the originating Agent ID wallet. Only the original mint wallet can redeem, even after transferring the NFT away. Buying or receiving a Genesis Share on a secondary market does not grant a claim to $SUPERGENT. The NFT is marked redeemed, not burned." />
            <Faq q="Is the first share really free?" a="The first share for each Agent ID has a mint price of 0 BNB. You still need to pay the BNB network gas fee for the transaction. The mint is limited to one free share per Agent ID." />
            <Faq q="When does early-bird pricing end?" a="Paid shares cost 0.001 BNB while fewer than 1,000 unique Agent IDs have minted. After the counter reaches 1,000, paid shares cost 0.002 BNB. A new Agent ID's first share remains free." />
            <Faq q="When can I redeem my shares?" a={`The owner's target is ${mainnetConfig.redeemDateLabel}, timestamp 1796644800. ${redeemOpenTime === null ? "On-chain status is loading." : redeemOpen ? "The controller currently reports redemption open." : redeemScheduleConfirmed ? "The controller is scheduled for that time; redemption is closed before it." : "The controller currently keeps redemption closed and has not been configured for this target date yet."} The countdown alone does not unlock anything. Only the original mint wallet can redeem, subject to the controller's on-chain state.`} />
            <Faq q="Can Binance Agentic Wallet connect to this website?" a="The Binance Agentic Wallet does not connect to browser dApps in this flow. An AI agent can call the mainnet contract directly using /llms.txt. EVM browser wallets can inspect status and request transactions through their own confirmation screen." />
            <Faq q="What are the risks?" a="Supergent is an independent experimental protocol, not affiliated with Binance. No profit, financial return, token market value, or liquidity is guaranteed. Gas and transactions are irreversible. Buying a transferred NFT does not grant token redemption rights. The owner can change redemption timing, controller links, metadata and proceeds settings, and mint the one-time liquidity allocation. Review the verified contracts before interacting." />
          </div>
        </section>

        <section className="contract-section section-wrap">
          <div className="contract-copy"><div className="eyebrow"><span className="eyebrow-line" /> VERIFY BEFORE YOU INTERACT</div><h2>Open contracts.<br /><em>Clear permissions.</em></h2><p>Supergent never asks for a seed phrase, unlimited approval, or an off-chain signature to mint. Verify addresses on BscScan before any mainnet interaction.</p></div>
          <div className="contract-card panel"><div className="contract-card-head"><span>NETWORK CONTRACTS</span><span className="network-pill"><span className="live-dot" /> BNB MAINNET</span></div>
            <ContractAddress label="Agent ID Registry · SPACE ID" address={addresses.registry} copied={copied} onCopy={copyAddress} />
            <ContractAddress label="Genesis Share · ERC-721" address={addresses.share} copied={copied} onCopy={copyAddress} />
            <ContractAddress label="$SUPERGENT · ERC-20" address={addresses.token} copied={copied} onCopy={copyAddress} />
            <ContractAddress label="Redeem Controller" address={addresses.redeem} copied={copied} onCopy={copyAddress} />
            <div className="contract-disclaimer"><ShieldCheck size={14} /> BNB Smart Chain · chain ID 56. Verify each contract on BscScan. No approvals or private keys are needed to mint.</div>
          </div>
        </section>
      </main>

      <footer className="footer section-wrap">
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><Leaf size={16} /></span><span>supergent<span className="brand-dot">.</span></span></a>
        <span className="footer-note">Independent experiment. Not affiliated with Binance. No returns or liquidity guaranteed.</span>
        <div className="footer-links"><a href="/llms.txt">Agent guide <ArrowUpRight size={12} /></a><a href={mainnetConfig.explorerUrl} target="_blank" rel="noreferrer">BscScan <ExternalLink size={12} /></a><a href="https://x.com/ai_supergent" target="_blank" rel="noreferrer">Official X <ArrowUpRight size={12} /></a><a href="#faq">Disclaimer <CircleHelp size={12} /></a></div>
        <span className="footer-copy">© 2026 SUPERGENT · MAINNET LIVE</span>
      </footer>

      {notice && <div className={`toast toast-${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={15} /> : notice.kind === "error" ? <CircleHelp size={15} /> : <Activity size={15} />}</span><p>{notice.text}</p><button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}
      <a className="floating-sync" href="#mint" onClick={() => wallet && void refresh(wallet)} aria-label="Go to mint console"><Sparkles size={17} /></a>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function RoadmapItem({ number, title, detail, state, active = false }: { number: string; title: string; detail: string; state: string; active?: boolean }) {
  return <div className={`roadmap-item ${active ? "roadmap-active" : ""}`}><div className="roadmap-marker"><span>{active ? <span className="live-dot" /> : number}</span></div><div className="roadmap-state">{state}</div><h3>{title}</h3><p>{detail}</p></div>;
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return <div className={`faq-item ${open ? "faq-open" : ""}`}><button onClick={() => setOpen(!open)} aria-expanded={open}><span>{q}</span><span className="faq-plus">{open ? "−" : "+"}</span></button>{open && <p>{a}</p>}</div>;
}

function ContractAddress({ label, address, copied, onCopy }: { label: string; address: string; copied: boolean; onCopy: (address: string) => void }) {
  return <div className="contract-address"><span>{label}</span><div><a href={`${mainnetConfig.explorerUrl}/address/${address}#code`} target="_blank" rel="noreferrer"><code>{address}</code></a><button onClick={() => void onCopy(address)} aria-label={`Copy ${label}`}>{copied ? <Check size={13} /> : <Copy size={13} />}</button></div></div>;
}

function redeemStatus(isOpen: boolean, timestamp: bigint | null) {
  if (isOpen) return "redeem window open";
  if (timestamp === null || timestamp === ((1n << 256n) - 1n)) return "redeem coming soon";
  if (timestamp === mainnetConfig.plannedRedeemOpenTime) return `opens ${mainnetConfig.redeemDateLabel}`;
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return "redeem closed";
  const day = date.getUTCDate();
  const month = date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return `opens ${day} ${month} ${date.getUTCFullYear()}, ${time} UTC`;
}

function formatCountdown(seconds: number) {
  if (seconds === 0) return "Target time reached";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds % 86_400 / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export default App;
