import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Configure Aptos Network (using testnet for development)
export const APTOS_NETWORK = Network.TESTNET;

// Simple wallet configuration
export const wallets: any[] = [];

// Aptos client configuration
export const aptosConfig = new AptosConfig({ 
  network: APTOS_NETWORK
});

export const aptos = new Aptos(aptosConfig);
export { Network };
