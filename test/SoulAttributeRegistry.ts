import "@nomiclabs/hardhat-waffle"
import { ethers } from "hardhat";
import { expect } from "chai";
import featureExpectations from "./SoulFeatureRegistry";

const SOUL_ID = 1;
const EMPTY_VALUE = "0x0000000000000000000000000000000000000000";
const NOT_EMPTY_VALUE = "0x0000000000000000000000000000000000000001";
const NOT_EMPTY_VALUE_2 = "0x0000000000000000000000000000000000000002";
const INVALID_VALUE = "0x000000000000000000000000000000000000000c";

const setup = async () => {
    const [registryOwner, featureOwner] = await ethers.getSigners();

    const config = await ethers.deployContract("SoulRegistryConfig", registryOwner);
    const soulRegistry = await ethers.deployContract("SoulRegistry", [config.address], registryOwner);

    const registry = await ethers.deployContract("SoulAttributeRegistry", [soulRegistry.address], registryOwner);
    const attribute = await ethers.deployContract("HoldLevel", featureOwner);
    const sbt = await ethers.deployContract("EarlyBird", [""], featureOwner);

    const registerSoul = soulRegistry.registerSoul(registryOwner.address);
    await expect(registerSoul).not.to.be.reverted;

    return {
        registry,
        attribute,
        sbt,
        registryOwner,
        featureOwner,
        featureAddress: attribute.address,
        unsupportedFeatureAddress: sbt.address,
    };
}

describe("SoulAttributeRegistry contract", () => {
    describe("SoulFeatureRegistry flow", () => {
        it("Should correctly initialize contracts", async () => {
            const { registry, attribute, sbt, registryOwner, featureOwner } = await setup();

            expect(await registry.owner()).to.equal(registryOwner.address);
            expect(await attribute.owner()).to.equal(featureOwner.address);
            expect(await sbt.owner()).to.equal(featureOwner.address);
            expect(await registry.featureStatus(attribute.address)).to.equal(0);
            expect(await registry.featurePausedAt(attribute.address)).to.equal(0);
            expect(await registry.soulAttributeValue(SOUL_ID, attribute.address)).to.equal(EMPTY_VALUE);
        });

        featureExpectations(setup as any)
    });

    describe("Attributes flow", () => {
        const setupAndRegister = async () => {
            const { registry, attribute, registryOwner, featureOwner } = await setup();

            const registerFeature = registry.registerFeature(attribute.address);

            await expect(registerFeature).not.to.be.reverted;
            await expect(registerFeature).to.emit(registry, "FeatureStatusChanged").withArgs(attribute.address, 0, 1);

            return { registry, attribute, registryOwner, featureOwner };
        };

        it("Should return empty values on initial state", async () => {
            const { registry, attribute } = await setupAndRegister();

            expect(await registry.soulAttributeValue(SOUL_ID, attribute.address))
                .to.equal(EMPTY_VALUE);

            expect(await registry.attributesCountBySoul(SOUL_ID)).to.equal(0);
            expect(await registry.soulsCountByAttribute(attribute.address)).to.equal(0);
        });

        it("Should not set nonexistent attribute", async () => {
            const { registry } = await setupAndRegister();

            await expect(registry.setAttribute(SOUL_ID, registry.address, NOT_EMPTY_VALUE))
                .to.be.revertedWith("SoulFeatureRegistry: feature does not exist or is paused");
        });

        it("Should not set paused attribute", async () => {
            const { registry, attribute } = await setupAndRegister();

            const pauseFeature = registry.pauseFeature(attribute.address);

            await expect(pauseFeature).not.to.be.reverted;
            await expect(pauseFeature).to.emit(registry, "FeatureStatusChanged").withArgs(attribute.address, 1, 2);

            await expect(registry.setAttribute(SOUL_ID, attribute.address, NOT_EMPTY_VALUE))
                .to.be.revertedWith("SoulFeatureRegistry: feature does not exist or is paused");
        });

        it("Should not set attribute to nonexistent soul", async () => {
            const { registry, attribute } = await setupAndRegister();

            await expect(registry.setAttribute(0, attribute.address, NOT_EMPTY_VALUE))
                .to.be.revertedWith("SoulFeatureRegistry: there is no soul with such id in registry");
        });

        it("Should not allow anyone except attribute owner to set attribute", async () => {
            const { registry, attribute, registryOwner } = await setupAndRegister();

            await expect(registry.connect(registryOwner).setAttribute(1, attribute.address, NOT_EMPTY_VALUE))
                .to.be.revertedWith("HoldLevel: permission denied");
        });

        it("Should not allow to set invalid value", async () => {
            const { registry, attribute, featureOwner } = await setupAndRegister();

            await expect(registry.connect(featureOwner).setAttribute(1, attribute.address, INVALID_VALUE))
                .to.be.revertedWith("HoldLevel: level should be in range [1, 11]");
        });

        it("Should not allow to call setAttribute with the same value", async () => {
            const { registry, attribute, featureOwner } = await setupAndRegister();

            await expect(registry.connect(featureOwner).setAttribute(1, attribute.address, EMPTY_VALUE))
                .to.be.revertedWith("SoulAttributeRegistry: soul attribute will not change");
        });

        it("Should successfully update attribute value for soul", async () => {
            const { registry, attribute, featureOwner } = await setupAndRegister();

            expect(await registry.soulAttributeSetAt(SOUL_ID, attribute.address)).to.equal(0);
            expect(await registry.soulAttributeUpdatedAt(SOUL_ID, attribute.address)).to.equal(0);

            let result = registry.connect(featureOwner).setAttribute(1, attribute.address, NOT_EMPTY_VALUE);
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(registry, "AttributeValueChanged").withArgs(
                SOUL_ID,
                attribute.address,
                EMPTY_VALUE,
                NOT_EMPTY_VALUE,
            );

            expect(await registry.attributesCountBySoul(SOUL_ID)).to.equal(1);
            expect(await registry.soulsCountByAttribute(attribute.address)).to.equal(1);
            expect(await registry.attributeBySoulAtIndex(SOUL_ID, 0)).to.equal(attribute.address);
            expect(await registry.soulByAttributeAtIndex(attribute.address, 0)).to.equal(SOUL_ID);
            expect(await registry.soulAttributeValue(SOUL_ID, attribute.address))
                .to.equal(NOT_EMPTY_VALUE);

            expect(await registry.soulAndValueByAttributeAtIndex(attribute.address, 0))
                .deep.equal([ethers.BigNumber.from(SOUL_ID), NOT_EMPTY_VALUE]);

            const setAt = await registry.soulAttributeSetAt(SOUL_ID, attribute.address);
            expect(setAt).to.be.gt(0);
            const firstUpdatedAt = await registry.soulAttributeUpdatedAt(SOUL_ID, attribute.address);
            expect(firstUpdatedAt).to.equal(setAt);

            result = registry.connect(featureOwner).setAttribute(1, attribute.address, NOT_EMPTY_VALUE_2);
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(registry, "AttributeValueChanged").withArgs(
                SOUL_ID,
                attribute.address,
                NOT_EMPTY_VALUE,
                NOT_EMPTY_VALUE_2,
            );

            expect(await registry.attributesCountBySoul(SOUL_ID)).to.equal(1);
            expect(await registry.soulsCountByAttribute(attribute.address)).to.equal(1);
            expect(await registry.attributeBySoulAtIndex(SOUL_ID, 0)).to.equal(attribute.address);
            expect(await registry.soulByAttributeAtIndex(attribute.address, 0)).to.equal(SOUL_ID);
            expect(await registry.soulAttributeValue(SOUL_ID, attribute.address))
                .to.equal(NOT_EMPTY_VALUE_2);

            expect(await registry.soulAndValueByAttributeAtIndex(attribute.address, 0))
                .deep.equal([ethers.BigNumber.from(SOUL_ID), NOT_EMPTY_VALUE_2]);

            expect(await registry.soulAttributeSetAt(SOUL_ID, attribute.address)).to.equal(setAt);
            expect(await registry.soulAttributeUpdatedAt(SOUL_ID, attribute.address)).to.be.gt(firstUpdatedAt);

            result = registry.connect(featureOwner).setAttribute(1, attribute.address, EMPTY_VALUE);
            await expect(result).not.to.be.reverted;
            await expect(result).to.emit(registry, "AttributeValueChanged").withArgs(
                SOUL_ID,
                attribute.address,
                NOT_EMPTY_VALUE_2,
                EMPTY_VALUE,
            );

            expect(await registry.attributesCountBySoul(SOUL_ID)).to.equal(0);
            expect(await registry.soulsCountByAttribute(attribute.address)).to.equal(0);
            expect(await registry.soulAttributeValue(SOUL_ID, attribute.address)).to.equal(EMPTY_VALUE);
            expect(await registry.soulAttributeUpdatedAt(SOUL_ID, attribute.address)).to.equal(0);
            expect(await registry.soulAttributeSetAt(SOUL_ID, attribute.address)).to.equal(0);
        });
    });
});
