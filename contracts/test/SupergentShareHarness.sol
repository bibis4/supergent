// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SupergentShare} from "../SupergentShare.sol";

/// @dev Local-test-only state helper. Never used by deployment scripts.
contract SupergentShareHarness is SupergentShare {
    constructor(address registry_) SupergentShare(registry_, address(0), "ipfs://test/") {}

    function seedCounters(uint256 uniqueMinters, uint256 shares) external onlyOwner {
        uniqueMinterCount = uniqueMinters;
        totalMinted = shares;
    }

    function seedAgentState(uint256 agentId, uint256 agentShares, uint256 uniqueMinters, uint256 shares)
        external
        onlyOwner
    {
        mintedCount[agentId] = agentShares;
        uniqueMinterCount = uniqueMinters;
        totalMinted = shares;
    }
}
