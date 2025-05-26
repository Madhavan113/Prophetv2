import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, PieChart, Activity } from 'lucide-react';
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract, toEther } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useTokenExplorer, useTokenDetails } from "@/hooks/useTokenExplorer";
import { useBlockchainEvents } from "@/hooks/useBlockchainEvents";

const PROPHET_TOKEN_ADDRESS = "0xa4744fef305d3187c7862b49a6eefc69caa63272";
const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

const PortfolioPage: React.FC = () => {
  const account = useActiveAccount();
  const { allArtistTokens } = useTokenExplorer();
  const { 
    getUserTransactions, 
    tokenCreatedEvents,
    isLoading: eventsLoading 
  } = useBlockchainEvents();

  // Get Prophet token balance
  const prophetToken = getContract({
    client,
    chain,
    address: PROPHET_TOKEN_ADDRESS,
  });

  const { data: prophetBalance } = useReadContract({
    contract: prophetToken,
    method: "function balanceOf(address account) view returns (uint256)",
    params: account?.address ? [account.address] : undefined
  });

  // Get token names from creation events
  const tokenNameMap = useMemo(() => {
    const map = new Map<string, { name: string; symbol: string }>();
    tokenCreatedEvents.forEach(event => {
      map.set(event.artistTokenAddress.toLowerCase(), {
        name: event.artistName,
        symbol: `${event.artistName.toUpperCase().slice(0, 4)}`
      });
    });
    return map;
  }, [tokenCreatedEvents]);

  // Get real transactions for the user
  const userTransactions = useMemo(() => {
    if (!account?.address) return [];
    return getUserTransactions(account.address);
  }, [account?.address, getUserTransactions]);

  if (!account) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="glass-card border-white/10">
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">Connect Wallet</h3>
                  <p className="text-muted-foreground">Connect your wallet to view your portfolio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">Track your artist token investments</p>
        </div>
      </div>

      {/* Prophet Token Balance */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prophet Token Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {prophetBalance ? parseFloat(toEther(prophetBalance)).toFixed(4) : '0.0000'} PRPH
          </div>
          <p className="text-muted-foreground mt-1">Available for trading</p>
        </CardContent>
      </Card>

      {/* Artist Token Holdings */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Artist Token Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading portfolio...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Show real blockchain balances for all artist tokens */}
              {allArtistTokens.map((tokenAddress) => (
                <ArtistTokenHolding 
                  key={tokenAddress} 
                  tokenAddress={tokenAddress}
                  userAddress={account.address}
                />
              ))}
              
              {allArtistTokens.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No artist tokens available yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create artist tokens in the Admin panel to start trading.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">{userTransactions.length}</p>
                <p className="text-sm text-muted-foreground">Total Trades</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <PieChart className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold">{allArtistTokens.length}</p>
                <p className="text-sm text-muted-foreground">Available Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {prophetBalance ? parseFloat(toEther(prophetBalance)).toFixed(2) : '0.00'}
                </p>
                <p className="text-sm text-muted-foreground">PRPH Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

       {/* Transaction History */}
       {userTransactions.length > 0 && (
         <Card className="glass-card border-white/10">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Activity className="h-5 w-5" />
               Recent Transactions
               <Badge variant="outline" className="ml-2">
                 {userTransactions.length} total
               </Badge>
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               {userTransactions.slice(0, 10).map((tx, index) => {
                 const tokenInfo = tokenNameMap.get(tx.artistToken.toLowerCase());
                 return (
                   <div key={`${tx.transactionHash}-${index}`} className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-white/5">
                     <div className="flex items-center gap-3">
                       <Badge variant={tx.type === 'buy' ? 'default' : 'secondary'}>
                         {tx.type === 'buy' ? 'Buy' : 'Sell'}
                       </Badge>
                       <div>
                         <p className="font-semibold">{tokenInfo?.name || 'Unknown Token'}</p>
                         <p className="text-sm text-muted-foreground">
                           Block #{tx.blockNumber}
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="font-semibold">
                         {Number(toEther(tx.artistAmount)).toFixed(4)} {tokenInfo?.symbol || 'ART'}
                       </p>
                       <p className="text-sm text-muted-foreground">
                         {Number(toEther(tx.prophetAmount)).toFixed(4)} PRPH
                       </p>
                     </div>
                   </div>
                 );
               })}
             </div>
           </CardContent>
         </Card>
       )}
     </div>
   );
 };

// Component for individual artist token holdings
interface ArtistTokenHoldingProps {
  tokenAddress: string;
  userAddress: string;
}

const ArtistTokenHolding: React.FC<ArtistTokenHoldingProps> = ({ 
  tokenAddress, 
  userAddress 
}) => {
  const { name, symbol, isCurveInitialized } = useTokenDetails(tokenAddress);
  
  // Get user's balance of this artist token
  const artistToken = getContract({
    client,
    chain,
    address: tokenAddress,
  });

  const { data: balance } = useReadContract({
    contract: artistToken,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [userAddress]
  });

  // Get current price
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  const { data: currentPrice } = useReadContract({
    contract: bondingCurve,
    method: "function getCurrentPrice(address artistToken) view returns (uint256)",
    params: [tokenAddress]
  });

  const formatBalance = (bal: bigint | undefined) => {
    return bal ? parseFloat(toEther(bal)).toFixed(4) : '0.0000';
  };

  const formatPrice = (price: bigint | undefined) => {
    return price ? parseFloat(toEther(price)).toFixed(6) : '0.000000';
  };

  // Calculate portfolio value for this token
  const portfolioValue = balance && currentPrice ? 
    parseFloat(toEther(balance)) * parseFloat(toEther(currentPrice)) : 0;

  // Only show if user has a balance or curve is initialized
  const hasBalance = balance && parseFloat(toEther(balance)) > 0;
  
  if (!isCurveInitialized && !hasBalance) {
    return null; // Don't show uninitialized tokens with no balance
  }

  return (
    <div className="p-4 bg-card/30 rounded-lg border border-white/5 hover:bg-card/50 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h4 className="font-semibold">{name}</h4>
            <p className="text-sm text-muted-foreground font-mono">{symbol}</p>
            <p className="text-xs text-muted-foreground">
              {tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="font-semibold">{formatBalance(balance)} {symbol}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="font-semibold">{formatPrice(currentPrice)} PRPH</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Value</p>
              <p className="font-semibold text-green-400">{portfolioValue.toFixed(4)} PRPH</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        {hasBalance ? (
          <Badge variant="outline" className="border-green-500/20 text-green-400">
            Active Position
          </Badge>
        ) : (
          <Badge variant="outline" className="border-gray-500/20 text-gray-400">
            No Holdings
          </Badge>
        )}
        
        {!isCurveInitialized && (
          <Badge variant="outline" className="border-yellow-500/20 text-yellow-400">
            Curve Not Initialized
          </Badge>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage;
