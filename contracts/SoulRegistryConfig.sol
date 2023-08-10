// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Soul registry config
 * Simple registry configuration that provides addresses assignment rules.
 * May be extended in future.
 */
contract SoulRegistryConfig is Ownable {
    uint8 private constant DEFAULT_MAX_ADDRESSES_PER_SOUL = 5;

    uint8 public maxAddressesPerSoul = DEFAULT_MAX_ADDRESSES_PER_SOUL;

    event MaxAddressesPerSoulUpdated(uint8 previousValue, uint8 newValue);

    /** Update addresses per soul limit */
    function updateMaxAddressesPerSoul(uint8 newValue) external onlyOwner {
        emit MaxAddressesPerSoulUpdated(maxAddressesPerSoul, newValue);
        maxAddressesPerSoul = newValue;
    }
}
