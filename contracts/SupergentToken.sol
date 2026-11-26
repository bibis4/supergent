// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SUPERGENT
/// @notice Fixed-cap token. 96% is reserved for NFT redemptions and 4% for liquidity.
contract SupergentToken is ERC20, ERC20Capped, Ownable {
    uint256 public constant MAX_SUPPLY = 21_000_000 ether;
    uint256 public constant REDEEM_ALLOCATION = 20_160_000 ether;
    uint256 public constant LIQUIDITY_ALLOCATION = 840_000 ether;

    address public redeemContract;
    uint256 public redeemedSupply;
    bool public liquidityMinted;

    error ZeroAddress();
    error OnlyRedeemContract();
    error RedeemAllocationExceeded();
    error LiquidityAlreadyMinted();

    event RedeemContractSet(address indexed redeemContract);
    event LiquidityMinted(address indexed recipient, uint256 amount);

    constructor() ERC20("Supergent", "SUPERGENT") ERC20Capped(MAX_SUPPLY) Ownable(msg.sender) {}

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }

    function setRedeemContract(address redeemContract_) external onlyOwner {
        if (redeemContract_ == address(0)) revert ZeroAddress();
        redeemContract = redeemContract_;
        emit RedeemContractSet(redeemContract_);
    }

    function mintRedeem(address recipient, uint256 amount) external {
        if (msg.sender != redeemContract) revert OnlyRedeemContract();
        if (redeemedSupply + amount > REDEEM_ALLOCATION) revert RedeemAllocationExceeded();
        redeemedSupply += amount;
        _mint(recipient, amount);
    }

    function mintLiquidity(address recipient) external onlyOwner {
        if (liquidityMinted) revert LiquidityAlreadyMinted();
        liquidityMinted = true;
        _mint(recipient, LIQUIDITY_ALLOCATION);
        emit LiquidityMinted(recipient, LIQUIDITY_ALLOCATION);
    }
}
