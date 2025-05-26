import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { TrendingUp, Settings, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FACTORY_ADDRESS = "0x2ded26df8b4865471a7c0b0ab1633acb76e24e28";
const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

interface CurveParams {
  coefficient: string;
  exponent: string;
}

const BondingCurvePage: React.FC = () => {
  const account = useActiveAccount();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const { toast } = useToast();
  
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [curveParams, setCurveParams] = useState<CurveParams>({
    coefficient: '1000000000000000', // 0.001 (1e15)
    exponent: '2000000000000000000' // 2.0 (2e18)
  });

  // Get factory instance
  const factory = getContract({
    client,
    chain,
    address: FACTORY_ADDRESS,
  });

  // Get bonding curve instance
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  // Get all artist tokens
  const { data: allArtistTokens } = useReadContract({
    contract: factory,
    method: "function getAllArtistTokens() view returns (address[])"
  });

  // Check if curve is initialized for selected token
  const { data: isCurveInitialized } = useReadContract({
    contract: bondingCurve,
    method: "function isCurveInitialized(address artistToken) view returns (bool)",
    params: selectedToken ? [selectedToken] : undefined
  });

  const handleInitializeCurve = async () => {
    if (!account || !isAdmin || !selectedToken) return;

    try {
      const transaction = prepareContractCall({
        contract: bondingCurve,
        method: "function initializeCurve(address artistToken, uint256 coefficient, uint256 exponent)",
        params: [
          selectedToken,
          BigInt(curveParams.coefficient),
          BigInt(curveParams.exponent)
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Curve initialized successfully:", result);
          toast({
            title: "Success!",
            description: "Bonding curve initialized successfully.",
          });
        },
        onError: (error) => {
          console.error("Failed to initialize curve:", error);
          toast({
            title: "Transaction Failed",
            description: "Failed to initialize bonding curve.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error initializing curve:", error);
    }
  };

  const handleParamChange = (field: keyof CurveParams, value: string) => {
    setCurveParams(prev => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] animate-fadeIn">
        <Card className="w-full max-w-md glass-card border-white/10">
          <CardContent className="p-8 text-center space-y-4">
            <div className="shimmer h-12 w-12 rounded-full mx-auto"></div>
            <div>
              <h3 className="text-lg font-semibold">Verifying Access</h3>
              <p className="text-muted-foreground">Checking admin permissions...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] animate-fadeIn">
        <Card className="w-full max-w-lg glass-card border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              You need admin permissions to manage bonding curves.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Bonding Curve Management</h1>
            <p className="text-muted-foreground font-mono">
              Initialize bonding curves for artist tokens
            </p>
          </div>
        </div>
      </div>

      {/* Artist Tokens List */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Artist Tokens Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!allArtistTokens || allArtistTokens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No artist tokens created yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create artist tokens in the Admin panel first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allArtistTokens.map((tokenAddress, index) => (
                <TokenStatusCard 
                  key={tokenAddress} 
                  tokenAddress={tokenAddress}
                  index={index + 1}
                  isSelected={selectedToken === tokenAddress}
                  onSelect={() => setSelectedToken(tokenAddress)}
                  bondingCurveContract={bondingCurve}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Initialize Curve Form */}
      {selectedToken && (
        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Initialize Bonding Curve
            </CardTitle>
            <p className="text-muted-foreground">
              Selected Token: <span className="font-mono text-sm">{selectedToken}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="bg-card/40 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2">
                {isCurveInitialized ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">Curve Already Initialized</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Curve Not Initialized</span>
                  </>
                )}
              </div>
            </div>

            {!isCurveInitialized && (
              <>
                {/* Curve Parameters */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Curve Parameters</h3>
                  
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-blue-400 font-medium">Formula: C(s) = c × s^k</p>
                        <p className="text-muted-foreground">Where s = supply, c = coefficient, k = exponent</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="coefficient">Coefficient (c)</Label>
                      <Input
                        id="coefficient"
                        value={curveParams.coefficient}
                        onChange={(e) => handleParamChange('coefficient', e.target.value)}
                        className="bg-card/50 border-white/10 font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: 1e15 (0.001 Prophet per token initially)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="exponent">Exponent (k)</Label>
                      <Input
                        id="exponent"
                        value={curveParams.exponent}
                        onChange={(e) => handleParamChange('exponent', e.target.value)}
                        className="bg-card/50 border-white/10 font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: 2e18 (quadratic curve)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Initialize Button */}
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <Button 
                    onClick={handleInitializeCurve}
                    disabled={isPending || !selectedToken}
                    className="bg-primary hover:bg-primary/80 font-semibold"
                    size="lg"
                  >
                    {isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Initializing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Initialize Bonding Curve
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Component for individual token status
interface TokenStatusCardProps {
  tokenAddress: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  bondingCurveContract: any;
}

const TokenStatusCard: React.FC<TokenStatusCardProps> = ({ 
  tokenAddress, 
  index, 
  isSelected, 
  onSelect,
  bondingCurveContract 
}) => {
  const { data: isCurveInitialized } = useReadContract({
    contract: bondingCurveContract,
    method: "function isCurveInitialized(address artistToken) view returns (bool)",
    params: [tokenAddress]
  });

  // Get curve parameters to see what's actually set
  const { data: curveParams } = useReadContract({
    contract: bondingCurveContract,
    method: "function getCurveParams(address artistToken) view returns (uint256, uint256)",
    params: [tokenAddress]
  });

  return (
    <div 
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isSelected 
          ? 'bg-primary/10 border-primary/20' 
          : 'bg-card/30 border-white/5 hover:bg-card/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-white/20">
            #{index}
          </Badge>
          <div className="flex-1">
            <span className="font-mono text-sm">{tokenAddress}</span>
            {/* Debug info */}
            {curveParams && (
              <div className="text-xs text-muted-foreground mt-1">
                <p>Coefficient: {curveParams[0]?.toString()}</p>
                <p>Exponent: {curveParams[1]?.toString()}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCurveInitialized ? (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Curve Ready
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              <Clock className="h-3 w-3 mr-1" />
              Needs Setup
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default BondingCurvePage; 