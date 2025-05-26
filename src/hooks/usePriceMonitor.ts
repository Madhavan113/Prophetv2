import { useState, useEffect } from 'react';
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useTokenExplorer } from "./useTokenExplorer";
import { useBlockchainEvents } from "./useBlockchainEvents";

const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

interface PriceData {
  tokenAddress: string;
  currentPrice: bigint;
  previousPrice: bigint;
  priceChange: number;
  priceChangePercent: number;
  totalSupply: bigint;
  marketCap: number;
  lastUpdated: number;
}

export const usePriceMonitor = () => {
  const { allArtistTokens } = useTokenExplorer();
  const { priceDataMap, isLoading: eventsLoading } = useBlockchainEvents();
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Get bonding curve contract
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  // Use real-time data from blockchain events
  useEffect(() => {
    // Convert blockchain events price data to our format
    const newPrices = new Map<string, PriceData>();
    
    priceDataMap.forEach((eventPriceData, tokenAddress) => {
      newPrices.set(tokenAddress, {
        tokenAddress,
        currentPrice: eventPriceData.currentPrice,
        previousPrice: eventPriceData.previousPrice,
        priceChange: eventPriceData.priceChange,
        priceChangePercent: eventPriceData.priceChangePercent,
        totalSupply: 0n, // Not needed for this use case
        marketCap: 0, // Calculate from volume if needed
        lastUpdated: eventPriceData.lastUpdated
      });
    });

    setPrices(newPrices);
  }, [priceDataMap]);

  // Helper functions
  const getPriceData = (tokenAddress: string): PriceData | undefined => {
    return prices.get(tokenAddress);
  };

  const getTopGainers = (limit: number = 5): PriceData[] => {
    return Array.from(prices.values())
      .filter(data => data.priceChangePercent > 0)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, limit);
  };

  const getTopLosers = (limit: number = 5): PriceData[] => {
    return Array.from(prices.values())
      .filter(data => data.priceChangePercent < 0)
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
      .slice(0, limit);
  };

  const getTotalMarketCap = (): number => {
    return Array.from(prices.values()).reduce((sum, data) => sum + data.marketCap, 0);
  };

  const getAverageChange = (): number => {
    const allChanges = Array.from(prices.values()).map(data => data.priceChangePercent);
    return allChanges.length > 0 ? allChanges.reduce((sum, change) => sum + change, 0) / allChanges.length : 0;
  };

  return {
    prices: Array.from(prices.values()),
    pricesMap: prices,
    isLoading: eventsLoading,
    getPriceData,
    getTopGainers,
    getTopLosers,
    getTotalMarketCap,
    getAverageChange,
    refreshPrices: () => {
      // Real-time data is automatically refreshed via blockchain events
      console.log('Price data is automatically updated via blockchain events');
    }
  };
}; 