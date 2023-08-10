// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "interfaces/IERC165.sol";

/**
 * @title Soul feature interface
 * ISoulFeature is an interface for defining specific soul features.
 * Feature is something that can be attached to soul for providing an additional information about the soul.
 * Feature should be implemented as a particular contract, then it can be registered in appropriate feature registry.
 */
interface ISoulFeature is IERC165 {
    /**
     * Part of feature metadata, should only be used for view
     * @return feature name
     * @dev Usually defined as a public constant value
     */
    function name() external pure returns (string memory);

    /**
     * Part of feature metadata, should only be used for view
     * @return feature description
     * @dev Usually defined as a public constant value
     */
    function description() external pure returns (string memory);
}
