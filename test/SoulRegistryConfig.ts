import { ethers } from "hardhat";
import { expect } from "chai";
import "@nomiclabs/hardhat-waffle"

describe("SoulRegistry contract", () => {
    it("Should correctly initialize contract", async () => {
        const [owner] = await ethers.getSigners();
        const contract = await ethers.deployContract("SoulRegistryConfig", owner)

        expect(await contract.owner()).to.equal(owner.address, "Unexpected contract owner");
        expect(await contract.maxAddressesPerSoul()).to.equal(5, "Unexpected default max addresses per soul");
    });

    it("Should update max addresses per soul on owner request", async () => {
        const [owner] = await ethers.getSigners();
        const contract = await ethers.deployContract("SoulRegistryConfig", owner)

        const updateMaxAddressesPerSoul = contract.updateMaxAddressesPerSoul(10);

        await expect(updateMaxAddressesPerSoul).not.to.be.reverted;
        await expect(updateMaxAddressesPerSoul).to.emit(contract, "MaxAddressesPerSoulUpdated").withArgs(5, 10);

        expect(await contract.maxAddressesPerSoul()).to.equal(10, "Unexpected max addresses per soul after update");
    });

    it("Should deny updating max addresses per soul for non owner", async () => {
        const [owner, fake] = await ethers.getSigners();
        const contract = await ethers.deployContract("SoulRegistryConfig", owner)

        const fakeCall = contract.connect(fake).updateMaxAddressesPerSoul(10);
        await expect(fakeCall).to.be.revertedWith("Ownable: caller is not the owner");
        expect(await contract.maxAddressesPerSoul()).to.equal(5, "Unexpected max addresses per soul after call");
    });
});
