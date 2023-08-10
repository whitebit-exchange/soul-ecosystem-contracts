// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "contracts/SoulRegistryConfig.sol";
import "contracts/SoulAttributeRegistry.sol";
import "contracts/SoulBoundTokenRegistry.sol";
import "interfaces/ISoulRegistry.sol";

/**
 * @title Soul registry
 * Contract for registering and managing souls.
 * Term "soul" refers to a blockchain representation of someone.
 * Each soul has its own unique identifier and may own multiple wallets (at least one).
 * Wallets addresses may be assigned to a soul for its identification.
 * One of addresses is considered to be a primary soul's address.
 * In case of losing access to some wallet, there is an opportunity to revoke an address.
 */
contract SoulRegistry is Ownable, ISoulRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    SoulRegistryConfig public immutable config;

    uint256 public lastSoulId;
    mapping(address => uint256) private soulsByAddress;
    mapping(uint256 => address) private primaryAddressesBySoul;
    mapping(uint256 => EnumerableSet.AddressSet) private addressListsBySoul;
    mapping(address => uint256) private revokedAddresses;

    event PrimaryAddressChanged(uint256 indexed soulId, address previousValue, address newValue);
    event AddressAssigned(address indexed addr, uint256 indexed soulId);
    event AddressRevoked(address indexed addr, uint256 indexed soulId);

    constructor(SoulRegistryConfig _config) {
        config = _config;
    }

    /**
     * Register new soul using specified address as a primary address
     * @param addr New soul's primary address address
     */
    function registerSoul(address addr) external onlyOwner {
        require(addr != address(0), "SoulRegistry: zero address is not allowed");
        require(!isAddressUsed(addr), "SoulRegistry: address has been already used");

        uint256 soulId = lastSoulId + 1;

        soulsByAddress[addr] = soulId;
        addressListsBySoul[soulId].add(addr);
        primaryAddressesBySoul[soulId] = addr;
        lastSoulId = soulId;

        emit PrimaryAddressChanged(soulId, address(0), addr);
        emit AddressAssigned(addr, soulId);
    }

    /**
     * Change soul's primary address (new primary address should be assigned to the same soul)
     * @param soulId Soul id for change
     * @param addr New primary address
     */
    function changePrimaryAddress(uint256 soulId, address addr) external onlyOwner {
        if (primaryAddressesBySoul[soulId] == addr) {
            return;
        }

        require(primaryAddressesBySoul[soulId] != address(0), "SoulRegistry: soul does not exist");
        require(soulsByAddress[addr] == soulId, "SoulRegistry: address is not assigned to specified soul");

        emit PrimaryAddressChanged(soulId, primaryAddressesBySoul[soulId], addr);
        primaryAddressesBySoul[soulId] = addr;
    }

    /**
     * Assign new address to existing soul or recover existing revoked soul address
     * @param soulId Target soul id
     * @param addr Target address
     */
    function assignAddress(uint256 soulId, address addr) external onlyOwner {
        require(primaryAddressesBySoul[soulId] != address(0), "SoulRegistry: soul does not exist");
        require(addr != address(0), "SoulRegistry: zero address is not allowed");

        bool isAssignable = !isAddressUsed(addr) || revokedAddresses[addr] == soulId;

        require(isAssignable, "SoulRegistry: address has been already used");
        require(!addressesLimitExceeded(soulId), "SoulRegistry: addresses per soul limit exceeded");

        addressListsBySoul[soulId].add(addr);
        soulsByAddress[addr] = soulId;
        delete revokedAddresses[addr];
        emit AddressAssigned(addr, soulId);
    }

    /**
     * Revoke specified address
     * @param addr Address to revoke
     */
    function revokeAddress(address addr) external onlyOwner {
        uint256 soulId = soulsByAddress[addr];
        require(soulId != 0, "SoulRegistry: address is not assigned to any soul");
        require(addr != primaryAddressesBySoul[soulId], "SoulRegistry: cannot revoke soul's primary address");

        addressListsBySoul[soulId].remove(addr);
        delete soulsByAddress[addr];
        revokedAddresses[addr] = soulId;
        emit AddressRevoked(addr, soulId);
    }

    function isSoul(uint256 id) external view returns (bool) {
        return primaryAddressesBySoul[id] != address(0);
    }

    function isSoul(address addr) external view returns (bool) {
        return soulsByAddress[addr] != 0;
    }

    function soulOf(address addr) external view returns (uint256) {
        return soulsByAddress[addr];
    }

    function soulOfRevoked(address addr) external view returns (uint256) {
        return revokedAddresses[addr];
    }

    function soulPrimaryAddress(uint256 soulId) external view returns (address) {
        return primaryAddressesBySoul[soulId];
    }

    function soulAddresses(uint256 soulId) external view returns (address[] memory) {
        return addressListsBySoul[soulId].values();
    }

    function isAddressUsed(address addr) public view returns (bool) {
        return soulsByAddress[addr] != 0 || revokedAddresses[addr] != 0;
    }

    /**
     * Check if addresses per soul limit exceeded for specified soul
     * @param soulId Soul id to check
     * @return whether limit exceeded or not
     */
    function addressesLimitExceeded(uint256 soulId) private view returns (bool) {
        return addressListsBySoul[soulId].length() >= config.maxAddressesPerSoul();
    }
}
