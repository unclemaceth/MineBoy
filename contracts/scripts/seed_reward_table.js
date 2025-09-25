const hre = require("hardhat");

async function main() {
  // Configuration
  const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;
  
  if (!ROUTER_ADDRESS) {
    throw new Error("ROUTER_ADDRESS environment variable is required");
  }

  console.log("🌱 Seeding reward table...");
  console.log(`📋 Router Address: ${ROUTER_ADDRESS}`);

  // Get the router contract
  const MiningClaimRouter = await hre.ethers.getContractFactory("MiningClaimRouter");
  const router = MiningClaimRouter.attach(ROUTER_ADDRESS);

  // Prepare reward table (linear 8..128 ABIT with 18 decimals)
  const rewardTable = [];
  for (let i = 0; i < 16; i++) {
    const amount = (i + 1) * 8; // 8, 16, 24, ..., 128
    const amountWei = hre.ethers.parseUnits(amount.toString(), 18);
    rewardTable.push(amountWei);
    console.log(`Tier ${i} (0x${i.toString(16)}): ${amount} ABIT`);
  }

  // Set the reward table
  console.log("\n📝 Setting reward table on contract...");
  const tx = await router.setRewardTable(rewardTable);
  await tx.wait();

  console.log("✅ Reward table seeded successfully!");
  console.log(`🔗 Transaction: ${tx.hash}`);

  // Verify the table was set correctly
  console.log("\n🔍 Verifying reward table...");
  for (let i = 0; i < 16; i++) {
    const amount = await router.rewardPerTier(i);
    const amountFormatted = hre.ethers.formatUnits(amount, 18);
    console.log(`Tier ${i} (0x${i.toString(16)}): ${amountFormatted} ABIT`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
