import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTokenExplorer, useTokenDetails } from "@/hooks/useTokenExplorer";
import { Shield, Plus, Settings, TrendingUp, Music, ChevronRight, AlertCircle, CheckCircle, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from 'react-router-dom';

const FACTORY_ADDRESS = "0x2ded26df8b4865471a7c0b0ab1633acb76e24e28"; // Your deployed factory address
const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07"; 

interface CreateTokenForm {
  name: string;
  symbol: string;
  artistName: string;
  artistInfo: string;
  initialProphetValue: string;
  coefficient: string;  
  exponent: string;
}

const AdminPage: React.FC = () => {
  const account = useActiveAccount();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const { toast } = useToast();
  
  const [form, setForm] = useState<CreateTokenForm>({
    name: '',
    symbol: '',
    artistName: '',
    artistInfo: '',
    initialProphetValue: '1000',
    coefficient: '1000000000000000', // 0.001 (1e15)
    exponent: '2000000000000000000' // 2.0 (2e18)
  });

  // Get factory stats
  const factory = getContract({
    client,
    chain,
    address: FACTORY_ADDRESS,
  });

  const { data: artistTokenCount } = useReadContract({
    contract: factory,
    method: "function getArtistTokenCount() view returns (uint256)"
  });

  const { data: allArtistTokens } = useReadContract({
    contract: factory,
    method: "function getAllArtistTokens() view returns (address[])"
  });

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard.",
    });
  };

  const handleInputChange = (field: keyof CreateTokenForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!form.name || !form.symbol || !form.artistName || !form.artistInfo) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return false;
    }
    
    if (form.symbol.length > 10) {
      toast({
        title: "Validation Error", 
        description: "Token symbol must be 10 characters or less.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleManualCurveInit = async () => {
    if (!account || !isAdmin) return;

    try {
      const bondingCurve = getContract({
        client,
        chain,
        address: BONDING_CURVE_ADDRESS,
      });

      // You'll need to input the artist token address manually
      const artistTokenAddress = prompt("Enter artist token address to initialize curve for:");
      if (!artistTokenAddress) return;

      const transaction = prepareContractCall({
        contract: bondingCurve,
        method: "function initializeCurve(address artistToken, uint256 coefficient, uint256 exponent)",
        params: [
          artistTokenAddress,
          BigInt(form.coefficient),
          BigInt(form.exponent)
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Curve initialized successfully:", result);
          toast({
            title: "Success!",
            description: "Bonding curve initialized for artist token.",
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

  const handleGrantFactoryRole = async () => {
    if (!account || !isAdmin) return;

    try {
      const bondingCurve = getContract({
        client,
        chain,
        address: BONDING_CURVE_ADDRESS,
      });

      const transaction = prepareContractCall({
        contract: bondingCurve,
        method: "function grantRole(bytes32 role, address account)",
        params: [
          "0x0000000000000000000000000000000000000000000000000000000000000000", // DEFAULT_ADMIN_ROLE
          FACTORY_ADDRESS // Grant role to factory
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Factory role granted successfully:", result);
          toast({
            title: "Success!",
            description: "Factory now has admin rights on BondingCurve.",
          });
        },
        onError: (error) => {
          console.error("Failed to grant role:", error);
          toast({
            title: "Transaction Failed",
            description: "Failed to grant factory admin role.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error granting role:", error);
    }
  };

  const handleCreateArtistToken = async () => {
    if (!account || !isAdmin || !validateForm()) return;

    try {
      const transaction = prepareContractCall({
        contract: factory,
        method: "function createArtistToken(string name, string symbol, address primarySaleRecipient, string artistName, string artistInfo, uint256 initialProphetValue) returns (address)",
        params: [
          form.name,
          form.symbol,
          account.address,
          form.artistName,
          form.artistInfo,
          toWei(form.initialProphetValue)
        ]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Artist token created successfully:", result);
          toast({
            title: "Success!",
            description: `${form.artistName} token created successfully.`,
          });
          
          // Reset form
          setForm({
            name: '',
            symbol: '',
            artistName: '',
            artistInfo: '',
            initialProphetValue: '1000',
            coefficient: '1000000000000000',
            exponent: '2000000000000000000'
          });
        },
        onError: (error) => {
          console.error("Failed to create artist token:", error);
          toast({
            title: "Transaction Failed",
            description: "Failed to create artist token. Please try again.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error creating artist token:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
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

  // Not admin - access denied
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] animate-fadeIn">
        <Card className="w-full max-w-lg glass-card border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You don't have admin permissions to access this panel.
            </p>
            <div className="bg-card/40 rounded-lg p-4 border border-white/10 space-y-2">
              <p className="text-sm font-mono">
                <span className="text-muted-foreground">Your Address:</span><br />
                {account?.address || "Not connected"}
              </p>
              <p className="text-sm font-mono">
                <span className="text-muted-foreground">Factory Contract:</span><br />
                {FACTORY_ADDRESS}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This address does not have the DEFAULT_ADMIN_ROLE
              </p>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-left">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">How to get admin access:</h4>
              <ol className="text-xs text-muted-foreground space-y-1">
                <li>1. Go to thirdweb.com/dashboard</li>
                <li>2. Find your factory contract</li>
                <li>3. Go to "Permissions" tab</li>
                <li>4. Grant DEFAULT_ADMIN_ROLE to your address</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin panel UI
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Admin Panel</h1>
            <p className="text-muted-foreground font-mono">
              Artist Token Management Console
            </p>
          </div>
        </div>

        {/* Admin status badge */}
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Admin Access Granted
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {account?.address}
          </span>
        </div>
      </div>

      {/* Setup Actions */}
      <Card className="glass-card border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <Settings className="h-5 w-5" />
            Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Before creating artist tokens, the Factory needs admin rights on the BondingCurve contract.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleGrantFactoryRole}
              disabled={isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {isPending ? "Granting..." : "Grant Factory Admin Rights"}
            </Button>
            <Link to="/bonding-curve">
              <Button variant="outline" className="w-full border-white/20 hover:bg-white/10">
                <TrendingUp className="h-4 w-4 mr-2" />
                Manage Bonding Curves
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="glass-card hover-scale border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Music className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {artistTokenCount ? artistTokenCount.toString() : '0'}
                </p>
                <p className="text-sm text-muted-foreground">Artist Tokens Created</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover-scale border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold">Active</p>
                <p className="text-sm text-muted-foreground">Factory Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover-scale border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">1.0</p>
                <p className="text-sm text-muted-foreground">System Version</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Artist Token Form */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5" />
            Create New Artist Token
          </CardTitle>
          <p className="text-muted-foreground">
            Deploy a new artist token with custom bonding curve parameters
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Basic Information
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="artistName">Artist Name *</Label>
                <Input
                  id="artistName"
                  placeholder="e.g., KAWS"
                  value={form.artistName}
                  onChange={(e) => handleInputChange('artistName', e.target.value)}
                  className="bg-card/50 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="symbol">Token Symbol *</Label>
                <Input
                  id="symbol"
                  placeholder="e.g., KAWS"
                  value={form.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="bg-card/50 border-white/10"
                />
                <p className="text-xs text-muted-foreground">Max 10 characters</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Token Full Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., KAWS Artist Token"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="bg-card/50 border-white/10"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="artistInfo">Artist Description *</Label>
                <Textarea
                  id="artistInfo"
                  placeholder="Brief description of the artist and their work..."
                  value={form.artistInfo}
                  onChange={(e) => handleInputChange('artistInfo', e.target.value)}
                  rows={3}
                  className="bg-card/50 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialProphetValue">Initial Prophet Value</Label>
                <Input
                  id="initialProphetValue"
                  type="number"
                  placeholder="1000"
                  value={form.initialProphetValue}
                  onChange={(e) => handleInputChange('initialProphetValue', e.target.value)}
                  className="bg-card/50 border-white/10"
                />
                <p className="text-xs text-muted-foreground">For secondary marketplace</p>
              </div>
            </div>
          </div>

          {/* Note about bonding curve */}
          <div className="border-t border-white/10 pt-6 space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium">Bonding Curve Setup</p>
                  <p className="text-muted-foreground">
                    Artist tokens will be created with default curve parameters. 
                    Bonding curves can be initialized manually after token creation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-white/10">
            <Button 
              onClick={handleCreateArtistToken}
              disabled={isPending || !form.name || !form.symbol || !form.artistName}
              className="bg-primary hover:bg-primary/80 font-semibold"
              size="lg"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Token...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Artist Token
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token Explorer */}
      {allArtistTokens && allArtistTokens.length > 0 && (
        <Card className="glass-card border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Artist Token Explorer
              </CardTitle>
              <Badge variant="outline" className="border-white/20">
                {allArtistTokens.length} tokens
              </Badge>
            </div>
            <p className="text-muted-foreground">
              View and manage all deployed artist tokens
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allArtistTokens.slice().reverse().map((tokenAddress, index) => (
                <TokenExplorerCard 
                  key={tokenAddress} 
                  tokenAddress={tokenAddress}
                  index={allArtistTokens.length - index}
                  onCopy={() => copyToClipboard(tokenAddress)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Information */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Contract Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Factory Contract</Label>
              <div className="flex items-center gap-2 p-3 bg-card/30 rounded-lg border border-white/5">
                <span className="font-mono text-sm flex-1">{FACTORY_ADDRESS}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(FACTORY_ADDRESS)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bonding Curve Contract</Label>
              <div className="flex items-center gap-2 p-3 bg-card/30 rounded-lg border border-white/5">
                <span className="font-mono text-sm flex-1">{BONDING_CURVE_ADDRESS}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(BONDING_CURVE_ADDRESS)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://sepolia.etherscan.io/address/${BONDING_CURVE_ADDRESS}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Token Explorer Card Component
interface TokenExplorerCardProps {
  tokenAddress: string;
  index: number;
  onCopy: () => void;
}

const TokenExplorerCard: React.FC<TokenExplorerCardProps> = ({ 
  tokenAddress, 
  index, 
  onCopy 
}) => {
  const { name, symbol, totalSupply, isCurveInitialized } = useTokenDetails(tokenAddress);

  return (
    <div className="p-4 bg-card/30 rounded-lg border border-white/5 hover:bg-card/50 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-white/20">
            #{index}
          </Badge>
          <div>
            <h4 className="font-semibold">{name}</h4>
            <p className="text-sm text-muted-foreground">{symbol}</p>
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
              <AlertCircle className="h-3 w-3 mr-1" />
              Needs Setup
            </Badge>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Address:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)}</span>
            <Button variant="ghost" size="sm" onClick={onCopy}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://sepolia.etherscan.io/address/${tokenAddress}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Supply:</span>
          <span className="font-mono">{(parseInt(totalSupply) / 1e18).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminPage; 