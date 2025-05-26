import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Crown, Search, DollarSign, Activity } from 'lucide-react';
import { useReadContract } from "thirdweb/react";
import { getContract, toEther } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useTokenExplorer, useTokenDetails } from "@/hooks/useTokenExplorer";
import { useBlockchainEvents } from "@/hooks/useBlockchainEvents";

const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";
const PROPHET_TOKEN_ADDRESS = "0xa4744fef305d3187c7862b49a6eefc69caa63272";

interface UserStatsDisplay {
  address: string;
  totalPortfolioValue: number;
  prophetBalance: number;
  topHoldings: Array<{
    tokenAddress: string;
    name: string;
    symbol: string;
    balance: number;
    value: number;
    percentage: number;
  }>;
  totalTokensHeld: number;
  rank: number;
}

const LeaderboardPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('portfolio');
  const [searchTerm, setSearchTerm] = useState('');
  const { allArtistTokens, tokensLoading, bondingCurve } = useTokenExplorer();
  const { 
    userStats, 
    priceDataMap, 
    tokenCreatedEvents,
    getUserTransactions,
    isLoading: eventsLoading 
  } = useBlockchainEvents();

  // Get token names from creation events
  const tokenNameMap = useMemo(() => {
    const map = new Map<string, { name: string; symbol: string }>();
    tokenCreatedEvents.forEach(event => {
      map.set(event.artistTokenAddress.toLowerCase(), {
        name: event.artistName,
        symbol: `${event.artistName.toUpperCase().slice(0, 4)}` // Create symbol from name
      });
    });
    return map;
  }, [tokenCreatedEvents]);

  // Fetch market cap for each token
  const [marketData, setMarketData] = useState<Array<{
    tokenAddress: string;
    name: string;
    symbol: string;
    marketCap: number;
    totalSupply: number;
    currentPrice: number;
  }>>([]);

  // Custom hook to fetch reserves for a token
  const useTokenReserves = (tokenAddress: string) => {
    return useReadContract({
      contract: bondingCurve,
      method: "function prophetReserves(address) view returns (uint256)",
      params: [tokenAddress]
    });
  };

  // Fetch market data for all tokens
  useEffect(() => {
    const fetchMarketData = async () => {
      const { readContract } = await import("thirdweb");
      const { getContract } = await import("thirdweb");
      
      const data = await Promise.all(
        allArtistTokens.map(async (tokenAddress) => {
          try {
            // Get token contract
            const tokenContract = getContract({
              client,
              chain,
              address: tokenAddress,
            });
            
            // Fetch token details directly from contract
            const [name, symbol, totalSupply] = await Promise.all([
              readContract({
                contract: tokenContract,
                method: "function name() view returns (string)"
              }),
              readContract({
                contract: tokenContract,
                method: "function symbol() view returns (string)"
              }),
              readContract({
                contract: tokenContract,
                method: "function totalSupply() view returns (uint256)"
              })
            ]);
            
            // Get price data
            const priceData = priceDataMap.get(tokenAddress.toLowerCase());
            
            // Get reserves (actual market cap)
            const reserves = await readContract({
              contract: bondingCurve,
              method: "function prophetReserves(address) view returns (uint256)",
              params: [tokenAddress]
            });
            
            const marketCap = reserves ? Number(toEther(reserves)) : 0;
            
            return {
              tokenAddress,
              name: name || 'Unknown',
              symbol: symbol || 'UNK',
              marketCap,
              totalSupply: totalSupply ? Number(toEther(totalSupply)) : 0,
              currentPrice: priceData ? Number(toEther(priceData.currentPrice)) : 0
            };
          } catch (error) {
            console.error(`Error fetching market data for ${tokenAddress}:`, error);
            return null;
          }
        })
      );
      
      setMarketData(data.filter(d => d !== null && d.marketCap > 0).sort((a, b) => b.marketCap - a.marketCap));
    };

    if (allArtistTokens.length > 0 && bondingCurve) {
      fetchMarketData();
    }
  }, [allArtistTokens, priceDataMap, bondingCurve]);

  // Calculate leaderboard data from real blockchain events
  const leaderboardData = useMemo((): UserStatsDisplay[] => {
    if (!userStats.length || !allArtistTokens.length || !marketData.length) return [];

    // Convert blockchain UserStats to display format
    const displayData: UserStatsDisplay[] = userStats.map((stats, index) => {
      let totalPortfolioValue = 0;
      const topHoldings: UserStatsDisplay['topHoldings'] = [];

      // Get user's transactions to calculate current holdings
      const userTransactions = getUserTransactions(stats.address);
      const holdingsByToken = new Map<string, number>();

      // Calculate current holdings from transaction history
      userTransactions.forEach(tx => {
        const current = holdingsByToken.get(tx.artistToken.toLowerCase()) || 0;
        if (tx.type === 'buy') {
          holdingsByToken.set(tx.artistToken.toLowerCase(), current + Number(toEther(tx.artistAmount)));
        } else {
          holdingsByToken.set(tx.artistToken.toLowerCase(), current - Number(toEther(tx.artistAmount)));
        }
      });

      // Calculate portfolio value using current prices
      holdingsByToken.forEach((balance, tokenAddress) => {
        if (balance <= 0) return; // Skip if no holdings

        const priceData = priceDataMap.get(tokenAddress);
        // Find token info from marketData which has the real names
        const tokenInfo = marketData.find(m => m.tokenAddress.toLowerCase() === tokenAddress);
        
        if (priceData && tokenInfo) {
          const currentPrice = Number(toEther(priceData.currentPrice));
          const value = balance * currentPrice;
          totalPortfolioValue += value;

          topHoldings.push({
            tokenAddress,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            balance,
            value,
            percentage: 0 // Will be calculated later
          });
        }
      });

      // Calculate percentages and sort
      topHoldings.forEach(holding => {
        holding.percentage = totalPortfolioValue > 0 ? (holding.value / totalPortfolioValue) * 100 : 0;
      });
      topHoldings.sort((a, b) => b.value - a.value);

      return {
        address: stats.address,
        totalPortfolioValue,
        prophetBalance: Number(toEther(stats.totalBought)) - Number(toEther(stats.totalSold)), // Net PRPH position
        topHoldings: topHoldings.slice(0, 3), // Top 3 holdings
        totalTokensHeld: topHoldings.reduce((sum, holding) => sum + holding.balance, 0),
        rank: 0 // Will be set after sorting
      };
    });

    // Filter out users with no portfolio value and sort
    const filteredData = displayData.filter(user => user.totalPortfolioValue > 0);
    filteredData.sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue);
    
    // Assign ranks
    filteredData.forEach((user, index) => {
      user.rank = index + 1;
    });

    return filteredData;
  }, [userStats, allArtistTokens, priceDataMap, marketData, getUserTransactions]);

  // Filter leaderboard based on search
  const filteredLeaderboard = leaderboardData.filter(user => 
    user.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (tokensLoading || eventsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (allArtistTokens.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
        </div>
        
        <Card className="glass-card border-white/10">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No Markets Yet</h3>
                <p className="text-muted-foreground">Create artist tokens to start building the leaderboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">Top performers in the Prophet ecosystem</p>
        </div>
        
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search addresses..."
            className="pl-8 bg-card/50 border-white/10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{allArtistTokens.length}</p>
                <p className="text-sm text-muted-foreground">Active Markets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold">
                  {leaderboardData.reduce((sum, user) => sum + user.totalPortfolioValue, 0).toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Market Value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{leaderboardData.length}</p>
                <p className="text-sm text-muted-foreground">Active Traders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">
                  {leaderboardData.length > 0 ? leaderboardData[0].totalPortfolioValue.toFixed(0) : '0'}
                </p>
                <p className="text-sm text-muted-foreground">Top Portfolio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="portfolio" onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-2 w-full sm:w-[400px]">
          <TabsTrigger value="portfolio">Portfolio Value</TabsTrigger>
          <TabsTrigger value="diversity">Top Markets</TabsTrigger>
        </TabsList>
        
        <TabsContent value="portfolio" className="mt-6">
          <LeaderboardList 
            users={filteredLeaderboard} 
            sortBy="portfolio"
            title="Top Portfolios by Value"
          />
        </TabsContent>
        
        <TabsContent value="diversity" className="mt-6">
          <MarketLeaderboard 
            markets={marketData}
            title="Top Markets by Market Cap"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Market Leaderboard Component
interface MarketLeaderboardProps {
  markets: Array<{
    tokenAddress: string;
    name: string;
    symbol: string;
    marketCap: number;
    totalSupply: number;
    currentPrice: number;
  }>;
  title: string;
}

const MarketLeaderboard: React.FC<MarketLeaderboardProps> = ({ markets, title }) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2: return <Medal className="h-6 w-6 text-gray-400" />;
      case 3: return <Award className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBorder = (rank: number) => {
    switch (rank) {
      case 1: return 'border-yellow-500/30 bg-yellow-500/5';
      case 2: return 'border-gray-400/30 bg-gray-400/5';
      case 3: return 'border-amber-600/30 bg-amber-600/5';
      default: return 'border-white/10';
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {markets.map((market, index) => (
            <div key={market.tokenAddress} className={`p-4 rounded-lg border transition-all hover:bg-card/50 ${getRankBorder(index + 1)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12">
                    {getRankIcon(index + 1)}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-lg">{market.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="border-white/20 text-xs">
                        {market.symbol}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {market.tokenAddress.slice(0, 8)}...{market.tokenAddress.slice(-6)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Market Cap</p>
                      <p className="font-semibold text-lg">
                        {market.marketCap.toFixed(2)} PRPH
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="font-semibold">
                        {market.currentPrice.toFixed(6)} PRPH
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Leaderboard List Component
interface LeaderboardListProps {
  users: UserStatsDisplay[];
  sortBy: 'portfolio' | 'holdings' | 'diversity';
  title: string;
}

const LeaderboardList: React.FC<LeaderboardListProps> = ({ users, sortBy, title }) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2: return <Medal className="h-6 w-6 text-gray-400" />;
      case 3: return <Award className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBorder = (rank: number) => {
    switch (rank) {
      case 1: return 'border-yellow-500/30 bg-yellow-500/5';
      case 2: return 'border-gray-400/30 bg-gray-400/5';
      case 3: return 'border-amber-600/30 bg-amber-600/5';
      default: return 'border-white/10';
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user, index) => (
            <UserCard 
              key={user.address} 
              user={user} 
              rank={index + 1}
              rankIcon={getRankIcon(index + 1)}
              borderClass={getRankBorder(index + 1)}
              sortBy={sortBy}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Individual User Card Component
interface UserCardProps {
  user: UserStatsDisplay;
  rank: number;
  rankIcon: React.ReactNode;
  borderClass: string;
  sortBy: 'portfolio' | 'holdings' | 'diversity';
}

const UserCard: React.FC<UserCardProps> = ({ user, rank, rankIcon, borderClass, sortBy }) => {
  return (
    <div className={`p-4 rounded-lg border transition-all hover:bg-card/50 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12">
            {rankIcon}
          </div>
          
          <div>
            <h4 className="font-semibold font-mono text-sm">
              {user.address.slice(0, 8)}...{user.address.slice(-6)}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="border-white/20 text-xs">
                {user.topHoldings.length} tokens
              </Badge>
              <span className="text-xs text-muted-foreground">
                Total: {user.totalTokensHeld.toFixed(1)} tokens
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <p className="font-semibold text-lg">
                {user.totalPortfolioValue.toFixed(2)} PRPH
              </p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Prophet Balance</p>
              <p className="font-semibold">
                {user.prophetBalance.toFixed(2)} PRPH
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Holdings */}
      {user.topHoldings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-muted-foreground mb-2">Top Holdings:</p>
          <div className="flex gap-2 flex-wrap">
            {user.topHoldings.map((holding, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {holding.symbol}: {holding.balance.toFixed(1)} ({holding.percentage.toFixed(1)}%)
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
