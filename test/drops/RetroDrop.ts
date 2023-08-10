import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { time, setBalance, setStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-waffle"

// Slot in mapping for soul id 123
const slotId = "0xde31a920dbdd1f015b2a842f0275dc8dec6a82ff94d9b796a36f23c64a3c8332";

describe("SoulDrop contract", () => {
    it("Should revert if drop has not been started yet", async () => {
        const latestTime = await time.latest();

        await time.setNextBlockTimestamp(latestTime + 1000);

        const [owner, caller] = await ethers.getSigners();

        const ISoulRegistry = await artifacts.readArtifact("ISoulRegistry");

        const soulRegistryMock = await deployMockContract(owner, ISoulRegistry.abi);

        const retroDrop = await ethers.deployContract("RetroDrop", [
            soulRegistryMock.address,
            latestTime + 2000
        ], owner);

        await expect(retroDrop.connect(caller).claim()).to.be.revertedWith("RetroDrop: drop has not been started yet");
    });

    it("Should revert is sender is not present in souls registry", async () => {
        const [owner, caller] = await ethers.getSigners();
        const ISoulRegistry = await artifacts.readArtifact("ISoulRegistry");
        const soulRegistryMock = await deployMockContract(owner, ISoulRegistry.abi);

        const retroDrop = await ethers.deployContract("RetroDrop", [
            soulRegistryMock.address,
            await time.latest()
        ], owner);

        await soulRegistryMock.mock["soulOf(address)"].withArgs(caller.address).returns(0);

        await expect(retroDrop.connect(caller).claim())
            .to.be.revertedWith("RetroDrop: sender is not present in souls registry");
    });

    it("Should correctly send reward once and reset state by soul", async () => {
        const [owner, caller] = await ethers.getSigners();
        const ISoulRegistry = await artifacts.readArtifact("ISoulRegistry");
        const soulRegistryMock = await deployMockContract(owner, ISoulRegistry.abi);

        const retroDrop = await ethers.deployContract("RetroDrop", [
            soulRegistryMock.address,
            await time.latest()
        ], owner);

        await setBalance(retroDrop.address, "0xde0b6b3a7640000"); // 1 WBT
        await setStorageAt(retroDrop.address, slotId, "0xde0b6b3a7640000"); // 1 WBT

        expect(await retroDrop.dropsBySoul(123)).to.equal("0xde0b6b3a7640000");

        await soulRegistryMock.mock["soulOf(address)"].withArgs(caller.address).returns(123);

        const result = retroDrop.connect(caller).claim();
        await expect(result).not.to.be.reverted;
        await expect(result).to.emit(retroDrop, "Claimed(uint256,uint256)")
            .withArgs(123, "0xde0b6b3a7640000");

        await expect(result).to.changeEtherBalance(caller, '0xde0b6b3a7640000');

        expect(await retroDrop.dropsBySoul(123)).to.equal("0");

        await expect(retroDrop.connect(caller).claim()).to.be.revertedWith("RetroDrop: nothing to claim");
    });
});
