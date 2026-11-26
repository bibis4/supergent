// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The subset of the SPACE ID Agent ID registry used by Supergent.
/// The mainnet registry exposes the same ERC-721-compatible functions.
interface IAgentIdRegistry {
    function balanceOf(address owner) external view returns (uint256);

    function handleOf(address owner) external view returns (string memory);

    function ownerOf(uint256 tokenId) external view returns (address);
}
