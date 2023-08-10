import "@nomiclabs/hardhat-waffle"
import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import featureExpectations from "./SoulFeatureRegistry";

const SOUL_ID = 1;
const TOKEN_ID = 1;

const setup = async () => {
    const [registryOwner, featureOwner] = await ethers.getSigners();

    const config = await ethers.deployContract("SoulRegistryConfig", registryOwner);
    const soulRegistry = await ethers.deployContract("SoulRegistry", [config.address], registryOwner);

    const registry = await ethers.deployContract("SoulBoundTokenRegistry", [soulRegistry.address], registryOwner);
    const attribute = await ethers.deployContract("IsVerified", featureOwner);
    const sbt = await ethers.deployContract("EarlyBird", [""], featureOwner);

    const registerSoul = soulRegistry.registerSoul(registryOwner.address);
    await expect(registerSoul).not.to.be.reverted;

    return {
        registry,
        attribute,
        sbt,
        registryOwner,
        featureOwner,
        featureAddress: sbt.address,
        unsupportedFeatureAddress: attribute.address,
    };
}

const tokenId = (collection: string, id: number): string => {
    return `${collection}${'0'.repeat(24 - id.toString(16).length)}${id.toString(16)}`;
}

const assertBound = async (registry: Contract, soulId: number, sbt: string, id: number, bound: boolean) => {
    expect(await registry.functions["isBound(bytes32,uint256)"](tokenId(sbt, id), soulId)).deep.equal([bound]);
    expect(await registry.functions["isBound(address,uint96,uint256)"](sbt, id, soulId)).deep.equal([bound]);
};

describe("SoulBoundTokenRegistry contract", () => {
    describe("SoulFeatureRegistry flow", () => {
        it("Should correctly initialize contracts", async () => {
            const { registry, attribute, sbt, registryOwner, featureOwner } = await setup();

            expect(await registry.owner()).to.equal(registryOwner.address);
            expect(await attribute.owner()).to.equal(featureOwner.address);
            expect(await sbt.owner()).to.equal(featureOwner.address);
            expect(await registry.featureStatus(sbt.address)).to.equal(0);
            expect(await registry.featurePausedAt(sbt.address)).to.equal(0);
        });

        featureExpectations(setup as any)
    });

    describe("SBT flow", () => {
        const setupAndRegister = async () => {
            const { registry, sbt, registryOwner, featureOwner } = await setup();

            const registerFeature = registry.registerFeature(sbt.address);

            await expect(registerFeature).not.to.be.reverted;
            await expect(registerFeature).to.emit(registry, "FeatureStatusChanged").withArgs(sbt.address, 0, 1);

            return { registry, sbt, registryOwner, featureOwner };
        };

        it("Should return empty values on initial state", async () => {
            const { registry, sbt } = await setupAndRegister();

            await assertBound(registry, SOUL_ID, sbt.address, TOKEN_ID, false);
            expect(await registry.tokensCountBySoul(SOUL_ID)).to.equal(0);
            expect(await registry.soulsCountByToken(tokenId(sbt.address, TOKEN_ID))).to.equal(0);
        });

        it("Should not set nonexistent token", async () => {
            const { registry } = await setupAndRegister();

            await expect(registry.bindToken(SOUL_ID, registry.address, TOKEN_ID))
                .to.be.revertedWith("SoulFeatureRegistry: feature does not exist or is paused");
        });

        it("Should not set paused token", async () => {
            const { registry, sbt } = await setupAndRegister();

            const pauseFeature = registry.pauseFeature(sbt.address);

            await expect(pauseFeature).not.to.be.reverted;
            await expect(pauseFeature).to.emit(registry, "FeatureStatusChanged").withArgs(sbt.address, 1, 2);

            await expect(registry.bindToken(SOUL_ID, sbt.address, TOKEN_ID))
                .to.be.revertedWith("SoulFeatureRegistry: feature does not exist or is paused");
        });

        it("Should not bind token to nonexistent soul", async () => {
            const { registry, sbt } = await setupAndRegister();

            await expect(registry.bindToken(0, sbt.address, TOKEN_ID))
                .to.be.revertedWith("SoulFeatureRegistry: there is no soul with such id in registry");
        });

        it("Should not allow anyone except attribute owner to set attribute", async () => {
            const { registry, sbt, registryOwner } = await setupAndRegister();

            await expect(registry.connect(registryOwner).bindToken(SOUL_ID, sbt.address, TOKEN_ID))
                .to.be.revertedWith("EarlyBird: permission denied");
        });

        it("Should not allow to bind unsupported token", async () => {
            const { registry, sbt, featureOwner } = await setupAndRegister();

            await expect(registry.connect(featureOwner).bindToken(SOUL_ID, sbt.address, 2))
                .to.be.revertedWith("EarlyBird: token does not exist");
        });

        it("Should bind token to a soul once", async () => {
            const { registry, sbt, featureOwner } = await setupAndRegister();

            const expectedTokenId = tokenId(sbt.address, TOKEN_ID).toLowerCase();

            const result = registry.connect(featureOwner).bindToken(SOUL_ID, sbt.address, TOKEN_ID);
            await expect(result).not.to.be.reverted;
            await expect(result)
                .to.emit(registry, "TokenBound").withArgs(SOUL_ID, expectedTokenId);

            await assertBound(registry, SOUL_ID, sbt.address, TOKEN_ID, true);
            expect(await registry.tokensCountBySoul(SOUL_ID)).to.equal(1);
            expect(await registry.soulsCountByToken(expectedTokenId)).to.equal(1);
            expect(await registry.tokenBySoulAtIndex(SOUL_ID, 0)).to.equal(expectedTokenId);
            expect(await registry.soulByTokenAtIndex(expectedTokenId, 0)).to.equal(SOUL_ID);

            await expect(registry.connect(featureOwner).bindToken(SOUL_ID, sbt.address, TOKEN_ID))
                .to.be.revertedWith("SoulBoundTokenRegistry: token is already bound to soul");
        });
    });
});
