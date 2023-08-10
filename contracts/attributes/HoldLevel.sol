// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/SoulAttribute.sol";

contract HoldLevel is SoulAttribute, Ownable {
    string public constant name = "Hold level";
    string public constant description = "Represents soul's WBT hold level on WhiteBIT";

    uint8 private constant MIN_LEVEL = 1;
    uint8 private constant MAX_LEVEL = 11;

    function assertIsSettable(address operator, uint256, bytes20 value) external view {
        require(operator == owner(), "HoldLevel: permission denied");
        if (value == EMPTY_VALUE) {
            return;
        }

        uint160 uintValue = uint160(value);
        require(uintValue >= MIN_LEVEL && uintValue <= MAX_LEVEL, "HoldLevel: level should be in range [1, 11]");
    }
}
