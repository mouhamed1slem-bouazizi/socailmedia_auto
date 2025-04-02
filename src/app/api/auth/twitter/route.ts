import { NextResponse } from 'next/server';
import crypto from 'crypto';

function generateCodeVerifier() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return verifier.replace(/[^a-zA-Z0-9]/g, '').substring(0, 43);
}

function generateCodeChallenge(verifier: string) {
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return challenge.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function POST(request: Request) {
  try {
    // Get user ID from request headers instead of body
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code` +
      `&client_id=${process.env.TWITTER_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + '/api/auth/twitter/callback')}` +
      `&scope=tweet.read tweet.write users.read offline.access` +
      `&state=${userId}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    const response = NextResponse.json({ url: authUrl });
    response.cookies.set('code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10
    });

    return response;
  } catch (error) {
    console.error('Error in Twitter auth:', error);
    return NextResponse.json({ error: 'Failed to initialize Twitter auth' }, { status: 500 });
  }
}