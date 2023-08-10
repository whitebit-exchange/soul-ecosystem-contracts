// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/Context.sol";
import "interfaces/ISoulRegistry.sol";

/**
 * @title RetroDrop contract
 * Contains initial soul rewards for activities in testnet.
 */
contract RetroDrop is Context {
    ISoulRegistry private immutable soulRegistry;
    uint256 private immutable startAt;

    mapping(uint256 => uint256) public dropsBySoul;

    event Claimed(uint256 soulId, uint256 amount);

    constructor(ISoulRegistry _soulRegistry, uint256 _startAt) {
        soulRegistry = _soulRegistry;
        startAt = _startAt;
    }

    /**
     * Claim sender's soul reward.
     * Method will be available from timestamp specified in constructor.
     * Sender should be present in souls registry and have not empty reward.
     * After successful claim, reward by soul is being reset.
     */
    function claim() external {
        require(startAt <= block.timestamp, "RetroDrop: drop has not been started yet");

        uint256 soulId = soulRegistry.soulOf(_msgSender());
        require(soulId != 0, "RetroDrop: sender is not present in souls registry");

        uint256 dropAmount = dropsBySoul[soulId];
        require(dropAmount > 0, "RetroDrop: nothing to claim");

        delete dropsBySoul[soulId];

        payable(_msgSender()).transfer(dropAmount);
        emit Claimed(soulId, dropAmount);
    }
}
