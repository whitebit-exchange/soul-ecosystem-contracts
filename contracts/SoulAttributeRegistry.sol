// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "contracts/SoulFeatureRegistry.sol";
import "interfaces/ISoulAttribute.sol";
import "interfaces/ISoulAttributeRegistry.sol";
import "interfaces/ISoulRegistry.sol";

/**
 * @title Soul attribute registry
 * Soul attribute registry interface implementation with a restricted access to state modification.
 */
contract SoulAttributeRegistry is SoulFeatureRegistry, ISoulAttributeRegistry {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Record {
        bytes20 value;
        uint48 setAt;
        uint48 updatedAt;
    }

    mapping(ISoulAttribute => EnumerableSet.UintSet) private soulsByAttribute;
    mapping(uint256 => EnumerableSet.AddressSet) private attributesBySoul;
    mapping(uint256 => mapping(ISoulAttribute => Record)) private records;

    event AttributeValueChanged(
        uint256 indexed soulId,
        ISoulAttribute indexed attribute,
        bytes20 previousValue,
        bytes20 newValue
    );

    constructor(ISoulRegistry soulRegistry) SoulFeatureRegistry(soulRegistry) {}

    /**
     * Set attribute value for specified soul.
     * Prechecks:
     * 1. Soul feature registry rules must be followed;
     * 2. New value should not equal current value.
     * If the value is 20 zero bytes, then attribute will be unset.
     * @param soulId soul id to use
     * @param attribute attribute to use
     * @param value value to use
     */
    function setAttribute(uint256 soulId, ISoulAttribute attribute, bytes20 value) external {
        assertIsSettable(attribute, soulId);
        attribute.assertIsSettable(_msgSender(), soulId, value);

        Record storage record = records[soulId][attribute];
        require(record.value != value, "SoulAttributeRegistry: soul attribute will not change");

        emit AttributeValueChanged(soulId, attribute, record.value, value);

        if (value != bytes20(uint160(0))) {
            soulsByAttribute[attribute].add(soulId);
            attributesBySoul[soulId].add(address(attribute));
            record.value = value;

            record.updatedAt = uint48(block.timestamp);
            if (record.setAt == 0) {
                record.setAt = uint48(block.timestamp);
            }
        } else {
            soulsByAttribute[attribute].remove(soulId);
            attributesBySoul[soulId].remove(address(attribute));
            delete records[soulId][attribute];
        }
    }

    function soulAttributeValue(uint256 soulId, ISoulAttribute attribute) external view returns (bytes20 value) {
        return records[soulId][attribute].value;
    }

    function soulAttributeSetAt(uint256 soulId, ISoulAttribute attribute) external view returns (uint256) {
        return records[soulId][attribute].setAt;
    }

    function soulAttributeUpdatedAt(uint256 soulId, ISoulAttribute attribute) external view returns (uint256) {
        return records[soulId][attribute].updatedAt;
    }

    function attributesCountBySoul(uint256 soulId) external view returns (uint256 count) {
        return attributesBySoul[soulId].length();
    }

    function attributeBySoulAtIndex(uint256 soulId, uint256 index) external view returns (ISoulAttribute attribute) {
        return ISoulAttribute(attributesBySoul[soulId].at(index));
    }

    function soulsCountByAttribute(ISoulAttribute attribute) external view returns (uint256 count) {
        return soulsByAttribute[attribute].length();
    }

    function soulByAttributeAtIndex(ISoulAttribute attribute, uint256 index) external view returns (uint256 soulId) {
        return soulsByAttribute[attribute].at(index);
    }

    function soulAndValueByAttributeAtIndex(ISoulAttribute attribute, uint256 index)
        external
        view
        returns (uint256, bytes20)
    {
        uint256 soulId = soulsByAttribute[attribute].at(index);
        return (soulId, records[soulId][attribute].value);
    }

    function featureInterfaceId() internal pure override returns (bytes4) {
        return type(ISoulAttribute).interfaceId;
    }
}
