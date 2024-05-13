import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressFromEnv } from "../utils/env";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    await hre.deployments.deploy("SoulDrop", {
        from: deployer,
        log: true,
        args: [
            getAddressFromEnv("SOUL_REGISTRY"),
            getAddressFromEnv("SOUL_ATTRIBUTE_REGISTRY"),
            getAddressFromEnv("HOLD_AMOUNT"),
            getAddressFromEnv("IS_VERIFIED"),
        ],
    });
};

export default deploy;
deploy.tags = ["all", "SoulDrop"];
