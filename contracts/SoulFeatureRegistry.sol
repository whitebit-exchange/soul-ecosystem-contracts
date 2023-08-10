// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "interfaces/ISoulFeature.sol";
import "interfaces/ISoulRegistry.sol";
import "interfaces/ISoulFeatureRegistry.sol";

/**
 * @title Soul feature registry
 * Soul feature registry interface implementation with a restricted access to state modification.
 */
abstract contract SoulFeatureRegistry is Ownable, ISoulFeatureRegistry {
    enum Status { NotExist, Active, Paused }

    ISoulRegistry private immutable soulRegistry;
    mapping(ISoulFeature => Status) private featureStatuses;
    mapping(ISoulFeature => uint256) private featurePauseTimestamps;

    event FeatureStatusChanged(ISoulFeature indexed feature, Status previous, Status next);

    constructor(ISoulRegistry _soulRegistry) {
        soulRegistry = _soulRegistry;
    }

    /**
     * Register new feature; assert that it is not set yet and it implements expected interface.
     * @param feature feature to register
     */
    function registerFeature(ISoulFeature feature) external onlyOwner {
        require(featureStatuses[feature] == Status.NotExist, "SoulFeatureRegistry: feature already exists");
        require(address(feature).code.length > 0, "SoulFeatureRegistry: specified address is not a contract");
        require(feature.supportsInterface(featureInterfaceId()), "SoulFeatureRegistry: feature is incompatible");

        featureStatuses[feature] = Status.Active;
        emit FeatureStatusChanged(feature, Status.NotExist, Status.Active);
    }

    /**
     * Pause feature and save its pause timestamp; feature must be active.
     * @param feature feature to pause
     */
    function pauseFeature(ISoulFeature feature) external onlyOwner {
        require(featureStatuses[feature] == Status.Active, "SoulFeatureRegistry: feature is not active");

        featureStatuses[feature] = Status.Paused;
        featurePauseTimestamps[feature] = block.timestamp;
        emit FeatureStatusChanged(feature, Status.Active, Status.Paused);
    }

    /**
     * Unpause feature and reset its pause timestamp; feature must be paused.
     * @param feature feature to unpause
     */
    function unpauseFeature(ISoulFeature feature) external onlyOwner {
        require(featureStatuses[feature] == Status.Paused, "SoulFeatureRegistry: feature is not paused");

        featureStatuses[feature] = Status.Active;
        delete featurePauseTimestamps[feature];
        emit FeatureStatusChanged(feature, Status.Paused, Status.Active);
    }

    function featureStatus(ISoulFeature feature) external view returns (uint8) {
        return uint8(featureStatuses[feature]);
    }

    function featurePausedAt(ISoulFeature feature) external view returns (uint256) {
        return featurePauseTimestamps[feature];
    }

    /**
     * Get interface id that each feature should implement (used in registerFeature()).
     * @return feature interface id
     */
    function featureInterfaceId() internal pure virtual returns (bytes4);

    /**
     * Assert that setting feature for soul can be done.
     * It checks that:
     * 1. Feature is active;
     * 2. Soul with specified id exists in registry.
     * @param feature feature to set
     * @param soulId soul id to use
     */
    function assertIsSettable(ISoulFeature feature, uint256 soulId) internal view {
        require(featureStatuses[feature] == Status.Active, "SoulFeatureRegistry: feature does not exist or is paused");
        require(soulRegistry.isSoul(soulId), "SoulFeatureRegistry: there is no soul with such id in registry");
    }
}
