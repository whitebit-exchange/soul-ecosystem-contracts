import { ethers } from "hardhat";
import { expect } from "chai";
import "@nomiclabs/hardhat-waffle"

describe("HoldAmount contract", () => {
    it("Should check if attribute is compliant with its specification", async () => {
        const [owner, fake] = await ethers.getSigners();

        const holdAmount = await ethers.deployContract("HoldAmount", owner);

        expect(await holdAmount.owner()).to.equal(owner.address);
        expect(await holdAmount.name()).to.equal("Hold amount");
        expect(await holdAmount.description()).to.equal("Represents soul's WBT hold amount on WhiteBIT");
        expect(await holdAmount.supportsInterface("0x01ffc9a7")).to.be.true;
        expect(await holdAmount.supportsInterface("0x87de52c5")).to.be.true;
        expect(await holdAmount.supportsInterface("0xffffffff")).to.be.false;

        await expect(holdAmount.assertIsSettable(fake.address, 0, "0x" + '0'.repeat(40)))
            .to.be.revertedWith("HoldAmount: permission denied");

        await expect(holdAmount.assertIsSettable(owner.address, 0, "0x0000000000000000014adf4b7320334b90000001"))
            .to.be.revertedWith("HoldAmount: amount should not be greater than total supply");

        await expect(holdAmount.assertIsSettable(owner.address, 0, "0x0000000000000000014adf4b7320334b90000000"))
            .not.to.be.reverted;

        await expect(holdAmount.assertIsSettable(owner.address, 0, "0x" + '0'.repeat(40)))
            .not.to.be.reverted;
    });

    it("Should correctly translate amount to hold level", async () => {
        const [owner] = await ethers.getSigners();

        const holdAmount = await ethers.deployContract("HoldAmount", owner);

        const map = {
            "0": 0, // 0
            "0x8ac7230489e7ffff": 0, // 9.999999999999999999
            "0x8ac7230489e80000": 1, // 10
            "0xad78ebc5ac61fffff": 1, // 199.999999999999999999
            "0xad78ebc5ac6200000": 2, // 200
            "0x5150ae84a8cdefffff": 2, // 1499.999999999999999999
            "0x5150ae84a8cdf00000": 3, // 1500
            "0xd8d726b7177a7fffff": 3, // 3999.999999999999999999
            "0xd8d726b7177a800000": 4, // 4000
            "0x21e19e0c9bab23fffff": 4, // 9999.999999999999999999
            "0x21e19e0c9bab2400000": 5, // 10000
            "0x3635c9adc5de9ffffff": 5, // 15999.999999999999999999
            "0x3635c9adc5dea000000": 6, // 16000
            "0x65a4da25d3016bfffff": 6, // 29999.999999999999999999
            "0x65a4da25d3016c00000": 7, // 30000
            "0xcb49b44ba602d7fffff": 7, // 59999.999999999999999999
            "0xcb49b44ba602d800000": 8, // 60000
            "0x152d02c7e14af67fffff": 8, // 99999.999999999999999999
            "0x152d02c7e14af6800000": 9, // 100000
            "0x21e19e0c9bab23ffffff": 9, // 159999.999999999999999999
            "0x21e19e0c9bab24000000": 10, // 160000
            "0x1a784379d99db41ffffff": 10, // 1999999.999999999999999999
            "0x1a784379d99db42000000": 11, // 2000000
            "0x4f68ca6d8cd91c5ffffff": 11, // 5999999.999999999999999999
            "0x4f68ca6d8cd91c6000000": 12, // 6000000
        };

        for (let amount in map) {
            expect(await holdAmount.levelFromAmount(amount)).to.equal(map[amount]);
        }
    });
});
