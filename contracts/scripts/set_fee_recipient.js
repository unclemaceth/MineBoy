const { ethers } = require('hardhat');

async function main() {
  // The deployed MiningClaimRouter address
  const routerAddress = '0x5883d7a4a1b503ced7c799baf3d677a23093e564';
  
  // The new fee recipient address
  const newFeeRecipient = '0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5';
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Setting fee recipient with account:', deployer.address);
  
  // Connect to the deployed contract
  const routerContract = await ethers.getContractAt('MiningClaimRouter', routerAddress);
  
  // Check current fee recipient
  const currentRecipient = await routerContract.feeRecipient();
  console.log('Current fee recipient:', currentRecipient);
  
  // Set new fee recipient (only admin can do this)
  console.log('Setting fee recipient to:', newFeeRecipient);
  const tx = await routerContract.setFeeRecipient(newFeeRecipient);
  console.log('Transaction hash:', tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log('Fee recipient updated successfully!');
  
  // Verify the change
  const updatedRecipient = await routerContract.feeRecipient();
  console.log('New fee recipient:', updatedRecipient);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
