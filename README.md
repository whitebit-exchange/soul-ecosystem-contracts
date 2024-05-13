# WB Soul Ecosystem

Whitechain aims to support the mass adoption of blockchain technology. Hence, we seek to
implement a corresponding tool that allows users to represent their identity in an anonymous
environment through blockchain without revealing their data.

To achieve this, we drew inspiration from the concept of Soulbound Tokens proposed in May
2022 by Ethereum co-founder Vitalik Buterin, lawyer Pujie Olhaver, and economist and social
technologist Glen Weyl. The article [“Decentralized Society: Finding Web3’s Soul”](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4105763) first introduced
this concept.

By building on the Soulbound Token idea, Whitechain empowers users to showcase their
identity securely within the blockchain while safeguarding their privacy. This innovative approach
enables users to engage with the decentralized world without compromising personal
information.

## WB Soul Explained

WB Soul serves as the central point in the entire ecosystem, representing individual identities
within the Whitechain.

Any user of the WhiteBIT can create a personal WB Soul on the [WB Soul Ecosystem](https://whitebit.com/wb-soul). To ensure the issuance of reliable WB Souls, WhiteBIT acts as the guarantor of identity verification. So, to make your WB Soul, you must undergo KYC Verification and link your Ethereum wallet to your WhiteBIT account.
After confirming the user’s identity, the contract owner (WhiteBIT) initiates a `registerSoul` function call to create a new WB Soul. The user’s verified wallet is associated with New Soul. In this way,

WhiteBIT, while creating the new WB Soul, verifies the user’s identity within the Whitechain without disclosing any personal data to the blockchain.

## WB Soul Features
We utilize a separate mechanism called WB Soul Features to characterize each WB Soul. As the
WB Soul is implemented within the WhiteBIT Ecosystem, the basic set of WB Soul
characteristics consists of attributes from the user’s WhiteBIT account.

All WB Soul Features are divided into two categories:
+ Soul Attributes
+ SoulBound Tokens

Soul Attributes and SoulBound Tokens (SBTs) characterize each WB Soul. However, their
difference lies in the following:
+ **Attributes**: These are mutable WB Soul characteristics (for example, the WBT Hold Amount
on WhiteBIT). They can change over time based on the user’s actions or other factors
+ **SBTs**: These are immutable characteristics of a WB Soul. They represent unique
accomplishments or statuses associated with the WB Soul. You can consider them to be
achievements or medals. Each SBT is issued only once and cannot be modified or
transferred.

At the start of the mainnet, we implemented several Features for all WB Souls:
+ [IsVerified Attribute](https://explorer.whitechain.io/address/0xd88fa142B67F561C5f2Cbf803bF5AE906a8f1e41)
+ [HoldAmount Attribute](https://explorer.whitechain.io/address/0xE6246B2C5bC67976eD6e28583e94a2a63ff36c93)
+ [SBT Collection EarlyBird](https://explorer.whitechain.io/address/0x57e0Dd3c3128CE9C580196Dc22F6204fc9A0bF18)
  
## WB Soul Ecosystem Implementation

The entire WB Soul Ecosystem is built on smart contracts. Logically, the ecosystem can be
divided into two main components:
+ ***Soul Component***
+ ***Soul Features Component***

The **Soul Component** serves as the foundation of the ecosystem – creating new WB Souls,
containing rules for all WB Souls, and managing all WB Souls. In contrast, the **Features
Component** complements and expands the logic and use cases of the WB Soul component.

Each of these components is built on top of governing contracts called **Registers**. These
managing contracts define the logic and architecture for all components’ derived contracts. As a result, we have created a hierarchical structure of interconnected smart contracts for the
isolated operation of the ecosystem.

# SoulDrop

The cornerstone of our rewards distribution mechanism is the [SoulDrop Contract](https://explorer.whitechain.io/address/0x0000000000000000000000000000000000001001). This contract governs the rules for distributing marketing activity rewards to holders of
WBT in the form of base coin – WhiteBIT Coin (WBT).

All transaction fees within the Whitechain
are collected at the SoulDrop Contract address. Fees are entirely redistributed among
WBT holders as a reward, fostering continuous circulation of WBT within the Whitechain. Furthermore, the contract balance can be replenished from internal WBT funds.

## How SoulDrop works

The reward distribution mechanism operates through an internal WhiteBIT mechanism called “**Holding**.”

>_**Holding** is an internal WhiteBIT mechanism that provides various benefits for locking WBT on the platform._

WhiteBIT users can lock their WBT in Hold and receive different benefits within WhiteBIT platform, including SoulDrop rewards.

The rewards calculation system, according to which users are encouraged with WBT for the
SoulDrop activity, operates on the principles of compounding. It means that the
reward accumulated in the previous period becomes part of the WBT holding body for
calculating the next reward.

**Please note**: The reward accumulated in previous periods is factored into the final calculation
but is not credited to the WB Soul every period. Therefore, the longer you hold, the greater the
final reward.

>_The period is a minimal fixed 30-day interval during which a WhiteBIT user needs to Hold WBT to receive rewards from SoulDrop._

The calculation of remuneration is based on the Amount of WBT in Holding, and the Holding Level
impacts the period reward percentage.

## Claiming WB Soul Rewards

In addition, the SoulDrop Mechanism follows a user focused approach, allowing every WB Soul
to claim rewards from the SoulDrop Contract independently. However, to be eligible for claiming
rewards, a WB Soul must have an IsVerified attribute set to True – WB Soul must have an active
KYC (Know Your Customer) Verification on the WhiteBIT.

To collect the rewards, the user with the WB Soul can initiate the process by calling up the Write
function on the SoulDrop Contract. The contract has been designed to allow the collection of
rewards from any address associated with the user’s WB Soul, except for those that have been
unbound.

# Setup

### Install dependencies
```bash
npm install
```

### Initialise environment
```bash
cp .env.example .env
```

[.env.example](./.env.example) contains description to available environment variables.

### Compile sources
```bash
npx hardhat compile
```

### Run tests
```bash
npx hardhat test
npx hardhat coverage
```

### Deploy contracts 
```bash
npx hardhat deploy
```

In order to use custom network, you need to set `RPC_URL` and `DEPLOYER_PRIVATE_KEY` environment variables
and run script with `--network custom` flag

```bash
npx hardhat deploy --network custom
```

In order to deploy a specific contract, you need to specify `--tags` flag in deployment script

```bash
npx hardhat deploy --network custom --tags SoulRegistry
```

Note: some contracts require dependencies, so make sure it is defined in environment
(see "Dependencies contracts addresses" section in [.env.example](./.env.example)).

Available tags:
- SoulRegistryConfig
- SoulRegistry (requires `SOUL_REGISTRY_CONFIG`)
- SoulAttributeRegistry (requires `SOUL_REGISTRY`)
- SoulBoundTokenRegistry (requires `SOUL_REGISTRY`)
- HoldAmount
- IsVerified
- SoulDrop (requires `SOUL_REGISTRY`, `SOUL_ATTRIBUTE_REGISTRY`, `HOLD_AMOUNT`, `IS_VERIFIED`)
