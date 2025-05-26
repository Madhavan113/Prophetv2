import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall, toWei, toEther, readContract } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { TrendingUp, TrendingDown, DollarSign, Zap, AlertCircle, ArrowUpDown, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ApprovalFlow from "./ApprovalFlow";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";

const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";
const PROPHET_TOKEN_ADDRESS = "0xa4744FeF305D3187c7862B49A6eefC69cAa63272";

// Artist Token Approval Component
interface ArtistApprovalFlowProps {
  artistTokenAddress: string;
  artistSymbol: string;
  amount: string;
  onApprovalComplete: () => void;
}

const ArtistApprovalFlow: React.FC<ArtistApprovalFlowProps> = ({ 
  artistTokenAddress, 
  artistSymbol, 
  amount, 
  onApprovalComplete 
}) => {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const { toast } = useToast();

  const artistToken = getContract({
    client,
    chain,
    address: artistTokenAddress,
  });

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    contract: artistToken,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: account?.address ? [account.address, BONDING_CURVE_ADDRESS] : undefined
  });

  const needsApproval = allowance && amount ? 
    BigInt(allowance.toString()) < toWei(amount) : true;
    
  console.log("ArtistApprovalFlow:", {
    artistToken: artistTokenAddress,
    currentAllowance: allowance?.toString(),
    requiredAmount: amount ? toWei(amount).toString() : 'N/A',
    needsApproval,
    owner: account?.address,
    spender: BONDING_CURVE_ADDRESS
  });

  const handleApprove = async () => {
    if (!account || !amount) return;

    try {
      // Approve a large amount to avoid repeated approvals
      const approvalAmount = toWei("1000000"); // 1M tokens

      const transaction = prepareContractCall({
        contract: artistToken,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [BONDING_CURVE_ADDRESS, approvalAmount]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Artist token approval successful:", result);
          toast({
            title: "Approval Successful!",
            description: `You can now sell ${artistSymbol} tokens.`,
          });
          
          // Refresh allowance and notify parent
          setTimeout(() => {
            refetchAllowance();
            onApprovalComplete();
          }, 2000);
        },
        onError: (error) => {
          console.error("Artist token approval failed:", error);
          toast({
            title: "Approval Failed",
            description: `Failed to approve ${artistSymbol} tokens. Please try again.`,
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error approving artist tokens:", error);
    }
  };

  if (!needsApproval) {
    return (
      <Card className="bg-green-500/10 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-green-400 font-medium">{artistSymbol} tokens approved</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-yellow-500/10 border-yellow-500/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
          <div className="text-sm">
            <p className="text-yellow-400 font-medium">Approval Required</p>
            <p className="text-muted-foreground">
              You need to approve {artistSymbol} tokens before selling.
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleApprove}
          disabled={isPending}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
        >
          {isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
              Approving...
            </>
          ) : (
            `Approve ${artistSymbol} Tokens`
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

interface TradingInterfaceProps {
  artistTokenAddress: string;
  artistName: string;
  artistSymbol: string;
}

const TradingInterface: React.FC<TradingInterfaceProps> = ({
  artistTokenAddress,
  artistName,
  artistSymbol
}) => {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const { toast } = useToast();
  const { addTransaction } = useTransactionHistory();

  // Trading state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [prophetAmount, setProphetAmount] = useState('');
  const [artistAmount, setArtistAmount] = useState('');
  const [slippage, setSlippage] = useState('2'); // 2% default slippage
  const [approvalComplete, setApprovalComplete] = useState(false);
  const [artistApprovalComplete, setArtistApprovalComplete] = useState(false);

  // Contract instances
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  const prophetToken = getContract({
    client,
    chain,
    address: PROPHET_TOKEN_ADDRESS,
  });

  const artistToken = getContract({
    client,
    chain,
    address: artistTokenAddress,
  });

  // Get current price
  const { data: currentPrice, refetch: refetchPrice } = useReadContract({
    contract: bondingCurve,
    method: "function getCurrentPrice(address artistToken) view returns (uint256)",
    params: [artistTokenAddress]
  });

  // Get user balances
  const { data: prophetBalance, refetch: refetchProphetBalance } = useReadContract({
    contract: prophetToken,
    method: "function balanceOf(address account) view returns (uint256)",
    params: account?.address ? [account.address] : undefined
  });

  const { data: artistBalance, refetch: refetchArtistBalance } = useReadContract({
    contract: artistToken,
    method: "function balanceOf(address account) view returns (uint256)",
    params: account?.address ? [account.address] : undefined
  });

  // Get total supply
  const { data: totalSupply } = useReadContract({
    contract: artistToken,
    method: "function totalSupply() view returns (uint256)"
  });

  // Get buy quote
  const { data: buyQuote } = useReadContract({
    contract: bondingCurve,
    method: "function getBuyQuote(address artistToken, uint256 prophetAmount) view returns (uint256)",
    params: prophetAmount && parseFloat(prophetAmount) > 0 ? [artistTokenAddress, toWei(prophetAmount)] : undefined
  });

  // Get sell quote
  const { data: sellQuote } = useReadContract({
    contract: bondingCurve,
    method: "function getSellQuote(address artistToken, uint256 artistAmount) view returns (uint256)",
    params: artistAmount && parseFloat(artistAmount) > 0 ? [artistTokenAddress, toWei(artistAmount)] : undefined
  });

  // Update artist amount when prophet amount changes (for buy)
  useEffect(() => {
    if (activeTab === 'buy' && buyQuote) {
      setArtistAmount(toEther(buyQuote));
    }
  }, [buyQuote, activeTab]);

  // Update prophet amount when artist amount changes (for sell)
  useEffect(() => {
    if (activeTab === 'sell' && sellQuote) {
      setProphetAmount(toEther(sellQuote));
    }
  }, [sellQuote, activeTab]);

  const handleBuy = async () => {
    if (!account || !prophetAmount || !buyQuote) return;

    try {
      // Calculate minimum artist tokens with slippage
      const slippageMultiplier = (100 - parseFloat(slippage)) / 100;
      const minArtistAmount = BigInt(Math.floor(Number(buyQuote) * slippageMultiplier));

      const transaction = prepareContractCall({
        contract: bondingCurve,
        method: "function buyArtist(address artistToken, uint256 prophetAmount, uint256 minArtistAmount) returns (uint256)",
        params: [
          artistTokenAddress,
          toWei(prophetAmount),
          minArtistAmount
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Buy successful:", result);
          toast({
            title: "Purchase Successful!",
            description: `Bought ${parseFloat(artistAmount).toFixed(4)} ${artistSymbol} tokens`,
          });
          
          // Add to transaction history
          addTransaction({
            type: 'buy',
            artistToken: artistTokenAddress,
            artistName: artistName,
            artistSymbol: artistSymbol,
            prophetAmount: prophetAmount,
            artistAmount: artistAmount,
            txHash: result.transactionHash,
            blockNumber: 0 // Will be filled when available
          });
          
          // Reset form and refresh data
          setProphetAmount('');
          setArtistAmount('');
          refetchProphetBalance();
          refetchArtistBalance();
          refetchPrice();
        },
        onError: (error) => {
          console.error("Buy failed:", error);
          toast({
            title: "Transaction Failed",
            description: "Failed to buy artist tokens. Please try again.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error buying tokens:", error);
    }
  };

  const handleSell = async () => {
    if (!account || !artistAmount || !sellQuote) return;

    try {
      // Check artist token allowance first
      const allowanceData = await readContract({
        contract: artistToken,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [account.address, BONDING_CURVE_ADDRESS]
      });
      
      const requiredAmount = toWei(artistAmount);
      console.log("Sell allowance check:", {
        allowance: allowanceData?.toString(),
        required: requiredAmount.toString(),
        artistToken: artistTokenAddress,
        spender: BONDING_CURVE_ADDRESS,
        owner: account.address
      });
      
      if (!allowanceData || BigInt(allowanceData) < requiredAmount) {
        toast({
          title: "Approval Required",
          description: `Please approve ${artistSymbol} tokens before selling. Current allowance: ${allowanceData ? toEther(allowanceData) : '0'} ${artistSymbol}`,
          variant: "destructive"
        });
        return;
      }
      // Calculate minimum prophet tokens with slippage
      const slippageMultiplier = (100 - parseFloat(slippage)) / 100;
      const minProphetAmount = BigInt(Math.floor(Number(sellQuote) * slippageMultiplier));

      const transaction = prepareContractCall({
        contract: bondingCurve,
        method: "function sellArtist(address artistToken, uint256 artistAmount, uint256 minProphetAmount) returns (uint256)",
        params: [
          artistTokenAddress,
          toWei(artistAmount),
          minProphetAmount
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Sell successful:", result);
          toast({
            title: "Sale Successful!",
            description: `Sold ${parseFloat(artistAmount).toFixed(4)} ${artistSymbol} tokens`,
          });
          
          // Add to transaction history
          addTransaction({
            type: 'sell',
            artistToken: artistTokenAddress,
            artistName: artistName,
            artistSymbol: artistSymbol,
            prophetAmount: prophetAmount,
            artistAmount: artistAmount,
            txHash: result.transactionHash,
            blockNumber: 0 // Will be filled when available
          });
          
          // Reset form and refresh data
          setProphetAmount('');
          setArtistAmount('');
          refetchProphetBalance();
          refetchArtistBalance();
          refetchPrice();
        },
        onError: (error) => {
          console.error("Sell failed:", error);
          toast({
            title: "Transaction Failed",
            description: "Failed to sell artist tokens. Please try again.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error selling tokens:", error);
    }
  };

  const handleTabChange = (tab: 'buy' | 'sell') => {
    setActiveTab(tab);
    setProphetAmount('');
    setArtistAmount('');
    // Reset approval states when switching tabs
    setApprovalComplete(false);
    setArtistApprovalComplete(false);
  };

  const formatBalance = (balance: bigint | undefined) => {
    return balance ? parseFloat(toEther(balance)).toFixed(4) : '0.0000';
  };

  const formatPrice = (price: bigint | undefined) => {
    return price ? parseFloat(toEther(price)).toFixed(6) : '0.000000';
  };

  if (!account) {
    return (
      <Card className="glass-card border-white/10">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Connect Wallet to Trade</h3>
              <p className="text-muted-foreground">Connect your wallet to start trading {artistName} tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Info */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Market Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-lg font-semibold">{formatPrice(currentPrice)} PRPH</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Supply</p>
              <p className="text-lg font-semibold">{formatBalance(totalSupply)} {artistSymbol}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your {artistSymbol}</p>
              <p className="text-lg font-semibold">{formatBalance(artistBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your PRPH</p>
              <p className="text-lg font-semibold">{formatBalance(prophetBalance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Interface */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Trade {artistName} Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Buy
              </TabsTrigger>
              <TabsTrigger value="sell" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-4 mt-6">
              {/* Approval Flow for Buy */}
              {activeTab === 'buy' && prophetAmount && (
                <ApprovalFlow 
                  amount={prophetAmount} 
                  onApprovalComplete={() => setApprovalComplete(true)}
                />
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prophetAmount">Prophet Tokens to Spend</Label>
                  <Input
                    id="prophetAmount"
                    type="number"
                    placeholder="0.0"
                    value={prophetAmount}
                    onChange={(e) => setProphetAmount(e.target.value)}
                    className="bg-card/50 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Balance: {formatBalance(prophetBalance)} PRPH
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="artistAmountBuy">You'll Receive</Label>
                  <Input
                    id="artistAmountBuy"
                    type="number"
                    placeholder="0.0"
                    value={artistAmount}
                    readOnly
                    className="bg-card/30 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    {artistSymbol} tokens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slippageBuy">Slippage Tolerance (%)</Label>
                  <Input
                    id="slippageBuy"
                    type="number"
                    placeholder="2"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="bg-card/50 border-white/10"
                  />
                </div>

                <Button 
                  onClick={handleBuy}
                  disabled={isPending || !prophetAmount || parseFloat(prophetAmount) <= 0}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Buying...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy {artistSymbol}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sell" className="space-y-4 mt-6">
              {/* Approval Flow for Sell */}
              {activeTab === 'sell' && artistAmount && (
                <ArtistApprovalFlow 
                  artistTokenAddress={artistTokenAddress}
                  artistSymbol={artistSymbol}
                  amount={artistAmount}
                  onApprovalComplete={() => setArtistApprovalComplete(true)}
                />
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artistAmountSell">Artist Tokens to Sell</Label>
                  <Input
                    id="artistAmountSell"
                    type="number"
                    placeholder="0.0"
                    value={artistAmount}
                    onChange={(e) => setArtistAmount(e.target.value)}
                    className="bg-card/50 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Balance: {formatBalance(artistBalance)} {artistSymbol}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prophetAmountSell">You'll Receive</Label>
                  <Input
                    id="prophetAmountSell"
                    type="number"
                    placeholder="0.0"
                    value={prophetAmount}
                    readOnly
                    className="bg-card/30 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prophet tokens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slippageSell">Slippage Tolerance (%)</Label>
                  <Input
                    id="slippageSell"
                    type="number"
                    placeholder="2"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="bg-card/50 border-white/10"
                  />
                </div>

                <Button 
                  onClick={handleSell}
                  disabled={isPending || !artistAmount || parseFloat(artistAmount) <= 0}
                  className="w-full bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  {isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Selling...
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell {artistSymbol}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Price Impact Warning */}
          {(buyQuote || sellQuote) && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">Price Impact</p>
                  <p className="text-muted-foreground">
                    Large trades may have significant price impact due to the bonding curve.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingInterface; 