import { JsonRpcProvider, Contract } from 'ethers';

const RPC = 'https://rpc.apechain.com/http';
// Use lowercase to avoid checksum issues
const SEAPORT_1_6 = '0x0000000000000068f116a894984e2db1123eb395';
const CONDUIT_KEY = '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000';
const NPC_COLLECTION = '0xfa1c20e0d4277b1e0b289dffadb5bd92fb8486aa';
const FLYWHEEL = '0x08ad425ba1d1fc4d69d88b56f7c6879b2e85b0c4';

const SEAPORT_ABI = [
  'function getConduit(bytes32 conduitKey) view returns (bool exists, address conduit)'
];

const ERC721_ABI = [
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function getApproved(uint256 tokenId) view returns (address)'
];

async function main() {
  try {
    const provider = new JsonRpcProvider(RPC, 33139);
    
    console.log('=== SEAPORT 1.6 INFO ===\n');
    console.log('Seaport Contract:', SEAPORT_1_6);
    console.log('Conduit Key:', CONDUIT_KEY);
    
    // Get conduit address from Seaport
    const seaport = new Contract(SEAPORT_1_6, SEAPORT_ABI, provider);
    const [exists, conduitAddress] = await seaport.getConduit(CONDUIT_KEY);
    
    console.log('\nConduit Info:');
    console.log('  Exists:', exists);
    console.log('  Address:', conduitAddress);
    
    // Check if NFT collection is approved for the conduit
    const npc = new Contract(NPC_COLLECTION, ERC721_ABI, provider);
    const isApproved = await npc.isApprovedForAll(FLYWHEEL, conduitAddress);
    
    console.log('\nNFT Approval Status:');
    console.log('  Collection:', NPC_COLLECTION);
    console.log('  Owner (Flywheel):', FLYWHEEL);
    console.log('  Operator (Conduit):', conduitAddress);
    console.log('  Is Approved:', isApproved);
    
    // Check specific NFT approvals
    console.log('\nChecking specific NFT approvals:');
    for (const tokenId of ['83', '1077']) {
      try {
        const approved = await npc.getApproved(tokenId);
        console.log(`  NPC #${tokenId} approved to:`, approved);
      } catch (e) {
        console.log(`  NPC #${tokenId}: error -`, e.message.substring(0, 60));
      }
    }
    
    // Output approval transaction if needed
    if (!isApproved) {
      console.log('\n❌ CONDUIT NOT APPROVED!');
      console.log('\n=== APPROVAL TRANSACTION NEEDED ===');
      console.log('To:', NPC_COLLECTION);
      console.log('Function: setApprovalForAll(address,bool)');
      console.log('Params:', [conduitAddress, true]);
    } else {
      console.log('\n✅ CONDUIT ALREADY APPROVED!');
    }
    
    console.log('\n=== COMPLETE INFO PACKAGE FOR GPT ===');
    console.log(JSON.stringify({
      chain: 'ApeChain',
      chainId: 33139,
      seaportContract: SEAPORT_1_6,
      conduitKey: CONDUIT_KEY,
      conduitAddress: conduitAddress,
      nftCollection: NPC_COLLECTION,
      flywheelWallet: FLYWHEEL,
      conduitApproved: isApproved
    }, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
