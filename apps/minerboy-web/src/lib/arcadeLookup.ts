/**
 * Arcade name lookup client
 * Resolves @ArcadeNames to wallet addresses via backend API
 */

export type ArcadeUser = {
  address: `0x${string}`;
  arcadeName: string;
  avatarUrl?: string;
};

const ARCADE_NAME_REGEX = /^@[a-zA-Z0-9_]{2,32}$/;

export function isValidArcadeName(input: string): boolean {
  return ARCADE_NAME_REGEX.test(input);
}

export async function lookupArcadeName(arcadeName: string): Promise<ArcadeUser> {
  // Validate format
  if (!isValidArcadeName(arcadeName)) {
    throw new Error('Invalid arcade name format. Use @Username (2-32 chars, alphanumeric + underscore)');
  }

  try {
    const response = await fetch(`/api/arcade/resolve?name=${encodeURIComponent(arcadeName)}`);
    
    if (response.status === 404) {
      throw new Error(`Arcade name "${arcadeName}" not found`);
    }
    
    if (!response.ok) {
      throw new Error('Failed to lookup arcade name');
    }

    const data = await response.json();
    return {
      address: data.address,
      arcadeName: data.arcadeName || arcadeName,
      avatarUrl: data.avatarUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error during lookup');
  }
}

/**
 * Detect input type: arcade name, address, or unknown
 */
export function detectRecipientType(input: string): 'arcade' | 'address' | 'unknown' {
  const trimmed = input.trim();
  
  if (trimmed.startsWith('@')) {
    return 'arcade';
  }
  
  if (trimmed.startsWith('0x') && trimmed.length === 42) {
    return 'address';
  }
  
  return 'unknown';
}

