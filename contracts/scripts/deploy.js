const hre = require("hardhat");

async function main() {
  // Configuration for development (ab17 suffix)
  const DEV_SUFFIX_VALUE = 0xAB17;  // Must end with "ab17"
  const DEV_SUFFIX_MASK = 0xFFFF;   // 16 bits (4 hex digits)

  // For production, use these values instead:
  // const PROD_SUFFIX_VALUE = 0xA9EB17;  // Must end with "a9eb17"
  // const PROD_SUFFIX_MASK = 0xFFFFFF;   // 24 bits (6 hex digits)

  console.log("🚀 Deploying ApeBitClaim contract...");
  console.log(`📋 Suffix Value: 0x${DEV_SUFFIX_VALUE.toString(16).toUpperCase()}`);
  console.log(`📋 Suffix Mask:  0x${DEV_SUFFIX_MASK.toString(16).toUpperCase()}`);

  // Deploy the contract
  const ApeBitClaim = await hre.ethers.getContractFactory("ApeBitClaim");
  const contract = await ApeBitClaim.deploy(DEV_SUFFIX_VALUE, DEV_SUFFIX_MASK);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`✅ ApeBitClaim deployed to: ${address}`);
  console.log(`🔗 Chain ID: ${hre.network.config.chainId}`);
  console.log(`🌐 Network: ${hre.network.name}`);

  // Verify the deployment
  const [value, mask] = await contract.getDifficulty();
  console.log(`🔍 Verified - Suffix Value: 0x${value.toString(16).toUpperCase()}`);
  console.log(`🔍 Verified - Suffix Mask:  0x${mask.toString(16).toUpperCase()}`);

  console.log("\n📝 Next steps:");
  console.log(`1. Update your web app's contract address to: ${address}`);
  console.log(`2. Update your iOS app's CONTRACT_ADDR to: ${address}`);
  console.log(`3. Ensure both apps use chainId: ${hre.network.config.chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
