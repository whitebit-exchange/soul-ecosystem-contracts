import { ethers } from "hardhat";
import { expect } from "chai";
import "@nomiclabs/hardhat-waffle"

describe("EarlyBird contract", () => {
    it("Should check if SBT collection is compliant with its specification", async () => {
        const [owner, fake] = await ethers.getSigners();

        const tokenUri = "https://host/path";

        const earlyBird = await ethers.deployContract("EarlyBird", [tokenUri], owner);

        expect(await earlyBird.owner()).to.equal(owner.address);
        expect(await earlyBird.name()).to.equal("Early bird");
        expect(await earlyBird.description()).to.equal("Issued for early WB Network users");
        expect(await earlyBird.tokenURI(1)).to.equal(tokenUri);
        expect(await earlyBird.tokenIdsCount()).to.equal(1);
        expect(await earlyBird.tokenIdAtIndex(0)).to.equal(1);
        expect(await earlyBird.supportsInterface("0x01ffc9a7")).to.be.true;
        expect(await earlyBird.supportsInterface("0xed843969")).to.be.true;
        expect(await earlyBird.supportsInterface("0xffffffff")).to.be.false;

        await expect(earlyBird.assertIsBindable(fake.address, 0, 1))
            .to.be.revertedWith("EarlyBird: permission denied");

        await expect(earlyBird.assertIsBindable(owner.address, 0, 2))
            .to.be.revertedWith("EarlyBird: token does not exist");

        await expect(earlyBird.assertIsBindable(owner.address, 0, 1))
            .not.to.be.reverted;

        await expect(earlyBird.tokenIdAtIndex(1))
            .to.be.revertedWith("EarlyBird: out of bounds");

        await expect(earlyBird.tokenURI(0))
            .to.be.revertedWith("EarlyBird: token does not exist");
    });
});
