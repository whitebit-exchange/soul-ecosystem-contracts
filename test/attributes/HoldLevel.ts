import { ethers } from "hardhat";
import { expect } from "chai";
import "@nomiclabs/hardhat-waffle"

describe("HoldLevel contract", () => {
    it("Should check if attribute is compliant with its specification", async () => {
        const [owner, fake] = await ethers.getSigners();

        const holdLevel = await ethers.deployContract("HoldLevel", owner);

        expect(await holdLevel.owner()).to.equal(owner.address);
        expect(await holdLevel.name()).to.equal("Hold level");
        expect(await holdLevel.description()).to.equal("Represents soul's WBT hold level on WhiteBIT");
        expect(await holdLevel.supportsInterface("0x01ffc9a7")).to.be.true;
        expect(await holdLevel.supportsInterface("0x87de52c5")).to.be.true;
        expect(await holdLevel.supportsInterface("0xffffffff")).to.be.false;

        await expect(holdLevel.assertIsSettable(fake.address, 0, "0x" + '0'.repeat(40)))
            .to.be.revertedWith("HoldLevel: permission denied");

        await expect(holdLevel.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(39) + "c"))
            .to.be.revertedWith("HoldLevel: level should be in range [1, 11]");

        for (let i = 0; i <= 11; i++) {
            await expect(holdLevel.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(39) + i.toString(16)))
                .not.to.be.reverted;
        }
    });
});
