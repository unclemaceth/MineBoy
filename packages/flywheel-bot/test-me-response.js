import axios from 'axios';

const NPC = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const FLYWHEEL = '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4';

async function test() {
  try {
    const response = await axios.post(
      'https://api-mainnet.magiceden.dev/v3/rtp/apechain/execute/list/v5',
      {
        maker: FLYWHEEL,
        source: "magiceden.io",
        params: [{
          token: `${NPC}:83`,
          weiPrice: "55464000000000000000",
          orderKind: "seaport-v1.6",
          orderbook: "reservoir",
          automatedRoyalties: true,
          currency: "0x0000000000000000000000000000000000000000",
          expirationTime: String(Math.floor(Date.now() / 1000) + (7 * 24 * 3600))
        }]
      },
      { headers: { 'accept': '*/*', 'Content-Type': 'application/json' } }
    );
    
    console.log('Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Look for conduit/verifyingContract
    const steps = response.data?.steps || [];
    for (const step of steps) {
      console.log(`\n=== STEP: ${step.action || step.id} ===`);
      for (const item of step.items || []) {
        if (item.data?.to) {
          console.log('Approval To:', item.data.to);
        }
        if (item.data?.domain) {
          console.log('Domain:', item.data.domain);
          console.log('VerifyingContract:', item.data.domain.verifyingContract);
          console.log('ChainId:', item.data.domain.chainId);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test();
