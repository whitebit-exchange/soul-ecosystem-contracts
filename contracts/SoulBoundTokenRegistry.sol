// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "contracts/SoulFeatureRegistry.sol";
import "interfaces/ISoulBoundTokenCollection.sol";
import "interfaces/ISoulBoundTokenRegistry.sol";
import "interfaces/ISoulRegistry.sol";

/**
 * @title Soul bound token registry
 * Soul bound token registry interface implementation with a restricted access to state modification.
 */
contract SoulBoundTokenRegistry is SoulFeatureRegistry, ISoulBoundTokenRegistry {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    mapping(uint256 => EnumerableSet.Bytes32Set) private tokensBySoul;
    mapping(bytes32 => EnumerableSet.UintSet) private soulsByToken;

    event TokenBound(uint256 indexed soulId, bytes32 indexed token);

    constructor(ISoulRegistry soulRegistry) SoulFeatureRegistry(soulRegistry) {}

    /**
     * Bind a token from specified collection with specified id to specified soul.
     * Prechecks:
     * 1. Feature registry rules must be followed;
     * 2. Token collection validation should succeed;
     * 3. Token should not be already set to the specified soul.
     * @param soulId soul to use
     * @param collection token collection to use
     * @param tokenId collection token id to use
     */
    function bindToken(uint256 soulId, ISoulBoundTokenCollection collection, uint96 tokenId) external {
        assertIsSettable(collection, soulId);
        collection.assertIsBindable(_msgSender(), soulId, tokenId);

        bytes32 token = deriveToken(collection, tokenId);

        bool bound = tokensBySoul[soulId].add(token) && soulsByToken[token].add(soulId);
        require(bound, "SoulBoundTokenRegistry: token is already bound to soul");

        emit TokenBound(soulId, token);
    }

    function isBound(bytes32 token, uint256 soulId) external view returns (bool) {
        return tokensBySoul[soulId].contains(token);
    }

    function isBound(ISoulBoundTokenCollection collection, uint96 tokenId, uint256 soulId)
        external
        view
        returns (bool)
    {
        return tokensBySoul[soulId].contains(deriveToken(collection, tokenId));
    }

    function soulsCountByToken(bytes32 token) external view returns (uint256) {
        return soulsByToken[token].length();
    }

    function soulByTokenAtIndex(bytes32 token, uint256 index) external view returns (uint256) {
        return soulsByToken[token].at(index);
    }

    function tokensCountBySoul(uint256 soulId) external view returns (uint256) {
        return tokensBySoul[soulId].length();
    }

    function tokenBySoulAtIndex(uint256 soulId, uint256 index) external view returns (bytes32) {
        return tokensBySoul[soulId].at(index);
    }

    function featureInterfaceId() internal pure override returns (bytes4) {
        return type(ISoulBoundTokenCollection).interfaceId;
    }

    /**
     * Derive generalized token id from token collection and collection token id
     * @param collection soul bound token collection
     * @param tokenId token id in specified collection
     * @return generalized token id
     */
    function deriveToken(ISoulBoundTokenCollection collection, uint96 tokenId) private pure returns (bytes32) {
        return bytes32(bytes.concat(bytes20(address(collection)), bytes12(tokenId)));
    }
}
