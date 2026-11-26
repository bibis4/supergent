// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SupergentShare} from "./SupergentShare.sol";
import {SupergentToken} from "./SupergentToken.sol";

/// @notice Redeems an origin wallet's share into SUPERGENT after the owner opens the window.
contract SupergentRedeem is Ownable, ReentrancyGuard {
    uint256 public constant REWARD_PER_NFT = 1_000 ether;

    SupergentShare public immutable share;
    SupergentToken public immutable token;
    uint256 public redeemOpenTime = type(uint256).max;

    error RedeemNotOpen();

    event RedeemOpenTimeSet(uint256 indexed redeemOpenTime);
    event Redeemed(uint256 indexed tokenId, uint256 indexed agentId, address indexed originWallet, uint256 amount);

    constructor(address share_, address token_) Ownable(msg.sender) {
        share = SupergentShare(share_);
        token = SupergentToken(token_);
    }

    function setRedeemOpenTime(uint256 timestamp) external onlyOwner {
        redeemOpenTime = timestamp;
        emit RedeemOpenTimeSet(timestamp);
    }

    function isOpen() public view returns (bool) {
        return block.timestamp >= redeemOpenTime;
    }

    function redeem(uint256 tokenId) external nonReentrant {
        if (!isOpen()) revert RedeemNotOpen();
        uint256 agentId = share.originAgentId(tokenId);
        share.redeemFor(tokenId, msg.sender);
        token.mintRedeem(msg.sender, REWARD_PER_NFT);
        emit Redeemed(tokenId, agentId, msg.sender, REWARD_PER_NFT);
    }

    function redeemMany(uint256[] calldata tokenIds) external nonReentrant {
        if (!isOpen()) revert RedeemNotOpen();
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            uint256 agentId = share.originAgentId(tokenId);
            share.redeemFor(tokenId, msg.sender);
            token.mintRedeem(msg.sender, REWARD_PER_NFT);
            emit Redeemed(tokenId, agentId, msg.sender, REWARD_PER_NFT);
        }
    }
}
