import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChartBar, User, TrendingUp, Music, Shield, Activity } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import {
  ConnectButton,
  useActiveAccount,
  useWalletBalance,
  useSendTransaction,
} from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";

const PROPHET_TOKEN_ADDRESS = "0xa4744fef305d3187c7862b49a6eefc69caa63272";

function ProphetTokenBalance() {
  const account = useActiveAccount();
  const { data: balance, isLoading, refetch } = useWalletBalance({
    client,
    chain,
    address: account?.address,
    tokenAddress: PROPHET_TOKEN_ADDRESS,
  });

  // Refresh balance every 10 seconds
  React.useEffect(() => {
    if (account?.address) {
      const interval = setInterval(() => {
        refetch();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [account?.address, refetch]);

  if (!account) return null;
  if (isLoading) return <span className="text-sm text-muted-foreground">Loading...</span>;
  
  // Debug logging
  console.log("Token balance data:", balance);
  
  return (
    <div className="hidden md:flex items-center text-sm text-muted-foreground">
      <span>Prophet: {parseFloat(balance?.displayValue || "0").toFixed(2)} {balance?.symbol || "PRPH"}</span>
      <button 
        onClick={() => refetch()} 
        className="ml-1 text-xs opacity-50 hover:opacity-100"
        title="Refresh balance"
      >
        ↻
      </button>
    </div>
  );
}

function BuyProphetTokens() {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  
  // Get balance refetch function to refresh after purchase
  const { refetch: refetchBalance } = useWalletBalance({
    client,
    chain,
    address: account?.address,
    tokenAddress: PROPHET_TOKEN_ADDRESS,
  });

  const handleBuyTokens = async () => {
    if (!account) {
      console.error("No account connected");
      return;
    }

    try {
      console.log("Attempting to buy Prophet tokens...");
      
      // Get the contract
      const contract = getContract({
        client,
        chain,
        address: PROPHET_TOKEN_ADDRESS,
      });

      // Use the claim function that accepts ETH payment
      // Let's buy 10 tokens instead of 100 to make the numbers more readable
      const tokenAmount = toWei("10"); // 10 tokens
      const ethCost = toWei("0.00001"); // 0.00001 ETH payment (10 tokens * 0.000001 ETH per token)
      
      const transaction = prepareContractCall({
        contract,
        method: "function claim(address to, uint256 quantity)",
        params: [account.address, tokenAmount], // 10 tokens
        value: ethCost,
      });

      console.log("Prepared transaction:", transaction);

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Transaction successful:", result);
          // Refresh balance after successful transaction
          setTimeout(() => {
            refetchBalance();
          }, 2000); // Wait 2 seconds for blockchain to update
        },
        onError: (error) => {
          console.error("Transaction failed:", error);
          
          // Check if user rejected the transaction
          const errorMessage = error.message || '';
          const errorCode = (error as { code?: number }).code;
          
          if (errorMessage.includes("User rejected") || 
              errorMessage.includes("user rejected") ||
              errorMessage.includes("User denied") ||
              errorCode === 4001) {
            console.log("Transaction cancelled by user");
          } else {
            console.log("Transaction failed - check console for details");
          }
        },
      });

    } catch (error) {
      console.error("Error preparing transaction:", error);
      console.log("This contract may not have claim conditions set up. You need to:");
      console.log("1. Set claim conditions on your contract");
      console.log("2. Or use an admin function to mint tokens");
    }
  };

  if (!account) return null;

  return (
    <Button 
      onClick={handleBuyTokens} 
      disabled={isPending}
      className="hidden sm:flex"
      size="sm"
    >
      {isPending ? "Buying..." : "Buy 10 Tokens"}
    </Button>
  );
}

const Navbar: React.FC = () => {
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container flex h-16 items-center px-4 sm:px-8">
        <div className="mr-4 flex">
          <Link to="/" className="flex items-center space-x-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">PROPHET</span>
          </Link>
        </div>
        
        <nav className="flex-1">
          <ul className="flex space-x-4">
            <li>
              <Link 
                to="/" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <Music size={20} /> : "Home"}
              </Link>
            </li>
            <li>
              <Link 
                to="/leaderboard" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <TrendingUp size={20} /> : "Leaderboard"}
              </Link>
            </li>
            <li>
              <Link 
                to="/markets" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <ChartBar size={20} /> : "Markets"}
              </Link>
            </li>
            <li>
              <Link 
                to="/portfolio" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <User size={20} /> : "Portfolio"}
              </Link>
            </li>
            {isAdmin && (
              <>
                <li>
                  <Link 
                    to="/admin" 
                    className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {isMobile ? <Shield size={20} /> : (
                      <>
                        <Shield size={16} />
                        Admin
                      </>
                    )}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/bonding-curve" 
                    className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {isMobile ? <TrendingUp size={20} /> : (
                      <>
                        <TrendingUp size={16} />
                        Curves
                      </>
                    )}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        
        <div className="flex items-center gap-2">
          <ProphetTokenBalance />
          <BuyProphetTokens />
          <ConnectButton client={client} />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
