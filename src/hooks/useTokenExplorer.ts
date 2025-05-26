import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";

const FACTORY_ADDRESS = "0x2ded26df8b4865471a7c0b0ab1633acb76e24e28";
const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

export interface TokenInfo {
  address: string;
  index: number;
  name?: string;
  symbol?: string;
  totalSupply?: string;
  isCurveInitialized?: boolean;
}

export const useTokenExplorer = () => {
  // Get factory contract
  const factory = getContract({
    client,
    chain,
    address: FACTORY_ADDRESS,
  });

  // Get bonding curve contract
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  // Get all artist tokens
  const { data: allArtistTokens, isLoading: tokensLoading } = useReadContract({
    contract: factory,
    method: "function getAllArtistTokens() view returns (address[])"
  });

  // Get token count
  const { data: tokenCount } = useReadContract({
    contract: factory,
    method: "function getTokenCount() view returns (uint256)"
  });

  return {
    allArtistTokens: allArtistTokens || [],
    tokenCount: tokenCount ? Number(tokenCount) : 0,
    tokensLoading,
    factory,
    bondingCurve,
    FACTORY_ADDRESS,
    BONDING_CURVE_ADDRESS
  };
};

// Hook to get detailed info about a specific token
export const useTokenDetails = (tokenAddress: string) => {
  const tokenContract = getContract({
    client,
    chain,
    address: tokenAddress,
  });

  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  // Get token name
  const { data: name } = useReadContract({
    contract: tokenContract,
    method: "function name() view returns (string)"
  });

  // Get token symbol
  const { data: symbol } = useReadContract({
    contract: tokenContract,
    method: "function symbol() view returns (string)"
  });

  // Get total supply
  const { data: totalSupply } = useReadContract({
    contract: tokenContract,
    method: "function totalSupply() view returns (uint256)"
  });

  // Check if curve is initialized
  const { data: isCurveInitialized } = useReadContract({
    contract: bondingCurve,
    method: "function isCurveInitialized(address artistToken) view returns (bool)",
    params: [tokenAddress]
  });

  return {
    name: name || "Unknown",
    symbol: symbol || "???",
    totalSupply: totalSupply ? totalSupply.toString() : "0",
    isCurveInitialized: isCurveInitialized || false,
    tokenContract
  };
}; 