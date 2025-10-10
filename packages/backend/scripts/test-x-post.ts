/**
 * Test X API posting for MineBoy
 */

import 'dotenv/config';
import { postTweet, formatGameStatsForX } from '../src/utils/twitter.js';

const testStats = {
  totalClaims: 1234,
  activeMiners: 42,
  totalMiners: 567,
  topMiner: {
    wallet: '0x1234567890abcdef1234567890abcdef12345678',
    arcadeName: 'TESTARCADE',
    mnestr: '123456.789'
  },
  topTeam: {
    name: 'Test Team',
    emoji: '🔥',
    score: '987654.321'
  },
  date: new Date().toISOString().split('T')[0]
};

console.log('=== X API Test for MineBoy ===\n');

const formatted = formatGameStatsForX(testStats);
console.log('Formatted tweet:');
console.log('---');
console.log(formatted);
console.log('---');
console.log(`Length: ${formatted.length} characters\n`);

if (formatted.length > 280) {
  console.error('❌ Tweet is too long!');
  process.exit(1);
}

console.log('Posting to X...\n');

postTweet(formatted)
  .then(() => {
    console.log('\n✅ Test complete!');
    console.log('Check your X timeline: @mineboy_app');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });

