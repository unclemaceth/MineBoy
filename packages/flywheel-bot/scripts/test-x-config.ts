/**
 * Test X API Configuration
 * Checks if credentials are loaded and can connect
 */

console.log('=== X API Configuration Test ===\n');

// Check environment variables
const hasApiKey = !!process.env.X_API_KEY;
const hasApiSecret = !!process.env.X_API_SECRET;
const hasAccessToken = !!process.env.X_ACCESS_TOKEN;
const hasAccessSecret = !!process.env.X_ACCESS_SECRET;

console.log('Environment Variables:');
console.log(`  X_API_KEY:        ${hasApiKey ? '✅ Set' : '❌ Missing'}`);
console.log(`  X_API_SECRET:     ${hasApiSecret ? '✅ Set' : '❌ Missing'}`);
console.log(`  X_ACCESS_TOKEN:   ${hasAccessToken ? '✅ Set' : '❌ Missing'}`);
console.log(`  X_ACCESS_SECRET:  ${hasAccessSecret ? '✅ Set' : '❌ Missing'}`);
console.log('');

if (hasApiKey && hasApiSecret && hasAccessToken && hasAccessSecret) {
  console.log('✅ All credentials present!');
  console.log('\nAttempting to initialize X client...\n');
  
  // Try to import and test
  import('../src/utils/twitter.js').then(async (mod) => {
    try {
      // Test posting (this will actually post if credentials work)
      const testMsg = `MineBoy Flywheel Bot - Connection Test\n\n${new Date().toISOString()}`;
      await mod.postTweet(testMsg);
      console.log('\n✅ X API is working! Check your timeline for the test post.');
    } catch (error: any) {
      console.error('\n❌ Failed to post:', error.message);
    }
  }).catch((err) => {
    console.error('Failed to load twitter module:', err);
  });
} else {
  console.log('❌ Missing credentials. X API will not work.');
  console.log('\nMake sure these are set in your Render environment:');
  console.log('  - X_API_KEY');
  console.log('  - X_API_SECRET');
  console.log('  - X_ACCESS_TOKEN');
  console.log('  - X_ACCESS_SECRET');
}

