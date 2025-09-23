import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export const config = {
  // Network
  RPC_URL: process.env.RPC_URL || 'https://curtis.rpc.caldera.xyz/http',
  CHAIN_ID: parseInt(process.env.CHAIN_ID || '33111'),
  
  // Contracts
  ROUTER_ADDRESS: process.env.ROUTER_ADDRESS as `0x${string}`,
  REWARD_TOKEN_ADDRESS: process.env.REWARD_TOKEN_ADDRESS as `0x${string}`,
  
  // Backend signer - try secret file first, then env var
  SIGNER_PRIVATE_KEY: (() => {
    // Try to read from secret file (Render)
    try {
      const secretKey = fs.readFileSync('/etc/secrets/private-key.txt', 'utf8').trim();
      return secretKey as `0x${string}`;
    } catch {
      // Fallback to environment variable (local development)
      return process.env.SIGNER_PRIVATE_KEY as `0x${string}`;
    }
  })(),
  SERVER_SALT: process.env.SERVER_SALT || 'minerboy_default_salt_2024',
  
  // Mining config
  INITIAL_REWARD_WEI: process.env.INITIAL_REWARD_WEI || '512000000000000000000', // 512e18
  CLAIMS_PER_EPOCH: parseInt(process.env.CLAIMS_PER_EPOCH || '20507'),
  JOB_TTL_MS: parseInt(process.env.JOB_TTL_MS || '60000'), // 1 minute
  
  // Cartridge config
  ALLOWED_CARTRIDGES: process.env.ALLOWED_CARTRIDGES 
    ? (process.env.ALLOWED_CARTRIDGES.startsWith('[') 
        ? JSON.parse(process.env.ALLOWED_CARTRIDGES) as `0x${string}`[]
        : [process.env.ALLOWED_CARTRIDGES as `0x${string}`])
    : [] as `0x${string}`[],
  // SUFFIX_ABIT removed - difficulty is now dynamic based on epochs
  
  // Server
  PORT: parseInt(process.env.PORT || '8787'),
  HOST: process.env.HOST || '0.0.0.0',
  
  // Admin
  ADMIN_TOKEN: process.env.ADMIN_KEY || '',
  EPOCH_OVERRIDE: process.env.EPOCH_OVERRIDE
};

// Validate required config
const required = [
  'ROUTER_ADDRESS',
  'REWARD_TOKEN_ADDRESS', 
  'SIGNER_PRIVATE_KEY'
];

for (const key of required) {
  if (!config[key as keyof typeof config]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Export admin configs for easy access
export const ADMIN_TOKEN = config.ADMIN_TOKEN;
export const EPOCH_OVERRIDE = config.EPOCH_OVERRIDE;
