import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressFromEnv } from "../utils/env";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    const soulRegistry = await hre.deployments.deploy("SoulRegistry", {
        from: deployer,
        log: true,
        args: [getAddressFromEnv("SOUL_REGISTRY_CONFIG")],
    });

    process.env.SOUL_REGISTRY = soulRegistry.address;
};

export default deploy;
deploy.tags = ["all", "SoulRegistry"];
