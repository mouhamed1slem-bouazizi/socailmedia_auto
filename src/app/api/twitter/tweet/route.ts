import { NextResponse } from 'next/server';
import crypto from 'crypto';

// OAuth helper functions
function encodeRFC3986URIComponent(str: string) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => 
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function generateNonce() {
  return crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
}

// OAuth credentials mapping
const oauth = {
  consumer_key: process.env.TWITTER_API_KEY!,
  consumer_secret: process.env.TWITTER_API_SECRET_KEY!,
  token: process.env.TWITTER_ACCESS_TOKEN!,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
};

function generateOAuth1Header(method: string, url: string, params: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams = {
    oauth_consumer_key: oauth.consumer_key,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: oauth.token,
    oauth_version: '1.0'
  };

  // Combine all parameters for signature
  const signatureParams = {
    ...params,
    ...oauthParams
  };

  // Create signature base string
  const baseString = [
    method.toUpperCase(),
    encodeRFC3986URIComponent(url),
    encodeRFC3986URIComponent(
      Object.keys(signatureParams)
        .sort()
        .map(key => `${encodeRFC3986URIComponent(key)}=${encodeRFC3986URIComponent(signatureParams[key])}`)
        .join('&')
    )
  ].join('&');

  // Create signing key
  const signingKey = `${encodeRFC3986URIComponent(oauth.consumer_secret)}&${encodeRFC3986URIComponent(oauth.token_secret)}`;
  
  // Generate signature
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  // Debug logging
  console.log('OAuth 1.0a Parameters:', {
    url,
    method,
    timestamp,
    nonce,
    signature: signature.substring(0, 10) + '...' // Only log part of the signature for security
  });

  // Create authorization header
  return 'OAuth ' + [
    ...Object.entries(oauthParams),
    ['oauth_signature', signature]
  ]
    .map(([key, value]) => `${key}="${encodeRFC3986URIComponent(value)}"`)
    .join(', ');
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const userId = formData.get('userId') as string;
    const image = formData.get('image') as File | null;

    if (!text || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if we have all required Twitter credentials
    if (!oauth.consumer_key || !oauth.consumer_secret || !oauth.token || !oauth.token_secret) {
      console.error('Missing Twitter API credentials:', {
        hasConsumerKey: !!oauth.consumer_key,
        hasConsumerSecret: !!oauth.consumer_secret,
        hasToken: !!oauth.token,
        hasTokenSecret: !!oauth.token_secret
      });
      throw new Error('Missing Twitter API credentials');
    }

    // Handle image upload if present
    let mediaId = null;
    if (image) {
      console.log('Image detected, uploading to Twitter media endpoint');
      
      // Convert File to Buffer
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Twitter media endpoint (v1.1 is still used for media uploads)
      const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      
      // Generate OAuth header for media upload
      const mediaAuthHeader = generateOAuth1Header('POST', mediaUrl, {});
      
      // Create form data for media upload
      const mediaFormData = new FormData();
      mediaFormData.append('media', new Blob([buffer]), image.name);
      
      const mediaResponse = await fetch(mediaUrl, {
        method: 'POST',
        headers: {
          'Authorization': mediaAuthHeader
        },
        body: mediaFormData
      });
      
      if (!mediaResponse.ok) {
        const errorData = await mediaResponse.text();
        console.error('Twitter media upload error:', errorData);
        throw new Error(`Failed to upload image: ${errorData}`);
      }
      
      const mediaData = await mediaResponse.json();
      mediaId = mediaData.media_id_string;
      console.log('Media uploaded successfully, ID:', mediaId);
    }

    console.log('Using Twitter OAuth 1.0a User Context authentication with v2 API');

    // Switch to v2 API for tweet creation
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    
    // Prepare tweet data with or without media
    let tweetData;
    if (mediaId) {
      tweetData = { 
        text, 
        media: { media_ids: [mediaId] } 
      };
    } else {
      tweetData = { text };
    }
    
    // Generate OAuth header for v2 API
    const authHeader = generateOAuth1Header('POST', tweetUrl, {});

    console.log('Posting tweet with v2 API:', { 
      text, 
      hasMedia: !!mediaId 
    });
    
    const tweetResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });

    if (!tweetResponse.ok) {
      const errorData = await tweetResponse.text();
      console.error('Twitter API error response:', errorData);
      
      // Try to parse the error response as JSON
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        // If it's not valid JSON, continue with the raw text
        parsedError = { detail: errorData };
      }
      
      if (tweetResponse.status === 401) {
        throw new Error('Twitter API authentication failed. Please check your API credentials.');
      } else if (tweetResponse.status === 403) {
        // Check for duplicate content error specifically
        if (parsedError.detail && parsedError.detail.includes('duplicate content')) {
          throw new Error('Cannot post duplicate tweet. Please modify your content.');
        } else {
          throw new Error('Your Twitter API access level does not allow posting tweets. Please upgrade your Twitter developer account.');
        }
      } else {
        throw new Error(`Failed to post tweet: ${errorData}`);
      }
    }

    const responseData = await tweetResponse.json();
    console.log('Tweet posted successfully:', responseData.data?.id);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error posting tweet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post tweet' },
      { status: 500 }
    );
  }
}