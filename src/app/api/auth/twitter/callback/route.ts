import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const adminDb = admin.firestore();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  console.log('Callback initiated:', { code: !!code, state: !!state });

  if (!code || !state) {
    console.error('Missing parameters:', { code: !!code, state: !!state });
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=missing_params`);
  }

  try {
    // Log code verifier retrieval
    const cookies = request.headers.get('cookie');
    console.log('Cookies present:', !!cookies);
    
    const codeVerifier = cookies?.split(';')
      .find(cookie => cookie.trim().startsWith('code_verifier='))
      ?.split('=')[1];
    
    console.log('Code verifier found:', !!codeVerifier);

    // Log token exchange attempt
    console.log('Attempting token exchange...', {
      hasCode: !!code,
      hasVerifier: !!codeVerifier,
      redirectUri: `${baseUrl}/api/auth/twitter/callback`
    });

    const credentials = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64');

    console.log('Credentials prepared:', {
      hasClientId: !!process.env.TWITTER_CLIENT_ID,
      hasClientSecret: !!process.env.TWITTER_CLIENT_SECRET,
      hasCredentials: !!credentials
    });

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: `${baseUrl}/api/auth/twitter/callback`,
        code_verifier: codeVerifier || ''
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        requestParams: {
          hasCode: !!code,
          hasVerifier: !!codeVerifier,
          hasCredentials: !!credentials,
          redirectUri: `${baseUrl}/api/auth/twitter/callback`
        }
      });
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');

    // Log user info fetch attempt
    console.log('Fetching user info...', {
      hasAccessToken: !!tokens.access_token
    });
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,profile_image_url', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('User info fetch failed:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorText,
        headers: userResponse.headers
      });
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    console.log('User info fetched:', {
      hasUsername: !!userData?.data?.username,
      responseStructure: Object.keys(userData)
    });

    // Log Firestore save attempt
    console.log('Preparing Firestore save...', {
      userId: state,
      hasUserData: !!userData?.data,
      documentPath: `users/${state}`
    });

    try {
      const userRef = adminDb.collection('users').doc(state);
      
      const userDocData = {
        id: state,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        twitterAccount: {
          username: userData.data.username,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          connectedAt: new Date().toISOString(),
          profileImage: userData.data.profile_image_url
        }
      };

      console.log('Saving combined data:', {
        documentPath: `users/${state}`,
        fields: Object.keys(userDocData),
        userId: state
      });

      await userRef.set(userDocData, { merge: true });
      console.log('Firestore save completed successfully');
    } catch (firestoreError) {
      console.error('Firestore operation failed:', {
        error: firestoreError,
        code: firestoreError instanceof Error ? 
          // Fix: Convert to unknown first, then to Record<string, unknown>
          (firestoreError as unknown as Record<string, unknown>).code : 'unknown',
        message: firestoreError instanceof Error ? firestoreError.message : String(firestoreError),
        path: `users/${state}`,
        timestamp: new Date().toISOString()
      });
      throw firestoreError;
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/settings?success=true`);
  } catch (error) {
    console.error('Twitter auth error:', error);
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=auth_failed`);
  }
}