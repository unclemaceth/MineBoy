import Stage from "@/components/Stage";
import Link from "next/link";

export default function InstructionsPage() {
    return (
      <Stage>
        <div style={{
          padding: '20px',
          fontFamily: 'monospace',
          color: '#c8ffc8',
          height: '100%',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '30px'
          }}>
            <Link 
              href="/" 
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              ← BACK
            </Link>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}>
              HOW TO
            </h1>
          </div>
  
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                1) GET CARTRIDGE
              </h2>
              <p style={{ fontSize: '12px', lineHeight: '1.4', margin: 0 }}>
                Go to <a href="/mint" style={{ color: '#4a7d5f', textDecoration: 'underline' }}>Mint page</a> and mint 1-10 cartridges on Curtis testnet.
              </p>
            </div>

            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                2) FIND TOKEN IDs
              </h2>
              <p style={{ fontSize: '12px', lineHeight: '1.4', margin: 0 }}>
                Check Curtis explorer → ERC-721 Transfers → copy your token IDs.
              </p>
            </div>

            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                3) START MINING
              </h2>
              <ol style={{ fontSize: '12px', lineHeight: '1.4', margin: 0, paddingLeft: '16px' }}>
                <li style={{ marginBottom: '4px' }}>Connect wallet</li>
                <li style={{ marginBottom: '4px' }}>Insert cartridge token ID</li>
                <li style={{ marginBottom: '4px' }}>Press <strong>A</strong> to mine</li>
                <li style={{ marginBottom: '4px' }}>Press <strong>Claim</strong> when found</li>
              </ol>
            </div>

            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                STATUS LEDs
              </h2>
              <div style={{ fontSize: '11px', lineHeight: '1.3', margin: 0 }}>
                <div><strong>PWR</strong>: on • <strong>NET</strong>: connected • <strong>CART</strong>: inserted</div>
                <div><strong>MINE</strong>: blinking • <strong>HASH</strong>: found</div>
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                TROUBLESHOOTING
              </h2>
              <div style={{ fontSize: '11px', lineHeight: '1.3', margin: 0 }}>
                <div>• Wallet popup blocked → enable popups</div>
                <div>• Cartridge lock → close other tabs</div>
                <div>• Wrong network → switch to Curtis</div>
                <div>• No token IDs → refresh explorer</div>
              </div>
            </div>
          </div>
        </div>
      </Stage>
    );
  }
  