import 'dotenv/config';
import axios from 'axios';
import { cfg } from '../src/config.js';

/**
 * Test Magic Eden API for ApeChain support
 */

const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   TESTING MAGIC EDEN API                  ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log(`NPC Collection: ${cfg.npc}\n`);

  // Test 1: Check if ApeChain is supported
  console.log('📊 Test 1: Checking ApeChain support...');
  
  try {
    // Try to get collection info
    const url = `${MAGIC_EDEN_API}/apechain/collections/v7`;
    console.log(`Trying: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'accept': '*/*'
      }
    });
    
    console.log('✅ ApeChain IS supported by Magic Eden!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('❌ ApeChain is NOT supported by Magic Eden (404)');
    } else if (error.response?.status === 401) {
      console.log('⚠️  Endpoint exists but requires API key');
      console.log('Magic Eden supports ApeChain!');
    } else {
      console.log(`⚠️  Error: ${error.message}`);
    }
  }

  // Test 2: Try to get listings for NPC collection
  console.log('\n📋 Test 2: Checking for NPC listings...');
  
  try {
    const url = `${MAGIC_EDEN_API}/apechain/tokens/v7`;
    console.log(`Trying: ${url}`);
    
    const response = await axios.get(url, {
      params: {
        collection: cfg.npc,
        sortBy: 'floorAskPrice',
        limit: 5
      },
      headers: {
        'accept': '*/*'
      }
    });
    
    const tokens = response.data?.tokens || [];
    
    if (tokens.length > 0) {
      console.log(`✅ Found ${tokens.length} tokens!`);
      console.log('Sample:', JSON.stringify(tokens[0], null, 2));
    } else {
      console.log('⚠️  No tokens found');
    }
    
  } catch (error: any) {
    console.log(`⚠️  Error: ${error.response?.status} - ${error.message}`);
  }

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   CONCLUSION                              ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  console.log('Based on the tests above:');
  console.log('- If you see 404: ApeChain not supported yet');
  console.log('- If you see 401: Supported, but need API key');
  console.log('- If you see data: Fully working!\n');
}

main().catch((e) => { 
  console.error('❌ Error:', e.message); 
});
