import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    const isVerified = await hre.deployments.deploy("IsVerified", { from: deployer, log: true });

    process.env.IS_VERIFIED = isVerified.address;
};

export default deploy;
deploy.tags = ["all", "IsVerified"];
