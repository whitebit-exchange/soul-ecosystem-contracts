import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    const soulRegistryConfig = await hre.deployments.deploy("SoulRegistryConfig", {
        from: deployer,
        log: true,
    });

    process.env.SOUL_REGISTRY_CONFIG = soulRegistryConfig.address;
};

export default deploy;
deploy.tags = ["all", "SoulRegistryConfig"];
