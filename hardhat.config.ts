import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "solidity-coverage"
import "hardhat-deploy";
import * as dotenv from "dotenv";

dotenv.config();

module.exports = {
    solidity: "0.8.19",
    networks: {
        custom: {
            url: process.env.RPC_URL || "",
            accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY || "0".repeat(64)}`],
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
};
