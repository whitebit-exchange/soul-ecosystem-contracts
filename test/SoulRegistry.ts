import "@nomiclabs/hardhat-waffle"
import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

type deployedContracts = { soulRegistry: Contract, soulRegistryConfig: Contract };

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const deploy = async (owner: SignerWithAddress): Promise<deployedContracts> => {
    const soulRegistryConfig = await ethers.deployContract("SoulRegistryConfig", owner);
    const soulRegistry = await ethers.deployContract("SoulRegistry", [soulRegistryConfig.address], owner);

    return { soulRegistry, soulRegistryConfig };
};

interface Soul {
    id: number
    primaryAddress: string
    activeAddresses: string[]
    revokedAddresses: string[]
}

const assertSoulStateEqual = async (soulRegistry: Contract, expected: Soul) => {
    expect(await soulRegistry.soulPrimaryAddress(expected.id)).to.equal(expected.primaryAddress);
    expect(await soulRegistry.soulOf(expected.primaryAddress)).to.equal(expected.id);
    expect(await soulRegistry.soulAddresses(expected.id)).deep.equal(expected.activeAddresses);
    expect(await soulRegistry.functions["isSoul(uint256)"](expected.id)).deep.equal([true]);

    for (let address of expected.activeAddresses) {
        expect(await soulRegistry.soulOf(address)).to.equal(expected.id);
        expect(await soulRegistry.isAddressUsed(address)).to.be.true;
        expect(await soulRegistry.soulOfRevoked(address)).to.equal(0);
        expect(await soulRegistry.functions["isSoul(address)"](address)).deep.equal([true]);
    }

    for (let address of expected.revokedAddresses) {
        expect(await soulRegistry.soulOf(address)).to.equal(0);
        expect(await soulRegistry.isAddressUsed(address)).to.be.true;
        expect(await soulRegistry.soulOfRevoked(address)).to.equal(expected.id);
        expect(await soulRegistry.functions["isSoul(address)"](address)).deep.equal([false]);
    }
}

const mustRegister = async (soulRegistry: Contract, primaryAddress: string, expectedId: number) => {
    const result = soulRegistry.registerSoul(primaryAddress);

    await expect(result).not.to.be.reverted;
    await expect(result)
        .to.emit(soulRegistry, "PrimaryAddressChanged").withArgs(expectedId, ZERO_ADDRESS, primaryAddress)
        .to.emit(soulRegistry, "AddressAssigned").withArgs(primaryAddress, expectedId)

    expect(await soulRegistry.lastSoulId()).to.equal(expectedId);

    await assertSoulStateEqual(soulRegistry, {
        id: expectedId,
        primaryAddress: primaryAddress,
        activeAddresses: [primaryAddress],
        revokedAddresses: [],
    });
};

describe("SoulRegistry contract", () => {
    it("Should correctly initialize contract", async () => {
        const [owner] = await ethers.getSigners();

        const { soulRegistry, soulRegistryConfig } = await deploy(owner);

        expect(await soulRegistry.owner()).to.equal(owner.address);
        expect(await soulRegistry.config()).to.equal(soulRegistryConfig.address);
        expect(await soulRegistry.lastSoulId()).to.equal(0);
    });

    it("Should correctly change owner", async () => {
        const [owner, newOwner] = await ethers.getSigners();

        const { soulRegistry } = await deploy(owner);

        expect(await soulRegistry.owner()).to.equal(owner.address);

        await expect(soulRegistry.transferOwnership(ZERO_ADDRESS))
            .to.be.revertedWith("Ownable: new owner is the zero address");

        const transferOwnership = soulRegistry.transferOwnership(newOwner.address);

        await expect(transferOwnership).not.to.be.reverted;
        await expect(transferOwnership)
            .to.emit(soulRegistry, "OwnershipTransferred").withArgs(owner.address, newOwner.address);

        expect(await soulRegistry.owner()).to.equal(newOwner.address);

        await expect(soulRegistry.renounceOwnership())
            .to.be.revertedWith("Ownable: caller is not the owner");

        const renounceOwnership = soulRegistry.connect(newOwner).renounceOwnership();

        await expect(renounceOwnership).not.to.be.reverted;
        await expect(renounceOwnership)
            .to.emit(soulRegistry, "OwnershipTransferred").withArgs(newOwner.address, ZERO_ADDRESS);

        expect(await soulRegistry.owner()).to.equal(ZERO_ADDRESS);

        await expect(soulRegistry.transferOwnership(ZERO_ADDRESS))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should follow happy path", async () => {
        const [owner, primary, secondary] = await ethers.getSigners();
        const { soulRegistry } = await deploy(owner);

        const registerSoulResult = soulRegistry.registerSoul(primary.address)

        await expect(registerSoulResult).not.to.be.reverted;
        await expect(registerSoulResult)
            .to.emit(soulRegistry, "PrimaryAddressChanged").withArgs(1, ZERO_ADDRESS, primary.address)
            .to.emit(soulRegistry, "AddressAssigned").withArgs(primary.address, 1)

        await assertSoulStateEqual(soulRegistry, {
            id: 1,
            primaryAddress: primary.address,
            activeAddresses: [primary.address],
            revokedAddresses: [],
        });

        expect(await soulRegistry.isAddressUsed(secondary.address)).to.be.false;

        const assignAddressResult = soulRegistry.assignAddress(1, secondary.address);
        await expect(assignAddressResult).not.to.be.reverted;
        await expect(assignAddressResult).to.emit(soulRegistry, "AddressAssigned").withArgs(secondary.address, 1);

        await assertSoulStateEqual(soulRegistry, {
            id: 1,
            primaryAddress: primary.address,
            activeAddresses: [primary.address, secondary.address],
            revokedAddresses: [],
        });

        const changePrimaryAddressNoChangesResult = soulRegistry.changePrimaryAddress(1, primary.address);
        await expect(changePrimaryAddressNoChangesResult).not.to.be.reverted;
        await expect(changePrimaryAddressNoChangesResult).not.to.emit(soulRegistry, "PrimaryAddressChanged");

        const changePrimaryAddressResult = soulRegistry.changePrimaryAddress(1, secondary.address);

        await expect(changePrimaryAddressResult).not.to.be.reverted;
        await expect(changePrimaryAddressResult).to
            .emit(soulRegistry, "PrimaryAddressChanged")
            .withArgs(1, primary.address, secondary.address);

        await assertSoulStateEqual(soulRegistry, {
            id: 1,
            primaryAddress: secondary.address,
            activeAddresses: [primary.address, secondary.address],
            revokedAddresses: [],
        });

        const revokeAddressResult = soulRegistry.revokeAddress(primary.address);

        await expect(revokeAddressResult).not.to.be.reverted;
        await expect(revokeAddressResult).to
            .emit(soulRegistry, "AddressRevoked").withArgs(primary.address, 1);

        await assertSoulStateEqual(soulRegistry, {
            id: 1,
            primaryAddress: secondary.address,
            activeAddresses: [secondary.address],
            revokedAddresses: [primary.address],
        });

        const recoverAddressResult = soulRegistry.assignAddress(1, primary.address);

        await expect(recoverAddressResult).not.to.be.reverted;
        await expect(recoverAddressResult).to.emit(soulRegistry, "AddressAssigned").withArgs(primary.address, 1);

        await assertSoulStateEqual(soulRegistry, {
            id: 1,
            primaryAddress: secondary.address,
            activeAddresses: [secondary.address, primary.address],
            revokedAddresses: [],
        });
    });

    describe("Soul registration failures", () => {
        it("Should not allow no one except owner to register soul", async () => {
            const [owner, fake] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            const fakeResult = soulRegistry.connect(fake).registerSoul(owner.address)

            await expect(fakeResult).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await soulRegistry.lastSoulId()).to.equal(0);
        });

        it("Should not allow to register soul with zero address", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            const result = soulRegistry.registerSoul(ZERO_ADDRESS)

            await expect(result).to.be.revertedWith("SoulRegistry: zero address is not allowed");
            expect(await soulRegistry.lastSoulId()).to.equal(0);
        });

        it("Should not allow to register soul with already used address (active)", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            await mustRegister(soulRegistry, owner.address, 1)

            const result = soulRegistry.registerSoul(owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: address has been already used");
            expect(await soulRegistry.lastSoulId()).to.equal(1);
        });

        it("Should not allow to register soul with already used address (revoked)", async () => {
            const [owner, address2] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            await mustRegister(soulRegistry, owner.address, 1)

            const assignAddressResult = soulRegistry.assignAddress(1, address2.address);
            await expect(assignAddressResult).not.to.be.reverted;
            await expect(assignAddressResult).to.emit(soulRegistry, "AddressAssigned").withArgs(address2.address, 1);

            const revokeAddressResult = soulRegistry.revokeAddress(address2.address);
            await expect(revokeAddressResult).not.to.be.reverted;
            await expect(revokeAddressResult).to.emit(soulRegistry, "AddressRevoked").withArgs(address2.address, 1);

            const result = soulRegistry.registerSoul(address2.address);
            await expect(result).to.be.revertedWith("SoulRegistry: address has been already used");
            expect(await soulRegistry.lastSoulId()).to.equal(1);
        });
    });

    describe("Change primary address failures", () => {
        it("Should not allow no one except owner to change primary address", async () => {
            const [owner, fake] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const fakeResult = soulRegistry.connect(fake).changePrimaryAddress(1, ZERO_ADDRESS)
            await expect(fakeResult).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail for nonexistent soul", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const result = soulRegistry.changePrimaryAddress(1, owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: soul does not exist");
        });

        it("Should fail if address is not assigned to the same soul", async () => {
            const [owner, soul1Primary, soul2Primary, soul2Secondary] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            await mustRegister(soulRegistry, soul1Primary.address, 1);
            await mustRegister(soulRegistry, soul2Primary.address, 2);

            const assignAddressResult = soulRegistry.assignAddress(2, soul2Secondary.address);
            await expect(assignAddressResult).not.to.be.reverted;
            await expect(assignAddressResult).to.emit(soulRegistry, "AddressAssigned").withArgs(soul2Secondary.address, 2);

            const nonexistentAddressResult = soulRegistry.changePrimaryAddress(1, ZERO_ADDRESS);
            await expect(nonexistentAddressResult).to.be
                .revertedWith("SoulRegistry: address is not assigned to specified soul");

            const foreignAddressResult = soulRegistry.changePrimaryAddress(1, soul2Secondary.address)
            await expect(foreignAddressResult).to.be
                .revertedWith("SoulRegistry: address is not assigned to specified soul");
        });
    });

    describe("Assign address failures", async () => {
        it("Should not allow no one except owner to assign address", async () => {
            const [owner, fake] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const fakeResult = soulRegistry.connect(fake).assignAddress(1, ZERO_ADDRESS)
            await expect(fakeResult).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail for nonexistent soul", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const result = soulRegistry.assignAddress(1, owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: soul does not exist");
        });

        it("Should not allow to assign zero address", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            await mustRegister(soulRegistry, owner.address, 1)

            const result = soulRegistry.assignAddress(1, ZERO_ADDRESS);
            await expect(result).to.be.revertedWith("SoulRegistry: zero address is not allowed");
        });

        it("Should not allow to use existing address for assignment", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            await mustRegister(soulRegistry, owner.address, 1)

            const result = soulRegistry.assignAddress(1, owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: address has been already used");
        });

        it("Should not allow to use other soul's revoked address for assignment", async () => {
            const [owner, primary1, primary2, secondary2] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            await mustRegister(soulRegistry, primary1.address, 1)
            await mustRegister(soulRegistry, primary2.address, 2)

            const assignAddress = soulRegistry.assignAddress(2, secondary2.address);
            await expect(assignAddress).not.to.be.reverted;
            await expect(assignAddress).to.emit(soulRegistry, "AddressAssigned").withArgs(secondary2.address, 2);

            await expect(soulRegistry.assignAddress(1, primary2.address))
                .to.be.revertedWith("SoulRegistry: address has been already used");

            await expect(soulRegistry.assignAddress(1, secondary2.address))
                .to.be.revertedWith("SoulRegistry: address has been already used");

            const revokeAddress = soulRegistry.revokeAddress(secondary2.address);
            await expect(revokeAddress).not.to.be.reverted;
            await expect(revokeAddress).to.emit(soulRegistry, "AddressRevoked").withArgs(secondary2.address, 2);

            await expect(soulRegistry.assignAddress(1, secondary2.address))
                .to.be.revertedWith("SoulRegistry: address has been already used");
        });

        it("Should not allow to exceed max addresses per soul", async () => {
            const [owner, a1, a2, a3, a4, a5] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            await mustRegister(soulRegistry, owner.address, 1)

            let assignAddress = soulRegistry.assignAddress(1, a1.address);
            await expect(assignAddress).not.to.be.reverted;
            await expect(assignAddress).to.emit(soulRegistry, "AddressAssigned").withArgs(a1.address, 1);

            assignAddress = soulRegistry.assignAddress(1, a2.address);
            await expect(assignAddress).not.to.be.reverted;
            await expect(assignAddress).to.emit(soulRegistry, "AddressAssigned").withArgs(a2.address, 1);

            assignAddress = soulRegistry.assignAddress(1, a3.address);
            await expect(assignAddress).not.to.be.reverted;
            await expect(assignAddress).to.emit(soulRegistry, "AddressAssigned").withArgs(a3.address, 1);

            assignAddress = soulRegistry.assignAddress(1, a4.address);
            await expect(assignAddress).not.to.be.reverted;
            await expect(assignAddress).to.emit(soulRegistry, "AddressAssigned").withArgs(a4.address, 1);

            const result = soulRegistry.assignAddress(1, a5.address);
            await expect(result).to.be.revertedWith("SoulRegistry: addresses per soul limit exceeded");
        });
    });

    describe("Revoke address failures", () => {
        it("Should not allow no one except owner to revoke address", async () => {
            const [owner, fake] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const fakeResult = soulRegistry.connect(fake).revokeAddress(ZERO_ADDRESS)
            await expect(fakeResult).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail for nonexistent soul", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);

            const result = soulRegistry.revokeAddress(owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: address is not assigned to any soul");
        });

        it("Should not allow to remove soul primary address", async () => {
            const [owner] = await ethers.getSigners();
            const { soulRegistry } = await deploy(owner);
            await mustRegister(soulRegistry, owner.address, 1)

            const result = soulRegistry.revokeAddress(owner.address);
            await expect(result).to.be.revertedWith("SoulRegistry: cannot revoke soul's primary address");
        });
    });
});
