import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

// Thirdweb client ID
export const THIRDWEB_CLIENT_ID = "e7a5019a14a2d50878a05e317a79bb92";

// Prophet Token contract address on Base Sepolia
export const PROPHET_TOKEN_ADDRESS = "0x56d708c9Ad2bF03aDea54C28617c9fDd2093c0bb";

// Create the Thirdweb client
export const client = createThirdwebClient({ 
  clientId: THIRDWEB_CLIENT_ID
});

// Export the chain for consistency
export const chain = baseSepolia; 