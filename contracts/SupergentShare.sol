// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IAgentIdRegistry} from "./interfaces/IAgentIdRegistry.sol";

/// @title Supergent Genesis Share
/// @notice ERC-721 shares gated by ownership of a SPACE ID Agent ID.
/// Redeem rights are intentionally bound to the wallet that minted the share,
/// not to the current NFT owner.
contract SupergentShare is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 20_160;
    uint256 public constant MAX_PER_AGENT_ID = 10;
    uint256 public constant EARLY_BIRD_LIMIT = 1_000;
    uint256 public constant PRICE_EARLY = 0.001 ether;
    uint256 public constant PRICE_FLAT = 0.002 ether;

    IAgentIdRegistry public immutable registry;
    address public proceedsWallet;
    address public redeemContract;

    uint256 public totalMinted;
    uint256 public uniqueMinterCount;
    uint256 private _nextTokenId = 1;

    mapping(uint256 agentId => uint256 count) public mintedCount;
    mapping(uint256 agentId => uint256 count) public redeemedCount;
    mapping(uint256 agentId => uint256[] tokenIds) private _agentTokenIds;
    mapping(uint256 tokenId => uint256 agentId) public originAgentId;
    mapping(uint256 tokenId => address wallet) public originWallet;
    mapping(uint256 tokenId => bool) public redeemed;

    string private _baseTokenURI;

    error NoAgentId();
    error AgentShareLimitReached();
    error SupplyExhausted();
    error WrongPayment(uint256 expected, uint256 received);
    error RefundFailed();
    error OnlyRedeemContract();
    error ZeroAddress();
    error TokenAlreadyRedeemed();
    error NotOriginWallet();
    error ProceedsWalletNotSet();
    error WithdrawalFailed();

    event ShareMinted(uint256 indexed agentId, uint256 indexed tokenId, address indexed wallet, uint256 price);
    event RedeemContractSet(address indexed redeemContract);
    event ProceedsWalletSet(address indexed proceedsWallet);
    event ShareRedeemed(uint256 indexed tokenId, uint256 indexed agentId, address indexed originWallet);

    constructor(address registry_, address proceedsWallet_, string memory baseURI_)
        ERC721("Supergent Genesis Share", "SGSHARE")
        Ownable(msg.sender)
    {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IAgentIdRegistry(registry_);
        proceedsWallet = proceedsWallet_;
        _baseTokenURI = baseURI_;
    }

    /// @notice Mint one share. The first share for an Agent ID is gas-only.
    function mint() external payable nonReentrant returns (uint256 tokenId) {
        uint256 agentId = _resolveAgentId(msg.sender);
        uint256 agentMinted = mintedCount[agentId];
        if (agentMinted >= MAX_PER_AGENT_ID) revert AgentShareLimitReached();
        if (totalMinted >= MAX_SUPPLY) revert SupplyExhausted();

        uint256 price = priceNextShare(agentId);
        if (price == 0) {
            if (msg.value != 0) revert WrongPayment(0, msg.value);
        } else if (msg.value < price) {
            revert WrongPayment(price, msg.value);
        }

        if (agentMinted == 0) {
            uniqueMinterCount += 1;
        }

        mintedCount[agentId] = agentMinted + 1;
        totalMinted += 1;
        tokenId = _nextTokenId++;
        originAgentId[tokenId] = agentId;
        originWallet[tokenId] = msg.sender;
        _agentTokenIds[agentId].push(tokenId);
        _safeMint(msg.sender, tokenId);

        if (msg.value > price) {
            (bool refunded,) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refunded) revert RefundFailed();
        }

        emit ShareMinted(agentId, tokenId, msg.sender, price);
    }

    function priceNextShare(uint256 agentId) public view returns (uint256) {
        if (mintedCount[agentId] == 0) return 0;
        return uniqueMinterCount < EARLY_BIRD_LIMIT ? PRICE_EARLY : PRICE_FLAT;
    }

    function mintedCountOf(uint256 agentId) external view returns (uint256) {
        return mintedCount[agentId];
    }

    function shareTokenIds(uint256 agentId) external view returns (uint256[] memory) {
        return _agentTokenIds[agentId];
    }

    function redeemableOf(uint256 agentId) external view returns (uint256) {
        return mintedCount[agentId] - redeemedCount[agentId];
    }

    /// @notice Resolve the caller's Agent ID using the registry's authoritative handle.
    function agentIdForWallet(address wallet) public view returns (uint256 agentId, string memory handle) {
        if (registry.balanceOf(wallet) == 0) revert NoAgentId();
        handle = registry.handleOf(wallet);
        if (bytes(handle).length == 0) revert NoAgentId();
        agentId = uint256(keccak256(bytes(handle)));
        if (registry.ownerOf(agentId) != wallet) revert NoAgentId();
    }

    function setRedeemContract(address redeemContract_) external onlyOwner {
        if (redeemContract_ == address(0)) revert ZeroAddress();
        redeemContract = redeemContract_;
        emit RedeemContractSet(redeemContract_);
    }

    function setProceedsWallet(address proceedsWallet_) external onlyOwner {
        if (proceedsWallet_ == address(0)) revert ZeroAddress();
        proceedsWallet = proceedsWallet_;
        emit ProceedsWalletSet(proceedsWallet_);
    }

    function withdrawProceeds() external onlyOwner nonReentrant {
        if (proceedsWallet == address(0)) revert ProceedsWalletNotSet();
        (bool sent,) = payable(proceedsWallet).call{value: address(this).balance}("");
        if (!sent) revert WithdrawalFailed();
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    /// @dev Called only by the redeem contract after it has checked the open time.
    function redeemFor(uint256 tokenId, address caller) external {
        if (msg.sender != redeemContract) revert OnlyRedeemContract();
        if (originWallet[tokenId] != caller) revert NotOriginWallet();
        if (redeemed[tokenId]) revert TokenAlreadyRedeemed();

        redeemed[tokenId] = true;
        redeemedCount[originAgentId[tokenId]] += 1;
        emit ShareRedeemed(tokenId, originAgentId[tokenId], caller);
    }

    function _resolveAgentId(address wallet) internal view returns (uint256 agentId) {
        (agentId,) = agentIdForWallet(wallet);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
