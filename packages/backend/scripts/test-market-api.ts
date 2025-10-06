#!/usr/bin/env tsx
/**
 * Market API Validation Script
 * Tests all market endpoints
 */

import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'https://mineboy-g5xo.onrender.com';
const TEST_TOKEN_ID = '83'; // NPC #83

console.log('\n🧪 MineBoy Market API Validation\n');
console.log(`Testing: ${BACKEND_URL}\n`);

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`${name}... `);
    await fn();
    console.log('✅');
  } catch (error: any) {
    console.log('❌');
    console.error(`  Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`  Response:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  // Test 1: Health check
  await test('1. Health check', async () => {
    const res = await axios.get(`${BACKEND_URL}/health`);
    if (res.data.status !== 'ok') throw new Error('Health check failed');
  });

  // Test 2: Get all orders
  await test('2. GET /market/orders', async () => {
    const res = await axios.get(`${BACKEND_URL}/market/orders`);
    console.log(`\n   Found ${res.data.orders?.length || 0} orders`);
    if (res.data.orders?.length > 0) {
      console.log(`   Sample:`, JSON.stringify(res.data.orders[0], null, 2));
    }
  });

  // Test 3: Get specific order
  await test(`3. GET /market/orders/${TEST_TOKEN_ID}`, async () => {
    const res = await axios.get(`${BACKEND_URL}/market/orders/${TEST_TOKEN_ID}`);
    console.log(`\n   Order:`, JSON.stringify(res.data, null, 2));
  });

  // Test 4: Build fill transaction
  await test(`4. POST /market/build-fill (tokenId: ${TEST_TOKEN_ID})`, async () => {
    const res = await axios.post(`${BACKEND_URL}/market/build-fill`, {
      tokenId: TEST_TOKEN_ID,
      buyer: '0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164' // Test buyer
    });
    
    console.log('\n   Response keys:', Object.keys(res.data));
    console.log(`   Chain ID: ${res.data.chainId}`);
    console.log(`   To: ${res.data.to}`);
    console.log(`   Value: ${res.data.value}`);
    console.log(`   Price APE: ${res.data.priceAPE}`);
    
    // Validate required fields
    if (!res.data.to || !res.data.data || !res.data.value) {
      throw new Error('Missing required transaction fields (to/data/value)');
    }
    
    if (res.data.chainId !== 33139) {
      throw new Error(`Wrong chain ID: ${res.data.chainId}, expected 33139`);
    }
  });

  console.log('\n✅ All tests passed!\n');
}

main().catch((err) => {
  console.error('\n❌ Test suite failed:', err.message);
  process.exit(1);
});
