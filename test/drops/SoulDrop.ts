import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { time, mine, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-waffle"

describe("SoulDrop contract", () => {
    const deploy = async () => {
        const [owner] = await ethers.getSigners();

        const ISoulRegistry = await artifacts.readArtifact("ISoulRegistry");
        const ISoulAttributeRegistry = await artifacts.readArtifact("ISoulAttributeRegistry");

        const soulRegistryMock = await deployMockContract(owner, ISoulRegistry.abi);
        const soulAttributeRegistryMock = await deployMockContract(owner, ISoulAttributeRegistry.abi);

        const holdAmount = await ethers.deployContract("HoldAmount");
        const isVerified = await ethers.deployContract("IsVerified");

        const soulDrop = await ethers.deployContract("SoulDrop", [
            soulRegistryMock.address,
            soulAttributeRegistryMock.address,
            holdAmount.address,
            isVerified.address,
        ], owner)

        return {
            owner,
            contracts: { soulDrop, holdAmount, isVerified },
            mocks: { soulRegistryMock, soulAttributeRegistryMock },
        };
    };

    it("Should correctly initialize contract", async () => {
        const { owner, contracts } = await deploy();

        expect(await contracts.soulDrop.owner()).to.equal(owner.address, "Unexpected contract owner");
        expect(await contracts.soulDrop.paused()).to.equal(false);
    });

    it("Should receive funds only from owner", async () => {
        const { owner, contracts } = await deploy();
        const [, fake] = await ethers.getSigners();

        let estimateGasError;

        try {
            await fake.estimateGas({
                to: contracts.soulDrop.address,
                value: 1,
            });
        } catch (error) {
            estimateGasError = error;
        }

        expect(estimateGasError).not.to.be.undefined;
        expect(estimateGasError.error.message).to.equal("VM Exception while processing transaction: revert with reason \"Ownable: caller is not the owner\"");

        estimateGasError = undefined;

        try {
            await owner.estimateGas({
                to: contracts.soulDrop.address,
                value: 1,
            });
        } catch (error) {
            estimateGasError = error;
        }

        expect(estimateGasError).to.be.undefined;
    });

    it("Should correctly pause/unpause contract", async () => {
        const { owner, contracts } = await deploy();
        const [, fake] = await ethers.getSigners();

        await expect(contracts.soulDrop.connect(fake).pause())
            .to.be.revertedWith("Ownable: caller is not the owner");

        await expect(contracts.soulDrop.connect(fake).unpause())
            .to.be.revertedWith("Ownable: caller is not the owner");

        await expect(contracts.soulDrop.unpause())
            .to.be.revertedWith("Pausable: not paused");

        await expect(contracts.soulDrop.pause())
            .to.emit(contracts.soulDrop, "Paused(address)").withArgs(owner.address);

        await expect(contracts.soulDrop.pause())
            .to.be.revertedWith("Pausable: paused");

        await expect(contracts.soulDrop.unpause())
            .to.emit(contracts.soulDrop, "Unpaused(address)").withArgs(owner.address);
    });

    describe("Withhold soul reward", () => {
        it("Should be available only for owner", async () => {
            const { contracts } = await deploy();
            const [, fake] = await ethers.getSigners();

            await expect(contracts.soulDrop.connect(fake).withholdSoulReward(1))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be available only when not paused", async () => {
            const { contracts } = await deploy();

            await expect(contracts.soulDrop.pause()).not.to.be.reverted;
            await expect(contracts.soulDrop.withholdSoulReward(1))
                .to.be.revertedWith("Pausable: paused");
        });

        it("Should fail if soul doesn't exist", async () => {
            const { contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock['isSoul(uint256)'].withArgs(1).returns(false);

            await expect(contracts.soulDrop.withholdSoulReward(1))
                .to.be.revertedWith("SoulDrop: soul doesn't exist");
        });

        it("Should fail on empty reward", async () => {
            const { contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock["isSoul(uint256)"].withArgs(1).returns(true);
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns('0x' + '0'.repeat(40));

            await expect(contracts.soulDrop.withholdSoulReward(1))
                .to.be.revertedWith("SoulDrop: nothing to withhold");
        });

        it("Should correctly withhold reward and reset reward state for soul", async () => {
            const { contracts, mocks } = await deploy();

            const holdAmount = '0x0000000000000000000000008ac7230489e80000' // 10 WBT

            await mocks.soulRegistryMock.mock["isSoul(uint256)"].withArgs(1).returns(true);
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(holdAmount);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns((await time.latest()) - 30 * 24 * 60 * 60)

            // Initial state (reward = calculated amount, withholdings = 0, claimed at = 0)
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal(0);
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(0);

            await expect(contracts.soulDrop.withholdSoulReward(1)).not.to.be.reverted;

            // First withhold (reward = calculated amount, withholdings = reward, claimed at = last block timestamp)
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());

            await expect(contracts.soulDrop.withholdSoulReward(1)).not.to.be.reverted;
            const lastClaimedTimestamp = await time.latest();

            // Second withhold (same as previous, but claimed at must be updated)
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(lastClaimedTimestamp);

            await time.setNextBlockTimestamp(lastClaimedTimestamp + 30 * 24 * 60 * 60);
            await mine();

            // Interval should start from last claimed at, so it should equal 1 period
            // After it reward should be calculated from hold amount + withholdings
            // Reward = (10 WBT + 0.1316973381 WBT) + 1.316973381% = 0.133431756986262571
            // Reward should also include withholdings
            // Reward += 0.1316973381 = 0.265129095086262571
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("265129095086262571");
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(lastClaimedTimestamp);

            await expect(contracts.soulDrop.withholdSoulReward(1)).not.to.be.reverted;

            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("265129095086262571");
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal("265129095086262571");
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
        });
    });

    describe("Claim", () => {
        it("Should be disabled on pause", async () => {
            const { contracts } = await deploy();

            await expect(contracts.soulDrop.pause()).not.to.be.reverted;
            await expect(contracts.soulDrop.claim()).to.be.revertedWith("Pausable: paused");
        });

        it("Should require soul id presence in soul registry", async () => {
            const { owner, contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(0);

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: sender is not present in souls registry");
        });

        it("Should require IsVerified attribute value for claim", async () => {
            const { owner, contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(40));

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: soul is not verified");
        });

        it("Should require non zero reward amount", async () => {
            const { owner, contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(0);

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: nothing to claim");
        });

        it("Should revert if attribute updated at is malformed", async () => {
            const { owner, contracts, mocks } = await deploy();

            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns((await time.latest()) + 1000);

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: reward interval starts in future");
        });

        it("Should transfer reward only once, emit event and reset state", async () => {
            const { owner, contracts, mocks } = await deploy();

            const holdAmount = '0x0000000000000000000000008ac7230489e80000' // 10 WBT
            await setBalance(contracts.soulDrop.address, "0xde0b6b3a7640000"); // 1 WBT

            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(holdAmount);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns((await time.latest()) - 30 * 24 * 60 * 60);

            const result = contracts.soulDrop.connect(owner).claim();
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(contracts.soulDrop, "Claimed(uint256,uint256)")
                .withArgs(1, "131697338100000000");

            await expect(result).to.changeEtherBalance(owner, '131697338100000000');

            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal(0);
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal(0);

            expect(await ethers.provider.getBalance(contracts.soulDrop.address)).to.equal('0xc0cd4aba8135b00');

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: nothing to claim");
        });

        it("Should reset withholdings by soul after successful claim", async () => {
            const { owner, contracts, mocks } = await deploy();

            const holdAmount = '0x0000000000000000000000008ac7230489e80000' // 10 WBT
            await setBalance(contracts.soulDrop.address, "0xde0b6b3a7640000"); // 1 WBT

            await mocks.soulRegistryMock.mock["isSoul(uint256)"].withArgs(1).returns(true);
            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(holdAmount);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns((await time.latest()) - 30 * 24 * 60 * 60);

            await expect(contracts.soulDrop.withholdSoulReward(1)).not.to.be.reverted;
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal('131697338100000000');
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal('131697338100000000');

            const result = contracts.soulDrop.connect(owner).claim();
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(contracts.soulDrop, "Claimed(uint256,uint256)")
                .withArgs(1, "131697338100000000");

            await expect(result).to.changeEtherBalance(owner, '131697338100000000');

            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal(0);
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal(0);

            expect(await ethers.provider.getBalance(contracts.soulDrop.address)).to.equal('0xc0cd4aba8135b00');

            await expect(contracts.soulDrop.connect(owner).claim())
                .to.be.revertedWith("SoulDrop: nothing to claim");
        });

        it("Should not use withholdings when detecting hold level", async () => {
            const { owner, contracts, mocks } = await deploy();

            const holdAmount = '0x0000000000000000000000008ac7230489e80000' // 10 WBT
            await setBalance(contracts.soulDrop.address, "0xde0b6b3a7640000"); // 1 WBT

            await mocks.soulRegistryMock.mock["isSoul(uint256)"].withArgs(1).returns(true);
            await mocks.soulRegistryMock.mock["soulOf(address)"].withArgs(owner.address).returns(1);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.isVerified.address).returns('0x' + '0'.repeat(39) + '1');

            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(holdAmount);

            await mocks.soulAttributeRegistryMock.mock["soulAttributeUpdatedAt(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns((await time.latest()) - 30 * 24 * 60 * 60);

            await expect(contracts.soulDrop.withholdSoulReward(1)).not.to.be.reverted;
            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal("131697338100000000");
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal("131697338100000000");

            await time.setNextBlockTimestamp((await time.latest()) + 30 * 24 * 60 * 60);

            // As well as hold amount is less than min amount of min hold level,
            // caller should receive only withholdings, even when hold amount + withholdings > min amount.
            const updatedHoldAmount = '0x0000000000000000000000008ac7230489e7ffff' // 9.99999... WBT
            await mocks.soulAttributeRegistryMock.mock["soulAttributeValue(uint256,address)"]
                .withArgs(1, contracts.holdAmount.address).returns(updatedHoldAmount);

            const result = contracts.soulDrop.connect(owner).claim();
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(contracts.soulDrop, "Claimed(uint256,uint256)")
                .withArgs(1, "131697338100000000");

            await expect(result).to.changeEtherBalance(owner, '131697338100000000');

            expect(await contracts.soulDrop.claimedAtBySoul(1)).to.equal(await time.latest());
            expect(await contracts.soulDrop.withholdingsBySoul(1)).to.equal(0);
            expect(await contracts.soulDrop.getSoulReward(1)).to.equal(0);
        });
    });

    describe("Reward calculation", () => {
        const month = 30 * 24 * 60 * 60;

        const testCases = [
            {
                name: "Should return zero if hold level is zero",
                holdAmount: "1",
                interval: month,
                withholdings: "0",
                expectedReward: "0.0",
            },
            {
                name: "Should return zero if interval is less than 30 days",
                holdAmount: "10",
                interval: month - 1,
                withholdings: "0",
                expectedReward: "0.0",
            },
            {
                name: "Should return reward for one period",
                holdAmount: "10",
                interval: month,
                withholdings: "0",
                expectedReward: "0.1316973381",
            },
            {
                name: "Should not return more if interval is greater than period",
                holdAmount: "10",
                interval: month * 2 - 1,
                withholdings: "0",
                expectedReward: "0.1316973381",
            },
            {
                name: "Should use first hold level percent for all amounts in first hold level range",
                holdAmount: "199.999999999999999999",
                interval: month,
                withholdings: "0",
                expectedReward: "2.633946761999999999",
            },
        ];

        for (let testCase of testCases) {
            it(testCase.name, async () => {
                const { contracts } = await deploy();

                const rewardWei = await contracts.soulDrop.calculateReward(
                    testCase.interval,
                    ethers.utils.parseEther(testCase.holdAmount),
                    ethers.utils.parseEther(testCase.withholdings)
                );

                expect(ethers.utils.formatEther(rewardWei)).to.equal(testCase.expectedReward);
            })
        }

        it("Should correctly calculate reward for each hold level and intervals 1 month - 13 months", async () => {
            const holdingsTable = {
                "10": {
                    [month]: "0.1316973381",
                    [month * 2]: "0.265129095086262571",
                    [month * 3]: "0.400318112793834828",
                    [month * 4]: "0.537287533878651188",
                    [month * 5]: "0.67606080577926438",
                    [month * 6]: "0.816661684730751401",
                    [month * 7]: "0.959114239831481538",
                    [month * 8]: "1.103442857163442649",
                    [month * 9]: "1.24967224396683104",
                    [month * 10]: "1.397827432869619583",
                    [month * 11]: "1.547933786172828117",
                    [month * 12]: "1.700017000192229721",
                    [month * 13]: "1.854103109657236105",
                },
                "200": {
                    [month]: "2.633971298",
                    [month * 2]: "5.302631619993439024",
                    [month * 3]: "8.00643781544808883",
                    [month * 4]: "10.745852750473649264",
                    [month * 5]: "13.521345387060059004",
                    [month * 6]: "16.333390863359363484",
                    [month * 7]: "19.1824705750248835",
                    [month * 8]: "22.069072257621608993",
                    [month * 9]: "24.993690070121925892",
                    [month * 10]: "27.956824679500969692",
                    [month * 11]: "30.958983346446087707",
                    [month * 12]: "34.000680012195082633",
                    [month * 13]: "37.082435386518103321"
                },
                "4000": {
                    [month]: "52.69807236",
                    [month * 2]: "106.090416427614948992",
                    [month * 3]: "160.186178898016195313",
                    [month * 4]: "214.994626969676085943",
                    [month * 5]: "270.525149931940885418",
                    [month * 6]: "326.787260773519202881",
                    [month * 7]: "383.790597812161479012",
                    [month * 8]: "441.544926345809714839",
                    [month * 9]: "500.060140325500302522",
                    [month * 10]: "559.346264050306544745",
                    [month * 11]: "619.413453884611224988",
                    [month * 12]: "680.271999998003416344",
                    [month * 13]: "741.932328128097592316"
                },
                "10000": {
                    [month]: "131.8187804",
                    [month * 2]: "265.375179886614342416",
                    [month * 3]: "400.692103542722753706",
                    [month * 4]: "537.792758383213976974",
                    [month * 5]: "676.700657335016691201",
                    [month * 6]: "817.439623269594712645",
                    [month * 7]: "960.033793088598056187",
                    [month * 8]: "1104.507621863370550678",
                    [month * 9]: "1250.88588702902393882",
                    [month * 10]: "1399.193692633797750321",
                    [month * 11]: "1549.456473644433718647",
                    [month * 12]: "1701.700000308303118251",
                    [month * 13]: "1855.950382573035132355"
                },
                "16000": {
                    [month]: "211.0474224",
                    [month * 2]: "424.87865820635525136",
                    [month * 3]: "641.530427209306619053",
                    [month * 4]: "861.039933550162555755",
                    [month * 5]: "1083.444872110114373785",
                    [month * 6]: "1308.783434983322954257",
                    [month * 7]: "1537.094318035388472787",
                    [month * 8]: "1768.416727548329383359",
                    [month * 9]: "2002.790386953211757595",
                    [month * 10]: "2240.255543651585128272",
                    [month * 11]: "2480.852975926896236084",
                    [month * 12]: "2724.623999947067529925",
                    [month * 13]: "2971.610476859442926089"
                },
                "30000": {
                    [month]: "396.3761448",
                    [month * 2]: "797.989424538883685568",
                    [month * 3]: "1204.909035061880126667",
                    [month * 4]: "1617.205086466963995801",
                    [month * 5]: "2034.948615184454857174",
                    [month * 6]: "2458.211596216218622413",
                    [month * 7]: "2887.066955536579922572",
                    [month * 8]: "3321.588582657082008074",
                    [month * 9]: "3761.851343357259018299",
                    [month * 10]: "4207.931092583614065591",
                    [month * 11]: "4659.904687519025559423",
                    [month * 12]: "5117.850000824833560352",
                    [month * 13]: "5581.845934057887705243"
                },
                "60000": {
                    [month]: "796.0620402",
                    [month * 2]: "1602.685993264123106934",
                    [month * 3]: "2420.011991490753128566",
                    [month * 4]: "3248.182026411663028148",
                    [month * 5]: "4087.339973459767007402",
                    [month * 6]: "4937.631616964156940344",
                    [month * 7]: "5799.204675476765468747",
                    [month * 8]: "6672.208827435055682526",
                    [month * 9]: "7556.795737165195685186",
                    [month * 10]: "8453.119081230235495879",
                    [month * 11]: "9361.334575127863675791",
                    [month * 12]: "10281.600000342381798017",
                    [month * 13]: "11214.075231755596417227"
                },
                "100000": {
                    [month]: "1335.344342",
                    [month * 2]: "2688.52012911711412964",
                    [month * 3]: "4059.765472544810607723",
                    [month * 4]: "5449.321663080907299587",
                    [month * 5]: "6857.433213586238498094",
                    [month * 6]: "8284.347902010291109168",
                    [month * 7]: "9730.316814991381235752",
                    [month * 8]: "11195.594392039043252871",
                    [month * 9]: "12680.438470306405915379",
                    [month * 10]: "14185.110329960433856833",
                    [month * 11]: "15709.874740158018041178",
                    [month * 12]: "17255.00000563600533695",
                    [month * 13]: "18820.758013923365415331"
                },
                "160000": {
                    [month]: "2156.1271648",
                    [month * 2]: "4341.309856792428039744",
                    [month * 3]: "6555.939622298953989065",
                    [month * 4]: "8800.41328403912540483",
                    [month * 5]: "11075.133012234022508276",
                    [month * 6]: "13380.506396668091424931",
                    [month * 7]: "15716.946519722067900747",
                    [month * 8]: "18084.872030390077710414",
                    [month * 9]: "20484.707219294176320987",
                    [month * 10]: "22916.882094709769097537",
                    [month * 11]: "25381.832459615534469556",
                    [month * 12]: "27879.999989781656049767",
                    [month * 13]: "30411.832312910355743702"
                },
                "2000000": {
                    [month]: "28776.5775",
                    [month * 2]: "57967.200706306753125",
                    [month * 3]: "87577.827028098298635037",
                    [month * 4]: "117614.499591476131319181",
                    [month * 5]: "148083.348472785046935334",
                    [month * 6]: "178990.591949678349707321",
                    [month * 7]: "210342.537770183747272533",
                    [month * 8]: "242145.584440028932168847",
                    [month * 9]: "274406.222528489575503246",
                    [month * 10]: "307131.035993026238616951",
                    [month * 11]: "340326.703522980543124498",
                    [month * 12]: "373999.999902604829439605",
                    [month * 13]: "408157.797393703479602726"
                },
                "6000000": {
                    [month]: "100670.31078",
                    [month * 2]: "203029.7068054236307014",
                    [month * 3]: "307106.52819903601035011",
                    [month * 4]: "412929.590585096641826502",
                    [month * 5]: "520528.193067506615321336",
                    [month * 6]: "629932.12634181623740202",
                    [month * 7]: "741171.680943339048256838",
                    [month * 8]: "854277.655633655872516658",
                    [month * 9]: "969281.365927830864935628",
                    [month * 10]: "1086214.652764700470973018",
                    [month * 11]: "1205109.891322635834744095",
                    [month * 12]: "1325999.99998321946386617",
                    [month * 13]: "1448918.449445317913568228"
                },
            }

            const { contracts } = await deploy();

            for (let holdAmount in holdingsTable) {
                for (let interval in holdingsTable[holdAmount]) {
                    const holdAmountWei = ethers.utils.parseEther(holdAmount);
                    const rewardWei = await contracts.soulDrop.calculateReward(interval, holdAmountWei, 0);

                    const message = `Incorrect reward for hold amount ${holdAmount} and interval ${interval}`;
                    expect(ethers.utils.formatEther(rewardWei)).to.equal(holdingsTable[holdAmount][interval], message);
                }
            }
        })
    });
});
