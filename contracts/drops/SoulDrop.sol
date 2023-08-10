// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "interfaces/ISoulRegistry.sol";
import "interfaces/ISoulAttributeRegistry.sol";
import "contracts/attributes/HoldAmount.sol";
import "contracts/attributes/IsVerified.sol";

/**
 * @title SoulDrop contract
 * Each WB Soul with at least hold level 1 is eligible to claim a reward for each holding period (30 days).
 * Reward amount is base amount multiplied by percent for specific hold level.
 * Base amount for calculating reward = hold amount + withholdings + rewards of past periods.
 * Hold interval starts from hold amount attribute's update time and ends with block timestamp (in call context).
 * When user claims his reward, claim time is being saved.
 * It will be used instead of hold amount attribute's update time (for resetting reward interval after each claim).
 * There is also an opportunity to withhold current soul reward (only for contract owner).
 * Withholding is a reward snapshot for specific soul, it will be done before hold amount attribute change.
 * Withholdings will be also included to base amount when calculating reward (as unspent rewards).
 * Note: only verified WB Soul can claim reward.
 */
contract SoulDrop is Ownable, Pausable {
    uint256 private constant PERIOD = 30 * 24 * 60 * 60; // 30 days
    uint256 private constant PERCENT_DENOMINATOR = 100000000000;

    ISoulRegistry private immutable soulRegistry;
    ISoulAttributeRegistry private immutable soulAttributeRegistry;
    HoldAmount private immutable holdAmountAttribute;
    IsVerified private immutable isVerifiedAttribute;

    mapping(uint256 => uint256) public claimedAtBySoul;
    mapping(uint256 => uint256) public withholdingsBySoul;
    mapping(uint8 => uint256) public percentByHoldLevel;

    event Claimed(uint256 indexed soulId, uint256 amount);

    constructor(
        ISoulRegistry _soulRegistry,
        ISoulAttributeRegistry _soulAttributeRegistry,
        HoldAmount _holdAmountAttribute,
        IsVerified _isVerifiedAttribute
    ) {
        soulRegistry = _soulRegistry;
        soulAttributeRegistry = _soulAttributeRegistry;
        holdAmountAttribute = _holdAmountAttribute;
        isVerifiedAttribute = _isVerifiedAttribute;

        // Values in map are multiplied by PERCENT_DENOMINATOR to follow uint256 type.
        percentByHoldLevel[1] = 1316973381;
        percentByHoldLevel[2] = 1316985649;
        percentByHoldLevel[3] = 1317451809;
        percentByHoldLevel[4] = 1318187804;
        percentByHoldLevel[5] = 1319046390;
        percentByHoldLevel[6] = 1321253816;
        percentByHoldLevel[7] = 1326770067;
        percentByHoldLevel[8] = 1335344342;
        percentByHoldLevel[9] = 1347579478;
        percentByHoldLevel[10] = 1438828875;
        percentByHoldLevel[11] = 1677838513;
    }

    /**
     * Deposit is available only for contract owner to prevent loosing user funds by mistake.
     */
    receive() external payable onlyOwner {}

    /**
     * Pause contract.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * Unpause contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * Save a reward snapshot for specific soul and reset its claim timestamp.
     * @param soulId target soul id
     */
    function withholdSoulReward(uint256 soulId) external onlyOwner whenNotPaused {
        require(soulRegistry.isSoul(soulId), "SoulDrop: soul doesn't exist");

        uint256 reward = getSoulReward(soulId);
        require(reward > 0, "SoulDrop: nothing to withhold");

        claimedAtBySoul[soulId] = block.timestamp;
        withholdingsBySoul[soulId] = reward;
    }

    /**
     * Get sender soul's reward and transfer it to sender's address.
     * Preconditions:
     *  - Contract is not paused;
     *  - Sender must be present in souls registry;
     *  - Sender's soul should have IsVerified attribute in attributes registry.
     * If preconditions are met, reward is being calculated and transferred to sender's address.
     * After each claim, reward state by soul is being reset.
     */
    function claim() external whenNotPaused {
        uint256 soulId = soulRegistry.soulOf(_msgSender());
        require(soulId != 0, "SoulDrop: sender is not present in souls registry");

        bool isVerified = uint160(soulAttributeRegistry.soulAttributeValue(soulId, isVerifiedAttribute)) == 1;
        require(isVerified, "SoulDrop: soul is not verified");

        uint256 reward = getSoulReward(soulId);
        require(reward > 0, "SoulDrop: nothing to claim");

        claimedAtBySoul[soulId] = block.timestamp;
        delete withholdingsBySoul[soulId];

        payable(_msgSender()).transfer(reward);
        emit Claimed(soulId, reward);
    }

    /**
     * Get specified soul's reward in current state.
     * Reward interval starts either from hold amount update time,
     * or from last claim time (if it is greater than previous).
     * Interval ends with block time in current context.
     * Reward will be non-zero, if soul holds some WBT for at least 30 days (single period).
     * In other case soul is eligible to withdraw its withholdings only (previous unclaimed rewards).
     * @param soulId Soul id to query
     * @return Soul reward in current context
     */
    function getSoulReward(uint256 soulId) public view returns (uint256) {
        // Get hold amount from attribute registry.
        // If hold amount is zero, return only withholdings.
        uint256 holdAmount = uint256(uint160(soulAttributeRegistry.soulAttributeValue(soulId, holdAmountAttribute)));
        if (holdAmount == 0) {
            return withholdingsBySoul[soulId];
        }

        // Reward interval starts from max(update of hold amount attribute, last claim date).
        // If hold amount is not set (its updatedAt == 0), return withholdings only.
        // But this should never happen, because both attribute and update time should be either empty or not empty.
        uint256 intervalStart = soulAttributeRegistry.soulAttributeUpdatedAt(soulId, holdAmountAttribute);
        if (intervalStart == 0) {
            return withholdingsBySoul[soulId];
        }

        uint256 lastClaimedAt = claimedAtBySoul[soulId];
        if (intervalStart < lastClaimedAt) {
            intervalStart = lastClaimedAt;
        }

        require(intervalStart <= block.timestamp, "SoulDrop: reward interval starts in future");

        uint256 interval = block.timestamp - intervalStart;

        return calculateReward(interval, holdAmount, withholdingsBySoul[soulId]);
    }

    /**
     * Calculate reward for specified interval, hold amount and withholdings.
     * Reward percent depends on hold level, which in turn depends on hold amount.
     * Single period reward will be added to base amount for calculating next period reward,
     * so every next period's reward will be greater than previous one.
     * Initial reward is soul withholdings (previous unclaimed rewards).
     * @param interval Interval for calculating reward (in seconds)
     * @param holdAmount Base amount for calculating
     * @param withholdings Current soul withholdings
     * @return Calculated reward amount
     */
    function calculateReward(uint256 interval, uint256 holdAmount, uint256 withholdings) public view returns (uint256) {
        uint256 reward = withholdings;
        uint8 level = holdAmountAttribute.levelFromAmount(holdAmount);
        uint256 percent = percentByHoldLevel[level];

        while (interval >= PERIOD) {
            interval = interval - PERIOD;
            reward = reward + (holdAmount + reward) * percent / PERCENT_DENOMINATOR;
        }

        return reward;
    }
}
