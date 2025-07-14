// TrendPup Access Control Contract Integration
// Use this in your frontend to interact with the Aptos Move contract

import { 
  Aptos, 
  AptosConfig, 
  Network, 
  Account,
  AccountAddress,
  InputViewFunctionData,
  InputEntryFunctionData
} from "@aptos-labs/ts-sdk";

// Contract configuration
export const CONTRACT_CONFIG = {
  // Deployed contract address on Aptos testnet
  CONTRACT_ADDRESS: "0x19476157bb73de0e8a55568264d111eadfc6503b8c798f0525760e540b18e7cb",
  MODULE_NAME: "access_control",
  ACCESS_FEE: 100_000_000, // 1 APT in octas
  ACCESS_DURATION: 30 * 24 * 60 * 60, // 30 days in seconds
};

export class TrendPupAccessControl {
  private aptos: Aptos;

  constructor(network: Network = Network.TESTNET) {
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);
  }

  // View Functions (read-only)

  /**
   * Check if a user has active access
   */
  async hasAccess(userAddress: string): Promise<boolean> {
    try {
      const payload: InputViewFunctionData = {
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::has_access`,
        functionArguments: [userAddress],
      };

      const result = await this.aptos.view({ payload });
      return result[0] as boolean;
    } catch (error) {
      console.error("Error checking access:", error);
      return false;
    }
  }

  /**
   * Get detailed access information for a user
   */
  async getAccessInfo(userAddress: string): Promise<{
    isActive: boolean;
    expirationTime: number;
    paymentAmount: number;
    grantedAt: number;
  }> {
    try {
      const payload: InputViewFunctionData = {
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::get_access_info`,
        functionArguments: [userAddress],
      };

      const result = await this.aptos.view({ payload });
      return {
        isActive: result[0] as boolean,
        expirationTime: Number(result[1]),
        paymentAmount: Number(result[2]),
        grantedAt: Number(result[3]),
      };
    } catch (error) {
      console.error("Error getting access info:", error);
      return {
        isActive: false,
        expirationTime: 0,
        paymentAmount: 0,
        grantedAt: 0,
      };
    }
  }

  /**
   * Get platform configuration
   */
  async getPlatformConfig(): Promise<{
    owner: string;
    treasury: string;
    accessFee: number;
    accessDuration: number;
    totalUsers: number;
    totalRevenue: number;
  }> {
    try {
      const payload: InputViewFunctionData = {
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::get_platform_config`,
        functionArguments: [],
      };

      const result = await this.aptos.view({ payload });
      return {
        owner: result[0] as string,
        treasury: result[1] as string,
        accessFee: Number(result[2]),
        accessDuration: Number(result[3]),
        totalUsers: Number(result[4]),
        totalRevenue: Number(result[5]),
      };
    } catch (error) {
      console.error("Error getting platform config:", error);
      throw error;
    }
  }

  /**
   * Get current access fee
   */
  async getAccessFee(): Promise<number> {
    try {
      const payload: InputViewFunctionData = {
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::get_access_fee`,
        functionArguments: [],
      };

      const result = await this.aptos.view({ payload });
      return Number(result[0]);
    } catch (error) {
      console.error("Error getting access fee:", error);
      return CONTRACT_CONFIG.ACCESS_FEE;
    }
  }

  /**
   * Check if platform is initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      const payload: InputViewFunctionData = {
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::is_initialized`,
        functionArguments: [],
      };

      const result = await this.aptos.view({ payload });
      return result[0] as boolean;
    } catch (error) {
      console.error("Error checking initialization:", error);
      return false;
    }
  }

  // Transaction Functions (write operations)

  /**
   * Purchase access to the platform (requires wallet signing)
   */
  async purchaseAccess(account: any): Promise<string> {
    try {
      console.log('Starting purchase access for:', account);
      
      // Simple transaction payload format that wallets expect
      const transactionPayload = {
        type: "entry_function_payload",
        function: `${CONTRACT_CONFIG.CONTRACT_ADDRESS}::${CONTRACT_CONFIG.MODULE_NAME}::purchase_access`,
        type_arguments: [],
        arguments: []
      };

      console.log('Transaction payload:', transactionPayload);

      // For wallet adapters, use the simple payload format
      if (account.signAndSubmitTransaction) {
        console.log('Using wallet signAndSubmitTransaction method');
        
        const pendingTransaction = await account.signAndSubmitTransaction(transactionPayload);
        
        console.log('Transaction submitted:', pendingTransaction);
        
        if (!pendingTransaction || !pendingTransaction.hash) {
          throw new Error('Transaction submission failed - no hash returned');
        }
        
        const executedTransaction = await this.aptos.waitForTransaction({
          transactionHash: pendingTransaction.hash,
        });

        console.log('Transaction executed:', executedTransaction);
        return executedTransaction.hash;
      } else {
        throw new Error('Wallet does not support signAndSubmitTransaction method');
      }
    } catch (error) {
      console.error("Error purchasing access:", error);
      throw error;
    }
  }

  // Utility Functions

  /**
   * Format APT amount from octas
   */
  formatAptAmount(octas: number): string {
    return (octas / 100_000_000).toFixed(2) + " APT";
  }

  /**
   * Format timestamp to human-readable date
   */
  formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  /**
   * Check if access is expired
   */
  isAccessExpired(expirationTime: number): boolean {
    return Date.now() / 1000 > expirationTime;
  }

  /**
   * Get time until access expires
   */
  getTimeUntilExpiration(expirationTime: number): {
    days: number;
    hours: number;
    minutes: number;
  } {
    const now = Date.now() / 1000;
    const timeLeft = Math.max(0, expirationTime - now);
    
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);

    return { days, hours, minutes };
  }
}

// Export singleton instance
export const trendPupAccess = new TrendPupAccessControl();

// Type definitions for easier integration
export interface AccessStatus {
  hasAccess: boolean;
  isExpired: boolean;
  expirationTime: number;
  timeLeft?: {
    days: number;
    hours: number;
    minutes: number;
  };
}

export interface PurchaseAccessResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}
