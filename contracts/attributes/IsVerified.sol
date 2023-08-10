// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/SoulAttribute.sol";

contract IsVerified is SoulAttribute, Ownable {
    string public constant name = "Is verified";
    string public constant description = "Represents soul's current verification status on WhiteBIT";

    function assertIsSettable(address operator, uint256, bytes20 value) external view {
        require(operator == owner(), "IsVerified: permission denied");
        require(value == EMPTY_VALUE || value == bytes20(uint160(1)), "IsVerified: invalid value");
    }
}
