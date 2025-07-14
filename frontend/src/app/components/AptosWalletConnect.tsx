'use client';

import { useState, useEffect } from 'react';
import { FaWallet, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';

interface AptosAccount {
  address: string;
  publicKey: string;
}

interface WalletProvider {
  connect: () => Promise<AptosAccount>;
  disconnect: () => Promise<void>;
  account: () => Promise<AptosAccount>;
  isConnected: () => Promise<boolean>;
}

declare global {
  interface Window {
    aptos?: WalletProvider; // Petra
    pontem?: WalletProvider; // Pontem
    martian?: WalletProvider; // Martian
    fewcha?: WalletProvider; // Fewcha
  }
}

export default function AptosWalletConnect() {
  const [account, setAccount] = useState<AptosAccount | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);

  const walletOptions = [
    { 
      name: 'Petra', 
      key: 'aptos', 
      icon: '🟣', 
      provider: () => window.aptos,
      downloadUrl: 'https://petra.app/' 
    },
    { 
      name: 'Pontem', 
      key: 'pontem', 
      icon: '🔷', 
      provider: () => window.pontem,
      downloadUrl: 'https://pontem.network/pontem-wallet' 
    },
    { 
      name: 'Martian', 
      key: 'martian', 
      icon: '👽', 
      provider: () => window.martian,
      downloadUrl: 'https://martianwallet.xyz/' 
    },
  ];

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    for (const wallet of walletOptions) {
      const provider = wallet.provider();
      if (provider) {
        try {
          const isConnected = await provider.isConnected();
          if (isConnected) {
            const accountInfo = await provider.account();
            setAccount(accountInfo);
            setConnected(true);
            setSelectedWallet(wallet.name);
            break;
          }
        } catch (error) {
          console.error(`Error checking ${wallet.name} connection:`, error);
        }
      }
    }
  };

  const connectWallet = async (walletName: string) => {
    const wallet = walletOptions.find(w => w.name === walletName);
    if (!wallet) return;

    const provider = wallet.provider();
    if (!provider) {
      if (confirm(`${walletName} wallet is not installed. Would you like to download it?`)) {
        window.open(wallet.downloadUrl, '_blank');
      }
      return;
    }

    setLoading(true);
    setShowDropdown(false);
    try {
      const accountInfo = await provider.connect();
      setAccount(accountInfo);
      setConnected(true);
      setSelectedWallet(walletName);
    } catch (error) {
      console.error(`Error connecting to ${walletName}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    const wallet = walletOptions.find(w => w.name === selectedWallet);
    if (wallet) {
      const provider = wallet.provider();
      if (provider) {
        try {
          await provider.disconnect();
        } catch (error) {
          console.error('Error disconnecting wallet:', error);
        }
      }
    }
    setAccount(null);
    setConnected(false);
    setSelectedWallet('');
  };

  if (connected && account) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-lg p-2 shadow-lg">
        <div className="flex items-center gap-2">
          <FaWallet className="text-green-600" />
          <div className="text-sm">
            <div className="font-medium">{selectedWallet} Connected</div>
            <div className="text-gray-600">
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </div>
          </div>
        </div>
        <button
          onClick={disconnectWallet}
          className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
        >
          <FaSignOutAlt size={12} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
        className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2 rounded-lg shadow-lg transition-colors disabled:opacity-50"
      >
        <FaWallet />
        <span>{loading ? 'Connecting...' : 'Connect Wallet'}</span>
        <FaChevronDown className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border min-w-48 z-50">
          <div className="p-2">
            <div className="text-sm font-medium text-gray-700 px-3 py-2">Choose Wallet</div>
            {walletOptions.map((wallet) => {
              const isAvailable = !!wallet.provider();
              return (
                <button
                  key={wallet.key}
                  onClick={() => connectWallet(wallet.name)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-left disabled:opacity-50"
                  disabled={loading}
                >
                  <span className="text-lg">{wallet.icon}</span>
                  <span className="text-sm">{wallet.name}</span>
                  {!isAvailable && (
                    <span className="text-xs text-gray-400 ml-auto">Not Installed</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
