// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "interfaces/ISoulAttribute.sol";

/**
 * @title Abstract soul attribute
 * Contract with a predefined IERC165 methods, can be used for more simple attributes implementation.
 */
abstract contract SoulAttribute is ISoulAttribute {
    bytes20 internal constant EMPTY_VALUE = bytes20(uint160(0));
    bytes4 private constant IERC165_ID = type(IERC165).interfaceId;
    bytes4 private constant ISOUL_ATTRIBUTE_ID = type(ISoulAttribute).interfaceId;

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == IERC165_ID || interfaceId == ISOUL_ATTRIBUTE_ID;
    }
}
