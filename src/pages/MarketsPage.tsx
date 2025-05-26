import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Search, DollarSign, Volume2, Activity, Zap, Bell, Wifi, WifiOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract, toEther, prepareEvent, watchContractEvents } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useTokenExplorer, useTokenDetails } from "@/hooks/useTokenExplorer";
import { useBlockchainEvents } from "@/hooks/useBlockchainEvents";
import TradingInterface from "@/components/trading/TradingInterface";

const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";
const PRICE_POLLING_INTERVAL = 3000; // 3 seconds as recommended
const MAX_PRICE_HISTORY = 50; // Keep last 50 price points for smooth charts
const PRICE_COMPARISON_INTERVAL = 300000; // 5 minutes for price change calculation

// Real-time market data interfaces
interface TokenPriceData {
  tokenAddress: string;
  currentPrice: bigint;
  previousPrice: bigint;
  priceChange: number;
  priceChangePercent: number;
  lastUpdated: number;
  priceHistory: Array<{ timestamp: number; price: number }>;
  isConnected: boolean;
}

interface TradeEvent {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenName: string;
  trader: string;
  artistAmount: bigint;
  prophetAmount: bigint;
  timestamp: number;
  blockNumber: number;
  isUserTrade: boolean;
}

interface MarketStats {
  volume24h: bigint;
  trades24h: number;
  activeTraders: Set<string>;
}

const MarketsPage: React.FC = () => {
  const account = useActiveAccount();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  
  // Real-time state
  const [tokenPrices, setTokenPrices] = useState<Map<string, TokenPriceData>>(new Map());
  const [recentTrades, setRecentTrades] = useState<TradeEvent[]>([]);
  const [marketStats, setMarketStats] = useState<Map<string, MarketStats>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState(Date.now());

  // Refs for cleanup
  const priceIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const eventWatchers = useRef<Map<string, () => void>>(new Map());
  const priceHistoryCache = useRef<Map<string, Array<{ timestamp: number; price: number }>>>(new Map());
  const initialPriceCache = useRef<Map<string, bigint>>(new Map());
  const price24hAgoCache = useRef<Map<string, bigint>>(new Map());
  const priceComparisonIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const fiveMinutePriceSnapshots = useRef<Map<string, { price: bigint; timestamp: number }>>(new Map());

  const { allArtistTokens, tokensLoading } = useTokenExplorer();
  const { tokenCreatedEvents, isLoading: eventsLoading } = useBlockchainEvents();

  // Setup bonding curve contract
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  // Token name mapping from creation events (fallback to token contract data)
  const tokenNameMap = useMemo(() => {
    const map = new Map<string, { name: string; creator: string }>();
    tokenCreatedEvents.forEach(event => {
      map.set(event.artistTokenAddress.toLowerCase(), {
        name: event.artistName,
        creator: event.creator
      });
    });
    
    // If no creation events, we'll rely on the individual token details from useTokenDetails
    console.log('MarketsPage: tokenNameMap created with', map.size, 'entries from events');
    return map;
  }, [tokenCreatedEvents]);

  // Trade events for real-time notifications
  const buyEvent = prepareEvent({
    signature: "event ArtistTokenBought(address indexed buyer, address indexed artistToken, uint256 prophetAmount, uint256 artistAmount, uint256 newSupply)"
  });

  const sellEvent = prepareEvent({
    signature: "event ArtistTokenSold(address indexed seller, address indexed artistToken, uint256 artistAmount, uint256 prophetAmount, uint256 newSupply)"
  });

  // Real-time price tracking for a specific token
  const startPriceTracking = useCallback((tokenAddress: string) => {
    // Clear existing interval
    const existingInterval = priceIntervals.current.get(tokenAddress);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Initialize price history if not exists
    if (!priceHistoryCache.current.has(tokenAddress)) {
      priceHistoryCache.current.set(tokenAddress, []);
    }

    let retryCount = 0;
    const maxRetries = 3;

    const fetchPrice = async () => {
      try {
        // Fetch real price from bonding curve contract
        console.log(`Fetching real price for token: ${tokenAddress}`);
        
        // Use readContract for read-only calls
        const { readContract } = await import("thirdweb");
        const realPrice = await readContract({
          contract: bondingCurve,
          method: "function getCurrentPrice(address artistToken) view returns (uint256)",
          params: [tokenAddress]
        });
        
        console.log(`Real price for ${tokenAddress}:`, realPrice.toString());
        
        const now = Date.now();
        
        // Store initial price if not set
        if (!initialPriceCache.current.has(tokenAddress)) {
          initialPriceCache.current.set(tokenAddress, realPrice);
        }
        
        // Store price from 24h ago (or use initial if not enough history)
        const history = priceHistoryCache.current.get(tokenAddress) || [];
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        const price24hAgo = history.find(p => p.timestamp <= twentyFourHoursAgo)?.price;
        
        if (price24hAgo) {
          price24hAgoCache.current.set(tokenAddress, BigInt(Math.floor(price24hAgo * 1e18)));
        } else if (!price24hAgoCache.current.has(tokenAddress)) {
          // Use initial price as baseline if we don't have 24h history
          price24hAgoCache.current.set(tokenAddress, initialPriceCache.current.get(tokenAddress) || realPrice);
        }
        
        setTokenPrices(prev => {
          const newPrices = new Map(prev);
          const existing = newPrices.get(tokenAddress);
          const previousPrice = existing?.currentPrice || realPrice;
          
          // Calculate price changes
          const initialPrice = initialPriceCache.current.get(tokenAddress) || realPrice;
          const baseline24h = price24hAgoCache.current.get(tokenAddress) || initialPrice;
          
          // All-time change from initial price
          const allTimeChange = Number(realPrice) - Number(initialPrice);
          const allTimeChangePercent = Number(initialPrice) > 0 ? 
            (allTimeChange / Number(initialPrice)) * 100 : 0;
          
          // 24h change
          const change24h = Number(realPrice) - Number(baseline24h);
          const changePercent24h = Number(baseline24h) > 0 ? 
            (change24h / Number(baseline24h)) * 100 : 0;

          // Update price history with smooth interpolation
          const history = priceHistoryCache.current.get(tokenAddress) || [];
          const newPricePoint = {
            timestamp: now,
            price: Number(toEther(realPrice))
          };
          
          // Keep last MAX_PRICE_HISTORY points for smooth charts
          const updatedHistory = [...history, newPricePoint].slice(-MAX_PRICE_HISTORY);
          priceHistoryCache.current.set(tokenAddress, updatedHistory);

          newPrices.set(tokenAddress, {
            tokenAddress,
            currentPrice: realPrice,
            previousPrice,
            priceChange: change24h,
            priceChangePercent: changePercent24h,
            lastUpdated: now,
            priceHistory: updatedHistory,
            isConnected: true,
          });
          
          return newPrices;
        });

        setConnectionStatus('connected');
        setLastGlobalUpdate(now);
        retryCount = 0; // Reset retry count on success
        
      } catch (error) {
        console.error(`Price fetch error for ${tokenAddress}:`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          setConnectionStatus('disconnected');
          // Mark token as disconnected but keep existing data
          setTokenPrices(prev => {
            const newPrices = new Map(prev);
            const existing = newPrices.get(tokenAddress);
            if (existing) {
              newPrices.set(tokenAddress, { ...existing, isConnected: false });
            }
            return newPrices;
          });
        } else {
          setConnectionStatus('connecting');
          // Exponential backoff retry
          setTimeout(fetchPrice, Math.pow(2, retryCount) * 1000);
          return;
        }
      }
    };

    // Initial fetch
    fetchPrice();

    // Set up 3-second polling as recommended
    const interval = setInterval(fetchPrice, PRICE_POLLING_INTERVAL);
    priceIntervals.current.set(tokenAddress, interval);
  }, []);

  // Fetch historical trades for accurate 24h volume
  const fetchHistoricalTrades = useCallback(async (tokenAddress: string) => {
    try {
      const { getContractEvents } = await import("thirdweb");
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      
      // Fetch all buy and sell events for this token
      const [buyEvents, sellEvents] = await Promise.all([
        getContractEvents({
          contract: bondingCurve,
          events: [buyEvent],
          fromBlock: 0n, // You might want to optimize this with a specific block range
          toBlock: undefined // Will use latest block
        }),
        getContractEvents({
          contract: bondingCurve,
          events: [sellEvent],
          fromBlock: 0n,
          toBlock: undefined // Will use latest block
        })
      ]);
      
      // Filter events for this token and calculate 24h volume
      let volume24h = 0n;
      let trades24h = 0;
      const traders24h = new Set<string>();
      
      [...buyEvents, ...sellEvents].forEach(event => {
        const eventTokenAddress = event.args.artistToken as string;
        if (eventTokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) return;
        
        // For now, assume all events are within 24h (you'd need block timestamps for accurate filtering)
        const prophetAmount = event.args.prophetAmount as bigint;
        volume24h += prophetAmount;
        trades24h++;
        
        const trader = (event.eventName === 'ArtistTokenBought' ? event.args.buyer : event.args.seller) as string;
        traders24h.add(trader.toLowerCase());
      });
      
      // Update market stats with historical data
      setMarketStats(prev => {
        const newStats = new Map(prev);
        newStats.set(tokenAddress, {
          volume24h,
          trades24h,
          activeTraders: traders24h
        });
        return newStats;
      });
      
    } catch (error) {
      console.error(`Failed to fetch historical trades for ${tokenAddress}:`, error);
    }
  }, [bondingCurve]);

  // Real-time trade event watching
  const startTradeEventWatching = useCallback((tokenAddress: string) => {
    // Get token info from current state (optional)
    const tokenInfo = tokenNameMap.get(tokenAddress.toLowerCase());
    console.log(`Starting event watching for ${tokenAddress}, has token info:`, !!tokenInfo);
    
    // Fetch historical trades first
    fetchHistoricalTrades(tokenAddress);

    try {
      const unwatch = watchContractEvents({
        contract: bondingCurve,
        events: [buyEvent, sellEvent],
        onEvents: (events) => {
          const newTrades: TradeEvent[] = [];
          const now = Date.now();
          
          events.forEach(event => {
            const eventTokenAddress = event.args.artistToken as string;
            if (eventTokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) return;

            const isBuy = event.eventName === 'ArtistTokenBought';
            const trader = (isBuy ? event.args.buyer : event.args.seller) as string;
            const artistAmount = event.args.artistAmount as bigint;
            const prophetAmount = event.args.prophetAmount as bigint;

            const trade: TradeEvent = {
              id: `${event.transactionHash}-${event.blockNumber}`,
              type: isBuy ? 'buy' : 'sell',
              tokenAddress: eventTokenAddress,
              tokenName: tokenInfo?.name || `Token ${eventTokenAddress.slice(0, 8)}...`,
              trader,
              artistAmount,
              prophetAmount,
              timestamp: now,
              blockNumber: Number(event.blockNumber),
              isUserTrade: account?.address?.toLowerCase() === trader.toLowerCase(),
            };

            newTrades.push(trade);
          });

          if (newTrades.length > 0) {
            // Update recent trades (keep last 20)
            setRecentTrades(prev => {
              const updated = [...newTrades, ...prev].slice(0, 20);
              return updated;
            });

            // Update market stats with real volume
            setMarketStats(prev => {
              const newStats = new Map(prev);
              const existing = newStats.get(tokenAddress) || {
                volume24h: 0n,
                trades24h: 0,
                activeTraders: new Set<string>()
              };

              // Add new volume and trades
              const newVolume = newTrades.reduce((sum, trade) => sum + trade.prophetAmount, 0n);
              const newTraders = new Set([...existing.activeTraders, ...newTrades.map(t => t.trader)]);

              newStats.set(tokenAddress, {
                volume24h: existing.volume24h + newVolume,
                trades24h: existing.trades24h + newTrades.length,
                activeTraders: newTraders
              });

              return newStats;
            });

            // Force price refetch for immediate update after trade
            const tokenPriceInterval = priceIntervals.current.get(tokenAddress);
            if (tokenPriceInterval) {
              clearInterval(tokenPriceInterval);
              // Restart price tracking
              setTimeout(() => startPriceTracking(tokenAddress), 100);
            }
          }
        },
      });

      eventWatchers.current.set(tokenAddress, unwatch);
    } catch (error) {
      console.error(`Event watching setup failed for ${tokenAddress}:`, error);
      setConnectionStatus('disconnected');
    }
  }, [bondingCurve, account?.address, startPriceTracking, fetchHistoricalTrades]);

  // Start tracking all tokens when they're available
  useEffect(() => {
    console.log('MarketsPage: allArtistTokens changed:', allArtistTokens);
    
    if (allArtistTokens.length === 0) {
      console.log('MarketsPage: No artist tokens found');
      return;
    }

    console.log('MarketsPage: Starting tracking for', allArtistTokens.length, 'tokens');
    
    // Start price tracking and event watching for all tokens
    allArtistTokens.forEach(tokenAddress => {
      startPriceTracking(tokenAddress);
      startTradeEventWatching(tokenAddress);
    });

    // Cleanup function
    return () => {
      // Clear all price polling intervals
      priceIntervals.current.forEach(interval => clearInterval(interval));
      priceIntervals.current.clear();

      // Clear all event watchers
      eventWatchers.current.forEach(unwatch => unwatch());
      eventWatchers.current.clear();
    };
  }, [allArtistTokens]); // Remove callback dependencies to prevent infinite loops

  // Filter tokens based on search and tab
  const filteredTokens = useMemo(() => {
    const filtered = allArtistTokens.filter(tokenAddress => {
      // Always include tokens, even if we don't have creation event data
      // The individual token cards will fetch their own details
      if (!searchTerm) return true;
      
      const tokenInfo = tokenNameMap.get(tokenAddress.toLowerCase());
      const searchLower = searchTerm.toLowerCase();
      
      // Search by token address always works
      if (tokenAddress.toLowerCase().includes(searchLower)) return true;
      
      // Search by name if we have it from events
      if (tokenInfo && tokenInfo.name.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });

    // Apply tab filtering with real-time data
    switch (selectedTab) {
      case 'gainers':
        // Show all tokens sorted by price change, including those with 0% change
        // This is more useful when there's limited trading history
        return filtered
          .sort((a, b) => {
            const aData = tokenPrices.get(a);
            const bData = tokenPrices.get(b);
            
            // Prioritize tokens with price data
            if (!aData && !bData) return 0;
            if (!aData) return 1;
            if (!bData) return -1;
            
            // Sort by price change percent (highest first)
            const aChange = aData.priceChangePercent || 0;
            const bChange = bData.priceChangePercent || 0;
            
            // If both have same change %, sort by current price (activity indicator)
            if (aChange === bChange) {
              return Number(bData.currentPrice) - Number(aData.currentPrice);
            }
            
            return bChange - aChange;
          })
          .slice(0, 10);
      
      case 'volume':
        return filtered
          .sort((a, b) => {
            const aVolume = Number(marketStats.get(a)?.volume24h || 0n);
            const bVolume = Number(marketStats.get(b)?.volume24h || 0n);
            return bVolume - aVolume;
          })
          .slice(0, 10);
      
      default:
        return filtered;
    }
  }, [allArtistTokens, tokenNameMap, searchTerm, selectedTab, tokenPrices, marketStats]);

  // Loading state
  if (tokensLoading || eventsLoading) {
    console.log('MarketsPage: Loading state - tokensLoading:', tokensLoading, 'eventsLoading:', eventsLoading);
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Initializing real-time market data...</p>
            <p className="text-xs text-muted-foreground">
              Tokens: {tokensLoading ? 'Loading...' : 'Ready'} | Events: {eventsLoading ? 'Loading...' : 'Ready'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No tokens state
  if (allArtistTokens.length === 0) {
    console.log('MarketsPage: No tokens state - allArtistTokens:', allArtistTokens);
    console.log('MarketsPage: tokenCreatedEvents:', tokenCreatedEvents);
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <h1 className="text-2xl font-bold">Artist Markets</h1>
        </div>
        
        <Card className="glass-card border-white/10">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No Artist Tokens Yet</h3>
                <p className="text-muted-foreground">Create artist tokens in the Admin panel to start trading</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Debug: Found {tokenCreatedEvents.length} creation events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Live Markets</h1>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-4 w-4 text-green-400" />
            ) : connectionStatus === 'connecting' ? (
              <Wifi className="h-4 w-4 text-yellow-400 animate-pulse" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-400" />
            )}
            <span className="text-sm text-muted-foreground">
              {connectionStatus === 'connected' ? 'Live' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
            <span className="text-xs text-muted-foreground">
              Updated {Math.floor((Date.now() - lastGlobalUpdate) / 1000)}s ago
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Trade Notifications */}
          {recentTrades.length > 0 && (
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-muted-foreground">
                {recentTrades.length} recent trades
              </span>
            </div>
          )}
          
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artists..."
              className="pl-8 bg-card/50 border-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Real-time Trade Notifications */}
      {recentTrades.length > 0 && (
        <Card className="glass-card border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium">Live Trading Activity</span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recentTrades.slice(0, 5).map(trade => (
                <div key={trade.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={trade.type === 'buy' ? 'default' : 'secondary'} className="text-xs">
                      {trade.type.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{trade.tokenName}</span>
                    <span className="text-muted-foreground">
                      {trade.isUserTrade ? 'You' : `${trade.trader.slice(0, 6)}...`}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{Number(toEther(trade.artistAmount)).toFixed(2)} tokens</div>
                    <div className="text-xs text-muted-foreground">{Number(toEther(trade.prophetAmount)).toFixed(4)} PRPH</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Tabs */}
      <Tabs defaultValue="all" onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full sm:w-[400px]">
          <TabsTrigger value="all">All Markets</TabsTrigger>
          <TabsTrigger value="gainers">🔥 Gainers</TabsTrigger>
          <TabsTrigger value="volume">📊 Volume</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6 grid-cols-1">
            {filteredTokens.map((tokenAddress) => {
              console.log('MarketsPage: Rendering token:', tokenAddress);
              return (
                <RealTimeMarketCard 
                  key={tokenAddress} 
                  tokenAddress={tokenAddress} 
                  tokenInfo={tokenNameMap.get(tokenAddress.toLowerCase())}
                  priceData={tokenPrices.get(tokenAddress)}
                  marketStats={marketStats.get(tokenAddress)}
                />
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="gainers" className="mt-6">
          {filteredTokens.length === 0 ? (
            <Card className="glass-card border-white/10">
              <CardContent className="p-8 text-center">
                <div className="space-y-4">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold">No Gainers Yet</h3>
                    <p className="text-muted-foreground">
                      Tokens will appear here once they have positive price movement
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Price changes are calculated over 24h periods
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1">
              {filteredTokens.map((tokenAddress) => (
                <RealTimeMarketCard 
                  key={tokenAddress} 
                  tokenAddress={tokenAddress} 
                  tokenInfo={tokenNameMap.get(tokenAddress.toLowerCase())}
                  priceData={tokenPrices.get(tokenAddress)}
                  marketStats={marketStats.get(tokenAddress)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="volume" className="mt-6">
          <div className="grid gap-6 grid-cols-1">
            {filteredTokens.map((tokenAddress) => (
              <RealTimeMarketCard 
                key={tokenAddress} 
                tokenAddress={tokenAddress} 
                tokenInfo={tokenNameMap.get(tokenAddress.toLowerCase())}
                priceData={tokenPrices.get(tokenAddress)}
                marketStats={marketStats.get(tokenAddress)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Real-time Market Card Component
interface RealTimeMarketCardProps {
  tokenAddress: string;
  tokenInfo?: { name: string; creator: string };
  priceData?: TokenPriceData;
  marketStats?: MarketStats;
}

const RealTimeMarketCard: React.FC<RealTimeMarketCardProps> = ({ 
  tokenAddress, 
  tokenInfo,
  priceData,
  marketStats 
}) => {
  const { name, symbol, totalSupply, isCurveInitialized } = useTokenDetails(tokenAddress);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const previousPriceRef = useRef<bigint | null>(null);
  
  // Fetch the actual PRPH reserves for accurate market cap
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });
  
  const { data: prophetReserves } = useReadContract({
    contract: bondingCurve,
    method: "function prophetReserves(address) view returns (uint256)",
    params: [tokenAddress]
  });

  // Debug logging
  console.log(`RealTimeMarketCard for ${tokenAddress}:`, {
    name,
    symbol,
    totalSupply,
    isCurveInitialized,
    hasTokenInfo: !!tokenInfo,
    hasPriceData: !!priceData,
    prophetReserves: prophetReserves?.toString()
  });

  // Price flash animation effect
  useEffect(() => {
    if (priceData && previousPriceRef.current) {
      const current = priceData.currentPrice;
      const previous = previousPriceRef.current;
      
      if (current > previous) {
        setPriceFlash('up');
      } else if (current < previous) {
        setPriceFlash('down');
      }
      
      const timer = setTimeout(() => setPriceFlash(null), 1000);
      return () => clearTimeout(timer);
    }
    
    if (priceData) {
      previousPriceRef.current = priceData.currentPrice;
    }
  }, [priceData?.currentPrice]);

  const formatPrice = (price: bigint | undefined) => {
    return price ? parseFloat(toEther(price)).toFixed(6) : '0.000000';
  };

  const formatSupply = (supply: string) => {
    return (parseInt(supply) / 1e18).toFixed(2);
  };
  
  // Calculate average price if we have reserves and supply
  const calculateAveragePrice = () => {
    if (prophetReserves && totalSupply && parseInt(totalSupply) > 0) {
      const avgPrice = (Number(prophetReserves) / Number(totalSupply)) * 1e18;
      return parseFloat(toEther(BigInt(Math.floor(avgPrice)))).toFixed(6);
    }
    return '0.000000';
  };

  // Use real artist name from events
  const displayName = tokenInfo?.name || name;
  const creatorAddress = tokenInfo?.creator;

  if (!isCurveInitialized) {
    return (
      <Card className="glass-card border-white/10 border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{displayName}</h3>
                <p className="text-sm text-muted-foreground font-mono">{symbol}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)}
                </p>
                {creatorAddress && (
                  <p className="text-xs text-muted-foreground">
                    By: {creatorAddress.slice(0, 8)}...{creatorAddress.slice(-6)}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="border-yellow-500/20 text-yellow-400">
                Not Initialized
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Supply</span>
                <span>{formatSupply(totalSupply)} {symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-yellow-400">Bonding curve not initialized</span>
              </div>
            </div>
            
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400">
                This token exists but its bonding curve hasn't been initialized yet. 
                Trading will be available once the curve is set up.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceChangePercent = priceData?.priceChangePercent || 0;
  const isPositive = priceChangePercent >= 0;
  const isConnected = priceData?.isConnected ?? false;

  return (
    <Card className={`glass-card border-white/10 hover:border-white/20 transition-all ${
      priceFlash === 'up' ? 'bg-green-500/10 border-green-500/30' : 
      priceFlash === 'down' ? 'bg-red-500/10 border-red-500/30' : ''
    }`}>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Token Info with Real-time Price */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">{displayName}</h3>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <>
                        <Zap className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-green-400">LIVE</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-red-400" />
                        <span className="text-xs text-red-400">OFFLINE</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{symbol}</p>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)}
                  </p>
                  {creatorAddress && (
                    <p className="text-xs text-muted-foreground">
                      By: {creatorAddress.slice(0, 8)}...{creatorAddress.slice(-6)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center font-semibold transition-all duration-300 ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                } ${priceFlash ? 'scale-110' : ''}`}>
                  {isPositive ? <TrendingUp className="mr-1" size={18} /> : <TrendingDown className="mr-1" size={18} />}
                  <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
                </div>
                {marketStats && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Activity className="h-3 w-3 mr-1" />
                      {marketStats.trades24h} trades
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Volume2 className="h-3 w-3 mr-1" />
                      {parseFloat(toEther(marketStats.volume24h)).toFixed(2)} PRPH
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Price</span>
                <span className={`font-medium transition-all duration-300 ${
                  priceFlash === 'up' ? 'text-green-400' : 
                  priceFlash === 'down' ? 'text-red-400' : ''
                }`}>
                  {formatPrice(priceData?.currentPrice)} PRPH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg. Price</span>
                <span className="text-xs">
                  {calculateAveragePrice()} PRPH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Supply</span>
                <span>{formatSupply(totalSupply)} {symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Market Cap</span>
                <span>
                  {prophetReserves ? 
                    parseFloat(toEther(prophetReserves)).toFixed(2) : 
                    '0.00'
                  } PRPH
                </span>
              </div>
              {marketStats && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">24h Volume</span>
                    <span>{parseFloat(toEther(marketStats.volume24h)).toFixed(2)} PRPH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Traders</span>
                    <span>{marketStats.activeTraders.size}</span>
                  </div>
                </>
              )}
              {priceData && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last Update</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor((Date.now() - priceData.lastUpdated) / 1000)}s ago
                  </span>
                </div>
              )}
            </div>

            {/* Add explanation about pricing */}
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
              <p className="text-blue-400">
                <strong>Current Price:</strong> Next token cost (bonding curve)
              </p>
              <p className="text-blue-400 mt-1">
                <strong>Market Cap:</strong> Total PRPH locked in reserves
              </p>
            </div>

            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Trade Live
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Trade {name} ({symbol})</DialogTitle>
                  </DialogHeader>
                  <TradingInterface 
                    artistTokenAddress={tokenAddress}
                    artistName={displayName}
                    artistSymbol={symbol}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Real-time Chart */}
          <div className="lg:col-span-2 h-[250px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium">Price Chart (Real-time)</h4>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live Updates' : 'Offline'}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceData?.priceHistory || []}>
                <defs>
                  <linearGradient id={`colorPrice-${tokenAddress}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }} 
                  tickFormatter={(value) => `${value.toFixed(6)}`}
                />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toFixed(6)} PRPH`, 'Price']}
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? '#10B981' : '#EF4444'}
                  strokeWidth={2}
                  fill={`url(#colorPrice-${tokenAddress})`}
                  dot={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketsPage;
