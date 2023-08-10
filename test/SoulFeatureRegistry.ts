import "@nomiclabs/hardhat-waffle"
import { expect } from "chai";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface setup {
    registry: Contract
    registryOwner: SignerWithAddress
    featureOwner: SignerWithAddress
    featureAddress: string
    unsupportedFeatureAddress: string
}

export default (setup: () => Promise<setup>) => {
    it("Should not allow no one except owner to register features", async () => {
        const { registry, featureOwner } = await setup();

        await expect(registry.connect(featureOwner).registerFeature(registry.address))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail on passing non contract address", async () => {
        const { registry, registryOwner } = await setup();

        await expect(registry.registerFeature(registryOwner.address))
            .to.be.revertedWith("SoulFeatureRegistry: specified address is not a contract");
    });

    it("Should fail on passing contract that doesn't implement wanted interface", async () => {
        const { registry, unsupportedFeatureAddress } = await setup();

        await expect(registry.registerFeature(registry.address))
            .to.be.revertedWith("function selector was not recognized and there's no fallback function");

        await expect(registry.registerFeature(unsupportedFeatureAddress))
            .to.be.revertedWith("SoulFeatureRegistry: feature is incompatible");
    });

    it("Should follow feature status change flow", async () => {
        const { registry, featureAddress, featureOwner } = await setup();

        const registerFeature = registry.registerFeature(featureAddress);

        await expect(registerFeature).not.to.be.reverted;
        await expect(registerFeature).to.emit(registry, "FeatureStatusChanged").withArgs(featureAddress, 0, 1);

        expect(await registry.featureStatus(featureAddress)).to.equal(1);
        expect(await registry.featurePausedAt(featureAddress)).to.equal(0);

        await expect(registry.registerFeature(featureAddress))
            .to.be.revertedWith("SoulFeatureRegistry: feature already exists");

        await expect(registry.connect(featureOwner).pauseFeature(featureAddress))
            .to.be.revertedWith("Ownable: caller is not the owner");

        const pauseFeature = registry.pauseFeature(featureAddress);

        await expect(pauseFeature).not.to.be.reverted;
        await expect(pauseFeature).to.emit(registry, "FeatureStatusChanged").withArgs(featureAddress, 1, 2);

        expect(await registry.featureStatus(featureAddress)).to.equal(2);
        expect(await registry.featurePausedAt(featureAddress)).not.to.equal(0);

        await expect(registry.pauseFeature(featureAddress))
            .to.be.revertedWith("SoulFeatureRegistry: feature is not active");

        await expect(registry.registerFeature(featureAddress))
            .to.be.revertedWith("SoulFeatureRegistry: feature already exists");

        await expect(registry.connect(featureOwner).unpauseFeature(featureAddress))
            .to.be.revertedWith("Ownable: caller is not the owner");

        const unpauseFeature = registry.unpauseFeature(featureAddress);

        await expect(unpauseFeature).not.to.be.reverted;
        await expect(unpauseFeature).to.emit(registry, "FeatureStatusChanged").withArgs(featureAddress, 2, 1);

        expect(await registry.featureStatus(featureAddress)).to.equal(1);
        expect(await registry.featurePausedAt(featureAddress)).to.equal(0);

        await expect(registry.unpauseFeature(featureAddress))
            .to.be.revertedWith("SoulFeatureRegistry: feature is not paused");
    });
};