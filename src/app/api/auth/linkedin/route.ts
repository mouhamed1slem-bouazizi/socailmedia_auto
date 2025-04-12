// Update the LinkedIn authorization route with better error handling
import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Get the user ID from the request headers
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Generate a random state parameter to prevent CSRF attacks
    const state = uuidv4().replace(/-/g, '').substring(0, 10);
    
    // Store the state in the user's document
    await updateDoc(doc(db, 'users', userId), {
      linkedinAuthState: state
    });
    
    // Make sure this EXACTLY matches what you registered in LinkedIn Developer Portal
    const redirectUri = 'http://localhost:3000/api/auth/linkedin/callback';
    
    // Construct the LinkedIn authorization URL with the required scope parameter
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', process.env.LINKEDIN_CLIENT_ID!);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', 'openid profile email'); // Include valid openId scopes
    
    console.log('LinkedIn auth URL:', authUrl.toString());
    
    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    console.error('Error initializing LinkedIn auth:', error);
    return NextResponse.json({ error: 'Failed to initialize LinkedIn authentication' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      return NextResponse.json({ error: 'LinkedIn authentication failed' }, { status: 400 });
    }
    
    if (!code || !state) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Find user with matching state
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('linkedinAuthState', '==', state));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }
    
    const userId = querySnapshot.docs[0].id;
    const userData = querySnapshot.docs[0].data();
    
    if (!userData || userData.linkedinAuthState !== state) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }
    
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3000/api/auth/linkedin/callback',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token error:', errorData);
      return NextResponse.json({ error: 'Failed to obtain access token' }, { status: 500 });
    }
    
    const tokenData = await tokenResponse.json();
    
    // Generate a unique identifier for this LinkedIn connection
    const connectionId = `linkedin_${Date.now()}`;
    
    // Update the user's document with LinkedIn account information
    await updateDoc(doc(db, 'users', userId), {
      linkedinAccount: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresIn: tokenData.expires_in,
        connectedAt: new Date().toISOString(),
        username: 'LinkedIn User',
        profileId: connectionId,
        connectionStatus: 'connected'
      },
      linkedinAuthState: null // Clear the state
    });
    
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=linkedin_connected`);
  } catch (error: unknown) {
    // Change from any to unknown
    console.error('Error handling LinkedIn callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=unknown_error`
    );
  }
}