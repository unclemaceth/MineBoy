import 'dotenv/config';
import { Wallet, JsonRpcProvider, Contract, keccak256, toUtf8Bytes } from 'ethers';

/**
 * Step 0: Grant MINTER_ROLE to admin
 * 
 * This allows the admin to mint MNESTR for liquidity.
 * Run this ONCE before minting.
 */

const RPC = process.env.RPC_URL!;
const CHAIN_ID = Number(process.env.CHAIN_ID || 33139);
const MNESTR = process.env.MNESTR!;
const ADMIN_PK = process.env.ADMIN_PRIVATE_KEY!;

// MNESTR ABI for role management
const MNESTR_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account) external",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function getRoleAdmin(bytes32 role) view returns (bytes32)"
];

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   STEP 0: GRANT MINTER_ROLE               ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const admin = new Wallet(ADMIN_PK, provider);
  const mnestr = new Contract(MNESTR, MNESTR_ABI, admin);
  
  const adminAddr = await admin.getAddress();
  const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
  
  console.log(`MNESTR Token: ${MNESTR}`);
  console.log(`Admin Address: ${adminAddr}`);
  console.log(`MINTER_ROLE: ${MINTER_ROLE}\n`);
  
  // Check if admin already has MINTER_ROLE
  const hasMinterRole: boolean = await mnestr.hasRole(MINTER_ROLE, adminAddr);
  
  if (hasMinterRole) {
    console.log('✅ Admin already has MINTER_ROLE! You can mint.\n');
    process.exit(0);
  }
  
  console.log('❌ Admin does NOT have MINTER_ROLE');
  console.log('Attempting to grant...\n');
  
  try {
    const tx = await mnestr.grantRole(MINTER_ROLE, adminAddr);
    console.log(`Transaction sent: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ MINTER_ROLE granted! Block: ${rc?.blockNumber}\n`);
    
    // Verify
    const nowHasRole: boolean = await mnestr.hasRole(MINTER_ROLE, adminAddr);
    if (nowHasRole) {
      console.log('✅ Verified: Admin now has MINTER_ROLE!');
      console.log('\nNow run: npm run script:mint\n');
    } else {
      console.log('⚠️  Role grant failed verification');
    }
  } catch (error: any) {
    console.error('\n❌ Failed to grant role!');
    console.error('Error:', error.shortMessage || error.message);
    console.log('\n📝 Possible reasons:');
    console.log('1. This admin is not the DEFAULT_ADMIN_ROLE holder');
    console.log('2. You need to use the V3 Router deployer key');
    console.log('3. You need to use a different key that has DEFAULT_ADMIN_ROLE\n');
    
    // Try to help diagnose
    try {
      const DEFAULT_ADMIN: string = await mnestr.DEFAULT_ADMIN_ROLE();
      const hasDefaultAdmin: boolean = await mnestr.hasRole(DEFAULT_ADMIN, adminAddr);
      console.log(`Does this admin have DEFAULT_ADMIN_ROLE? ${hasDefaultAdmin ? 'YES ✅' : 'NO ❌'}`);
      
      if (!hasDefaultAdmin) {
        console.log('\n💡 Solution: Use the DEPLOYER private key (who deployed MNESTR)');
        console.log('   That address should have DEFAULT_ADMIN_ROLE\n');
      }
    } catch {}
    
    process.exit(1);
  }
}

main().catch((e) => { 
  console.error('❌ Error:', e); 
  process.exit(1); 
});
