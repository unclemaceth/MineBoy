const hre = require("hardhat");

async function main() {
  // Staging configuration
  const ADMIN = process.env.ADMIN_ADDRESS || "0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164";
  const BACKEND_SIGNER = process.env.BACKEND_SIGNER_ADDRESS || ADMIN;
  
  // Cartridge configuration for staging
  const CARTRIDGE_MAX_SUPPLY = 1000; // Smaller for staging
  const CARTRIDGE_MINT_PRICE = hre.ethers.parseEther("0.001"); // Lower price for testing
  const CARTRIDGE_BASE_URI = "https://staging-api.minerboy.io/cartridge/metadata/";

  console.log("🚀 Deploying MinerBoy v2 contracts to STAGING...");
  console.log(`📋 Admin: ${ADMIN}`);
  console.log(`📋 Backend Signer: ${BACKEND_SIGNER}`);
  console.log(`📋 Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);

  // 1. Deploy ApeBitToken
  console.log("\n1. Deploying ApeBitToken...");
  const ApeBitToken = await hre.ethers.getContractFactory("ApeBitToken");
  const token = await ApeBitToken.deploy(ADMIN);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`✅ ApeBitToken deployed at: ${tokenAddress}`);

  // 2. Prepare reward table (linear 8..128 ABIT with 18 decimals)
  console.log("\n2. Preparing reward table...");
  const rewardTable = [];
  for (let i = 0; i < 16; i++) {
    const amount = (i + 1) * 8; // 8, 16, 24, ..., 128
    const amountWei = hre.ethers.parseUnits(amount.toString(), 18);
    rewardTable.push(amountWei);
  }
  console.log("✅ Reward table prepared: 8-128 APEBIT across 16 tiers");

  // 3. Deploy MiningClaimRouter
  console.log("\n3. Deploying MiningClaimRouter...");
  const MiningClaimRouter = await hre.ethers.getContractFactory("MiningClaimRouter");
  const router = await MiningClaimRouter.deploy(
    tokenAddress,
    BACKEND_SIGNER,
    ADMIN,
    rewardTable
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ MiningClaimRouter deployed at: ${routerAddress}`);

  // 4. Grant MINTER_ROLE to router
  console.log("\n4. Granting MINTER_ROLE to router...");
  const MINTER_ROLE = await token.MINTER_ROLE();
  const grantTx = await token.grantRole(MINTER_ROLE, routerAddress);
  await grantTx.wait();
  console.log("✅ MINTER_ROLE granted to router");

  // 5. Deploy ApeBitCartridge
  console.log("\n5. Deploying ApeBitCartridge...");
  const ApeBitCartridge = await hre.ethers.getContractFactory("ApeBitCartridge");
  const cartridge = await ApeBitCartridge.deploy(
    ADMIN,
    CARTRIDGE_MAX_SUPPLY,
    CARTRIDGE_MINT_PRICE,
    CARTRIDGE_BASE_URI
  );
  await cartridge.waitForDeployment();
  const cartridgeAddress = await cartridge.getAddress();
  console.log(`✅ ApeBitCartridge deployed at: ${cartridgeAddress}`);

  // 6. Allow cartridge in router
  console.log("\n6. Allowing cartridge in router...");
  const allowTx = await router.setCartridgeAllowed(cartridgeAddress, true);
  await allowTx.wait();
  console.log("✅ Cartridge allowed in router");

  // 7. Mint test cartridges to admin
  console.log("\n7. Minting test cartridges to admin...");
  const mintTx = await cartridge.adminMint(ADMIN, 3); // Mint 3 for testing
  await mintTx.wait();
  console.log("✅ Test cartridges minted to admin");

  // Print deployment summary
  console.log("\n=== STAGING DEPLOYMENT SUMMARY ===");
  console.log(`Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);
  console.log(`ApeBitToken: ${tokenAddress}`);
  console.log(`MiningClaimRouter: ${routerAddress}`);
  console.log(`ApeBitCartridge: ${cartridgeAddress}`);
  console.log(`Admin: ${ADMIN}`);
  console.log(`Backend Signer: ${BACKEND_SIGNER}`);

  console.log("\n=== STAGING ENVIRONMENT VARIABLES ===");
  console.log(`REWARD_TOKEN_ADDRESS_STAGING=${tokenAddress}`);
  console.log(`ROUTER_ADDRESS_STAGING=${routerAddress}`);
  console.log(`CARTRIDGE_ADDRESS_STAGING=${cartridgeAddress}`);
  console.log(`ADMIN_ADDRESS_STAGING=${ADMIN}`);
  console.log(`BACKEND_SIGNER_STAGING=${BACKEND_SIGNER}`);
  console.log(`CHAIN_ID_STAGING=${hre.network.config.chainId}`);

  console.log("\n=== REWARD TIER VERIFICATION ===");
  for (let i = 0; i < 16; i++) {
    const amount = await router.rewardPerTier(i);
    const amountFormatted = hre.ethers.formatUnits(amount, 18);
    console.log(`Tier ${i} (0x${i.toString(16)}): ${amountFormatted} APEBIT`);
  }

  console.log("\n=== NEXT STEPS ===");
  console.log("1. Update staging backend .env with the addresses above");
  console.log("2. Update staging frontend wagmi config with contract addresses");
  console.log("3. Test mining flow end-to-end on staging");
  console.log("4. Verify all 16 reward tiers work correctly");
  console.log("5. Test claimV2 functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Staging deployment failed:", error);
    process.exit(1);
  });

