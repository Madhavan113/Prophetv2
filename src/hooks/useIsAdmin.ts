import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";

const FACTORY_ADDRESS = "0x2ded26df8b4865471a7c0b0ab1633acb76e24e28"; // Replace with your deployed factory address

export const useIsAdmin = () => {
  const account = useActiveAccount();
  
  const factory = getContract({
    client,
    chain, 
    address: FACTORY_ADDRESS
  });

  const { data: hasAdminRole, isLoading } = useReadContract({
    contract: factory,
    method: "function hasRole(bytes32 role, address account) view returns (bool)",
    params: [
      "0x0000000000000000000000000000000000000000000000000000000000000000", // DEFAULT_ADMIN_ROLE
      account?.address || "0x0000000000000000000000000000000000000000"
    ]
  });

  return {
    isAdmin: !!hasAdminRole && !!account?.address,
    isLoading: isLoading || !account?.address,
    address: account?.address
  };
}; 