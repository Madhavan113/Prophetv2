import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROPHET_TOKEN_ADDRESS = "0xa4744fef305d3187c7862b49a6eefc69caa63272";
const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

interface ApprovalFlowProps {
  amount: string;
  onApprovalComplete: () => void;
}

const ApprovalFlow: React.FC<ApprovalFlowProps> = ({ amount, onApprovalComplete }) => {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const { toast } = useToast();

  const prophetToken = getContract({
    client,
    chain,
    address: PROPHET_TOKEN_ADDRESS,
  });

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    contract: prophetToken,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: account?.address ? [account.address, BONDING_CURVE_ADDRESS] : undefined
  });

  const needsApproval = allowance && amount ? 
    BigInt(allowance.toString()) < toWei(amount) : true;

  const handleApprove = async () => {
    if (!account || !amount) return;

    try {
      // Approve a large amount to avoid repeated approvals
      const approvalAmount = toWei("1000000"); // 1M tokens

      const transaction = prepareContractCall({
        contract: prophetToken,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [BONDING_CURVE_ADDRESS, approvalAmount]
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("Approval successful:", result);
          toast({
            title: "Approval Successful!",
            description: "You can now trade artist tokens.",
          });
          
          // Refresh allowance and notify parent
          setTimeout(() => {
            refetchAllowance();
            onApprovalComplete();
          }, 2000);
        },
        onError: (error) => {
          console.error("Approval failed:", error);
          toast({
            title: "Approval Failed",
            description: "Failed to approve Prophet tokens. Please try again.",
            variant: "destructive"
          });
        }
      });

    } catch (error) {
      console.error("Error approving tokens:", error);
    }
  };

  if (!needsApproval) {
    return (
      <Card className="bg-green-500/10 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-green-400 font-medium">Prophet tokens approved</span>
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
              You need to approve Prophet tokens before trading.
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
            "Approve Prophet Tokens"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ApprovalFlow; 