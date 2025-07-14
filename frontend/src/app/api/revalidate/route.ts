import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    // Revalidate the token-data cache
    revalidateTag('token-data');
    
    return NextResponse.json({ 
      message: 'Cache invalidated successfully',
      revalidated: true,
      now: Date.now()
    });
  } catch (err) {
    return NextResponse.json({ 
      message: 'Error revalidating cache',
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
