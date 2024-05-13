import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();

    const holdAmount = await hre.deployments.deploy("HoldAmount", { from: deployer, log: true });

    process.env.HOLD_AMOUNT = holdAmount.address;
};

export default deploy;
deploy.tags = ["all", "HoldAmount"];
