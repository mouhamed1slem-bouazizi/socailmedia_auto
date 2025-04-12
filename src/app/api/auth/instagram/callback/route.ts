import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Get the state from cookies for verification
    const stateCookie = request.cookies.get('instagram_state')?.value;
    
    if (error) {
      console.error('Instagram auth error:', error);
      return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_auth_denied', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    if (!code || !stateParam) {
      console.error('Missing code or state parameter');
      return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_missing_params', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    // Extract user ID from state parameter
    const [userId, state] = stateParam.split('_');
    
    // Verify state to prevent CSRF attacks
    if (!stateCookie || state !== stateCookie) {
      console.error('State mismatch, possible CSRF attack');
      return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_invalid_state', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
        code,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Error exchanging code for token:', errorData);
      return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_token_exchange', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const instagramUserId = tokenData.user_id;
    
    // Get user profile information
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
    
    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.error('Error fetching Instagram profile:', errorData);
      return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_profile_fetch', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    const profileData = await profileResponse.json();
    const username = profileData.username;
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.error('User not found in database');
      return NextResponse.redirect(new URL('/dashboard/settings?error=user_not_found', process.env.NEXT_PUBLIC_APP_URL!));
    }
    
    // Update user document with Instagram account info
    await updateDoc(doc(db, 'users', userId), {
      'instagramAccount': {
        username,
        accessToken,
        profileId: instagramUserId,
        connectedAt: new Date().toISOString(),
        posts: []
      }
    });
    
    // Redirect back to settings page with success message
    return NextResponse.redirect(new URL('/dashboard/settings?success=instagram_connected', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (error) {
    console.error('Error in Instagram callback:', error);
    return NextResponse.redirect(new URL('/dashboard/settings?error=instagram_unknown', process.env.NEXT_PUBLIC_APP_URL!));
  }
}