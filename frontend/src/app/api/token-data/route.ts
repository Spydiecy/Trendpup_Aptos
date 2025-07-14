import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

export async function GET() {
  // Use Next.js cache with tags for selective invalidation
  const getCachedTokenData = unstable_cache(
    async () => {
      const backendUrl = 'http://localhost:3001/api/token-data';
      const response = await fetch(backendUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch token data');
      }
      return response.json();
    },
    ['token-data'],
    {
      tags: ['token-data'],
      revalidate: 60 // Cache for 60 seconds
    }
  );

  try {
    const result = await getCachedTokenData();
    return NextResponse.json(result, {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Proxy error fetching token data:', error);
    return NextResponse.json(
      { error: 'Failed to proxy token data', data: [] },
      { status: 500 }
    );
  }
}

// Revalidate every 60 seconds in production
export const revalidate = 60;