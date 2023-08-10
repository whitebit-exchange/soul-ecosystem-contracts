// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/SoulAttribute.sol";

contract HoldAmount is SoulAttribute, Ownable {
    string public constant name = "Hold amount";
    string public constant description = "Represents soul's WBT hold amount on WhiteBIT";

    uint160 private constant MAX_SUPPLY = 400_000_000_000000000000000000;

    function assertIsSettable(address operator, uint256, bytes20 value) external view {
        require(operator == owner(), "HoldAmount: permission denied");
        if (value == EMPTY_VALUE) {
            return;
        }

        require(uint160(value) <= MAX_SUPPLY, "HoldAmount: amount should not be greater than total supply");
    }

    function levelFromAmount(uint256 amount) external pure returns (uint8) {
        if (amount < 10_000000000000000000)
            return 0;

        if (amount < 200_000000000000000000)
            return 1;

        if (amount < 4_000_000000000000000000)
            return 2;

        if (amount < 10_000_000000000000000000)
            return 3;

        if (amount < 16_000_000000000000000000)
            return 4;

        if (amount < 30_000_000000000000000000)
            return 5;

        if (amount < 60_000_000000000000000000)
            return 6;

        if (amount < 100_000_000000000000000000)
            return 7;

        if (amount < 160_000_000000000000000000)
            return 8;

        if (amount < 2_000_000_000000000000000000)
            return 9;

        if (amount < 6_000_000_000000000000000000)
            return 10;

        return 11;
    }
}
