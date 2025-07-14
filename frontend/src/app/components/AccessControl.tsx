'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { trendPupAccess, CONTRACT_CONFIG, AccessStatus } from '../../services/AccessControl';
import { FaLock, FaUnlock, FaClock, FaSpinner, FaCheckCircle, FaWallet, FaSync, FaSignOutAlt } from 'react-icons/fa';

interface AccessControlProps {
  children: React.ReactNode;
}

interface AptosAccount {
  address: string;
  publicKey: string;
}

interface WalletProvider {
  connect: () => Promise<AptosAccount>;
  disconnect: () => Promise<void>;
  account: () => Promise<AptosAccount>;
  isConnected: () => Promise<boolean>;
  signAndSubmitTransaction?: (transaction: any) => Promise<any>;
}

export default function AccessControl({ children }: AccessControlProps) {
  const [account, setAccount] = useState<AptosAccount | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentWallet, setCurrentWallet] = useState<WalletProvider | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const walletOptions = [
    { 
      name: 'Petra', 
      provider: () => isClient && typeof window !== 'undefined' ? (window as any).aptos : null,
      icon: '🟣'
    },
    { 
      name: 'Pontem', 
      provider: () => isClient && typeof window !== 'undefined' ? (window as any).pontem : null,
      icon: '🔷'
    },
    { 
      name: 'Martian', 
      provider: () => isClient && typeof window !== 'undefined' ? (window as any).martian : null,
      icon: '🔴'
    }
  ];

  // Check wallet connection on component mount
  useEffect(() => {
    // Set client-side flag
    setIsClient(true);
    
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Small delay to ensure wallet extensions are loaded
    const initTimer = setTimeout(() => {
      checkExistingConnection();
    }, 500);
    
    // Set up periodic wallet connection check
    const connectionCheckInterval = setInterval(() => {
      checkWalletConnectionStatus();
    }, 3000); // Check every 3 seconds

    // Listen for account changes (wallet disconnection)
    const handleAccountChange = () => {
      console.log('Account change detected');
      setTimeout(() => {
        checkWalletConnectionStatus();
      }, 1000);
    };

    // Add event listeners for wallet changes
    window.addEventListener('aptos:accountChanged', handleAccountChange);
    window.addEventListener('pontem:accountChanged', handleAccountChange);
    window.addEventListener('martian:accountChanged', handleAccountChange);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
      clearInterval(connectionCheckInterval);
      window.removeEventListener('aptos:accountChanged', handleAccountChange);
      window.removeEventListener('pontem:accountChanged', handleAccountChange);
      window.removeEventListener('martian:accountChanged', handleAccountChange);
    };
  }, []);

  // Check access status when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      checkAccessStatus();
    } else {
      setAccessStatus(null);
      setLoading(false);
    }
  }, [connected, account?.address]);

  const checkExistingConnection = async () => {
    for (const wallet of walletOptions) {
      const provider = wallet.provider();
      if (provider) {
        try {
          const isConnected = await provider.isConnected();
          if (isConnected) {
            const accountInfo = await provider.account();
            setAccount(accountInfo);
            setConnected(true);
            setCurrentWallet(provider);
            break;
          }
        } catch (error) {
          console.log(`No existing connection for ${wallet.name}`);
        }
      }
    }
  };

  const checkWalletConnectionStatus = async () => {
    if (!connected || !currentWallet) return;

    try {
      const isStillConnected = await currentWallet.isConnected();
      if (!isStillConnected) {
        console.log('Wallet disconnected, refreshing page');
        // Refresh the page to reset everything and show wallet connection screen
        window.location.reload();
      }
    } catch (error) {
      console.log('Error checking wallet connection, refreshing page');
      // Refresh the page to reset everything and show wallet connection screen
      window.location.reload();
    }
  };

  const connectWallet = async (walletName: string) => {
    const wallet = walletOptions.find(w => w.name === walletName);
    if (!wallet) return;

    setLoading(true);
    setError(null);

    try {
      const provider = wallet.provider();
      if (!provider) {
        throw new Error(`${walletName} wallet not found. Please install the extension.`);
      }

      const accountInfo = await provider.connect();
      setAccount(accountInfo);
      setConnected(true);
      setCurrentWallet(provider);
    } catch (error: any) {
      setError(error.message || `Failed to connect to ${walletName}`);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    if (currentWallet) {
      try {
        await currentWallet.disconnect();
      } catch (error) {
        console.error('Error disconnecting wallet:', error);
      }
    }
    // Refresh the page to show wallet connection screen
    window.location.reload();
  };

  const checkAccessStatus = async () => {
    if (!account?.address) return;
    
    // First verify wallet is still connected
    if (currentWallet) {
      try {
        const isStillConnected = await currentWallet.isConnected();
        if (!isStillConnected) {
          console.log('Wallet no longer connected during access check, refreshing page');
          window.location.reload();
          return;
        }
      } catch (error) {
        console.log('Error verifying wallet connection during access check, refreshing page');
        window.location.reload();
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const hasAccess = await trendPupAccess.hasAccess(account.address);
      const accessInfo = await trendPupAccess.getAccessInfo(account.address);
      
      const status: AccessStatus = {
        hasAccess,
        isExpired: trendPupAccess.isAccessExpired(accessInfo.expirationTime),
        expirationTime: accessInfo.expirationTime,
        timeLeft: hasAccess ? trendPupAccess.getTimeUntilExpiration(accessInfo.expirationTime) : undefined,
      };
      
      setAccessStatus(status);
    } catch (err) {
      console.error('Error checking access:', err);
      setError('Failed to check access status');
    } finally {
      setLoading(false);
    }
  };

  const purchaseAccess = async () => {
    if (!account?.address || !currentWallet) return;
    
    setPurchasing(true);
    setError(null);
    
    try {
      console.log('Current wallet object:', currentWallet);
      console.log('Account object:', account);
      
      // Check if wallet still has the signAndSubmitTransaction method
      if (!currentWallet.signAndSubmitTransaction) {
        throw new Error('Wallet does not support transaction signing. Please reconnect your wallet.');
      }

      console.log('Calling purchase access with current wallet...');
      
      // Pass the wallet directly - let the service handle the transaction format
      const txHash = await trendPupAccess.purchaseAccess(currentWallet);
      console.log('Access purchased! Transaction:', txHash);
      
      // Wait a bit for the transaction to be processed
      setTimeout(() => {
        checkAccessStatus();
      }, 3000);
      
    } catch (err: any) {
      console.error('Error purchasing access:', err);
      
      // More specific error messages
      let errorMessage = 'Failed to purchase access.';
      if (err.message.includes('map')) {
        errorMessage = 'Transaction format error. Please try disconnecting and reconnecting your wallet.';
      } else if (err.message.includes('insufficient')) {
        errorMessage = 'Insufficient APT balance. Please add funds to your wallet.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setPurchasing(false);
    }
  };

  // Show wallet connection prompt first if not connected
  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-trendpup-light to-white">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md mx-4 text-center border border-trendpup-brown/20">
          {/* TrendPup Logo */}
          <div className="mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={80} 
              height={80}
              className="mx-auto mb-4" 
            />
          </div>
          
          <FaLock className="text-4xl text-trendpup-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-trendpup-dark mb-4">Connect Your Wallet</h2>
          <p className="text-trendpup-brown mb-6">
            Please connect your Aptos wallet to access TrendPup AI memecoin intelligence.
          </p>
          
          {/* Connect Wallet Button */}
          <div className="space-y-3 mb-4">
            {walletOptions.map((wallet) => {
              const provider = wallet.provider();
              const isAvailable = isClient && provider;
              return (
                <button
                  key={wallet.name}
                  onClick={() => connectWallet(wallet.name)}
                  disabled={loading || !isAvailable}
                  className="w-full bg-trendpup-orange hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <FaSpinner className="animate-spin mr-2" />
                  ) : (
                    <>
                      <span className="mr-2">{wallet.icon}</span>
                      <FaWallet className="mr-2" />
                    </>
                  )}
                  Connect {wallet.name} {!isAvailable && '(Not Installed)'}
                </button>
              );
            })}
          </div>
          
          <p className="text-sm text-gray-600">
            Supported wallets: Petra, Pontem, Martian, and more
          </p>
        </div>
      </div>
    );
  }

  // Show loading state only when connected and checking access
  if (loading && connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-trendpup-light to-white">
        <div className="text-center">
          <FaSpinner className="text-4xl text-trendpup-orange animate-spin mx-auto mb-4" />
          <p className="text-trendpup-dark">Checking access status...</p>
        </div>
      </div>
    );
  }

  // Show access required screen
  if (!accessStatus?.hasAccess || accessStatus.isExpired) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-trendpup-light to-white">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md mx-4 text-center border border-trendpup-brown/20">
          {/* TrendPup Logo */}
          <div className="mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={80} 
              height={80}
              className="mx-auto mb-4" 
            />
          </div>
          
          <FaLock className="text-4xl text-trendpup-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-trendpup-dark mb-4">Premium Access Required</h2>
          <p className="text-trendpup-brown mb-6">
            Get 30-day access to TrendPup's AI-powered memecoin intelligence platform.
          </p>
          
          <div className="bg-trendpup-light p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-trendpup-dark font-semibold">Access Fee:</span>
              <span className="text-trendpup-orange font-bold">
                {trendPupAccess.formatAptAmount(CONTRACT_CONFIG.ACCESS_FEE)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-trendpup-dark font-semibold">Duration:</span>
              <span className="text-trendpup-brown">30 days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-trendpup-dark font-semibold">Connected:</span>
              <span className="text-trendpup-brown text-sm">
                {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
              </span>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={disconnectWallet}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <FaSignOutAlt className="mr-2" />
              Disconnect
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <FaSync className="mr-2" />
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  checkExistingConnection();
                }}
                className="text-red-600 underline text-xs mt-1"
              >
                Try reconnecting
              </button>
            </div>
          )}

          <button
            onClick={purchaseAccess}
            disabled={purchasing}
            className="w-full bg-trendpup-orange hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
          >
            {purchasing ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <FaUnlock className="mr-2" />
                Purchase Access
              </>
            )}
          </button>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-trendpup-dark mb-2">What you get:</h3>
            <ul className="text-sm text-trendpup-brown space-y-1">
              <li>✅ AI-powered memecoin analysis</li>
              <li>✅ Real-time market intelligence</li>
              <li>✅ Scam detection & risk scoring</li>
              <li>✅ Voice-enabled AI assistant</li>
              <li>✅ Aptos Move contract insights</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // User has access - show children with access status
  return (
    <div className="min-h-screen bg-trendpup-light relative">
      {/* Small Access Status Card - Top Left */}
      <div className="fixed top-4 left-4 z-50">
        <div className="bg-white rounded-lg shadow-lg border border-green-200 p-3 max-w-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-green-700">
              <FaCheckCircle className="mr-2 text-sm" />
              <div>
                <div className="font-semibold text-sm">Premium Active</div>
                <div className="text-xs text-green-600">
                  {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
                </div>
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={checkAccessStatus}
                disabled={loading}
                className="text-green-600 hover:text-green-700 p-1 text-xs"
                title="Refresh access status"
              >
                <FaSync className={loading ? 'animate-spin' : ''} />
              </button>
              
              <button
                onClick={disconnectWallet}
                className="text-green-600 hover:text-red-600 p-1 text-xs"
                title="Disconnect wallet"
              >
                <FaSignOutAlt />
              </button>
            </div>
          </div>
          
          {accessStatus?.timeLeft && (
            <div className="mt-2 pt-2 border-t border-green-100">
              <div className="flex items-center text-green-600 text-xs">
                <FaClock className="mr-1" />
                <span>
                  {accessStatus.timeLeft.days}d {accessStatus.timeLeft.hours}h {accessStatus.timeLeft.minutes}m left
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
}
