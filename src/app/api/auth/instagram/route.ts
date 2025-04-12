// First, check if you have this file. If not, you'll need to create it with proper Instagram OAuth handling

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    // Get user ID from headers
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Instagram OAuth configuration
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      console.error('Missing Instagram configuration:', { 
        hasClientId: !!clientId, 
        hasRedirectUri: !!redirectUri 
      });
      return NextResponse.json(
        { error: 'Instagram integration is not properly configured' }, 
        { status: 500 }
      );
    }
    
    // Log the configuration for debugging
    console.log('Instagram OAuth configuration:', {
      clientId: clientId.substring(0, 4) + '...',
      redirectUri
    });
    
    // Construct the Instagram authorization URL
    const scope = 'user_profile,user_media';
    const responseType = 'code';
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=${responseType}&state=${userId}`;
    
    console.log('Redirecting to Instagram auth URL:', authUrl);
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initializing Instagram auth:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Instagram authentication' },
      { status: 500 }
    );
  }
}