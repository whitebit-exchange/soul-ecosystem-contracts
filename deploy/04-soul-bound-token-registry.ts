import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressFromEnv } from "../utils/env";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    await hre.deployments.deploy("SoulBoundTokenRegistry", {
        from: deployer,
        log: true,
        args: [getAddressFromEnv("SOUL_REGISTRY")],
    });
};

export default deploy;
deploy.tags = ["all", "SoulBoundTokenRegistry"];
