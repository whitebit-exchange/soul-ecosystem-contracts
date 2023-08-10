import { ethers } from "hardhat";
import { expect } from "chai";
import "@nomiclabs/hardhat-waffle"

describe("IsVerified contract", () => {
    it("Should check if attribute is compliant with its specification", async () => {
        const [owner, fake] = await ethers.getSigners();

        const isVerified = await ethers.deployContract("IsVerified", owner);

        expect(await isVerified.owner()).to.equal(owner.address);
        expect(await isVerified.name()).to.equal("Is verified");
        expect(await isVerified.description()).to.equal("Represents soul's current verification status on WhiteBIT");
        expect(await isVerified.supportsInterface("0x01ffc9a7")).to.be.true;
        expect(await isVerified.supportsInterface("0x87de52c5")).to.be.true;
        expect(await isVerified.supportsInterface("0xffffffff")).to.be.false;

        await expect(isVerified.assertIsSettable(fake.address, 0, "0x" + '0'.repeat(40)))
            .to.be.revertedWith("IsVerified: permission denied");

        await expect(isVerified.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(39) + "2"))
            .to.be.revertedWith("IsVerified: invalid value");

        await expect(isVerified.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(40)))
            .not.to.be.reverted;

        await expect(isVerified.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(39) + "1"))
            .not.to.be.reverted;
    });
});
