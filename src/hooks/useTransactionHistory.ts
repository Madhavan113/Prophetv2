import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/lib/thirdweb";

const BONDING_CURVE_ADDRESS = "0xAF9f3c79c6b8B051bc02cBCB0ab0a19eA2057d07";

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  artistToken: string;
  artistName: string;
  artistSymbol: string;
  prophetAmount: string;
  artistAmount: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

export const useTransactionHistory = () => {
  const account = useActiveAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get bonding curve contract
  const bondingCurve = getContract({
    client,
    chain,
    address: BONDING_CURVE_ADDRESS,
  });

  useEffect(() => {
    if (!account?.address) {
      setTransactions([]);
      return;
    }

    // In a production app, you would:
    // 1. Use getContractEvents to fetch ArtistTokenBought and ArtistTokenSold events
    // 2. Filter by user address
    // 3. Parse event data to create transaction objects
    // 4. Store in local storage or database for persistence

    // For now, we'll use localStorage to simulate transaction history
    const loadStoredTransactions = () => {
      try {
        const stored = localStorage.getItem(`transactions_${account.address}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setTransactions(parsed);
        }
      } catch (error) {
        console.error('Error loading transaction history:', error);
      }
    };

    loadStoredTransactions();
  }, [account?.address]);

  // Function to add a new transaction (call this after successful trades)
  const addTransaction = (transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
    if (!account?.address) return;

    const newTransaction: Transaction = {
      ...transaction,
      id: `${transaction.txHash}_${Date.now()}`,
      timestamp: Date.now(),
    };

    const updatedTransactions = [newTransaction, ...transactions].slice(0, 50); // Keep last 50 transactions
    setTransactions(updatedTransactions);

    // Store in localStorage
    try {
      localStorage.setItem(`transactions_${account.address}`, JSON.stringify(updatedTransactions));
    } catch (error) {
      console.error('Error saving transaction history:', error);
    }
  };

  return {
    transactions,
    isLoading,
    addTransaction,
  };
}; 