import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressFromEnv } from "../utils/env";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    const soulAttributeRegistry = await hre.deployments.deploy("SoulAttributeRegistry", {
        from: deployer,
        log: true,
        args: [getAddressFromEnv("SOUL_REGISTRY")],
    });

    process.env.SOUL_ATTRIBUTE_REGISTRY = soulAttributeRegistry.address;
};

export default deploy;
deploy.tags = ["all", "SoulAttributeRegistry"];
