'use client';

import 'cross-fetch/polyfill';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { wallets, APTOS_NETWORK } from '../aptos';
import { useState } from 'react';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <AptosWalletAdapterProvider 
            plugins={wallets} 
            autoConnect={true}
            dappConfig={{ 
              network: APTOS_NETWORK
            }}
          >
            {children}
          </AptosWalletAdapterProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
