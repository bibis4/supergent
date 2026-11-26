// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Testnet-only Agent ID registry. It intentionally mirrors the
/// read surface Supergent uses from the production SPACE ID registry.
contract MockAgentID is ERC721 {
    mapping(address => string) private _handles;
    mapping(bytes32 => bool) private _handleUsed;

    error AlreadyHasAgentId();
    error HandleAlreadyUsed();
    error InvalidHandle();

    constructor() ERC721("Mock Agent ID", "AI") {}

    function mintDummy(address to, string calldata handle) external returns (uint256 tokenId) {
        if (balanceOf(to) != 0) revert AlreadyHasAgentId();
        if (bytes(handle).length == 0) revert InvalidHandle();

        bytes32 key = keccak256(bytes(handle));
        if (_handleUsed[key]) revert HandleAlreadyUsed();

        tokenId = uint256(key);
        _handleUsed[key] = true;
        _handles[to] = handle;
        _safeMint(to, tokenId);
    }

    function mintBatchDummy(address[] calldata recipients, string[] calldata handles) external {
        if (recipients.length != handles.length) revert InvalidHandle();
        for (uint256 i; i < recipients.length; ++i) {
            address recipient = recipients[i];
            string calldata handle = handles[i];
            if (balanceOf(recipient) != 0) revert AlreadyHasAgentId();
            if (bytes(handle).length == 0) revert InvalidHandle();

            bytes32 key = keccak256(bytes(handle));
            if (_handleUsed[key]) revert HandleAlreadyUsed();

            uint256 tokenId = uint256(key);
            _handleUsed[key] = true;
            _handles[recipient] = handle;
            _safeMint(recipient, tokenId);
        }
    }

    function handleOf(address owner) external view returns (string memory) {
        return _handles[owner];
    }

    function ownerOfHandle(string calldata handle) external view returns (address) {
        return ownerOf(uint256(keccak256(bytes(handle))));
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Agent IDs are soulbound even in the mock registry.
        if (from != address(0) && to != address(0)) revert ERC721NonTransferable();
        return super._update(to, tokenId, auth);
    }

    error ERC721NonTransferable();
}
