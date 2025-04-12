import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

<<<<<<< Updated upstream
export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    const userId = request.headers.get('x-user-id');
=======
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

  // Define oauthParams with a type that allows string indexing
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: oauth.consumer_key,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: oauth.token,
    oauth_version: '1.0'
  };

  // Combine all parameters for signature with proper typing
  const signatureParams: Record<string, string> = {
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
    const media = formData.get('media') as File | null;
    const mediaType = formData.get('mediaType') as string | null;
>>>>>>> Stashed changes

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

<<<<<<< Updated upstream
    // Get user's Twitter tokens from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
=======
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

    // Handle media upload if present
    let mediaId = null;
    if (media) {
      const isVideo = mediaType === 'video';
      console.log(`${isVideo ? 'Video' : 'Image'} detected, uploading to Twitter media endpoint`);
      
      // Convert File to Buffer
      const arrayBuffer = await media.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Twitter media endpoint (v1.1 is still used for media uploads)
      const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      
      // Generate OAuth header for media upload
      const mediaAuthHeader = generateOAuth1Header('POST', mediaUrl, {});
      
      if (isVideo) {
        // For videos, we need to use the chunked upload process
        console.log('Video upload detected, using chunked upload process');
        
        // Step 1: INIT - Tell Twitter we're going to upload a video
        const initFormData = new FormData();
        initFormData.append('command', 'INIT');
        initFormData.append('total_bytes', buffer.length.toString());
        initFormData.append('media_type', 'video/mp4'); // Specify the correct MIME type
        initFormData.append('media_category', 'tweet_video');
        
        const initResponse = await fetch(mediaUrl, {
          method: 'POST',
          headers: {
            'Authorization': mediaAuthHeader
          },
          body: initFormData
        });
        
        if (!initResponse.ok) {
          const errorData = await initResponse.text();
          console.error('Twitter media INIT error:', errorData);
          throw new Error(`Failed to initialize video upload: ${errorData}`);
        }
        
        const initData = await initResponse.json();
        const mediaIdString = initData.media_id_string;
        console.log('Media INIT successful, ID:', mediaIdString);
        
        // Step 2: APPEND - Upload the video data in chunks
        // For simplicity, we'll upload in a single chunk here
        // For larger videos, you'd want to split into multiple chunks
        const appendFormData = new FormData();
        appendFormData.append('command', 'APPEND');
        appendFormData.append('media_id', mediaIdString);
        appendFormData.append('segment_index', '0');
        appendFormData.append('media', new Blob([buffer]), 'video.mp4');
        
        const appendAuthHeader = generateOAuth1Header('POST', mediaUrl, {});
        const appendResponse = await fetch(mediaUrl, {
          method: 'POST',
          headers: {
            'Authorization': appendAuthHeader
          },
          body: appendFormData
        });
        
        if (!appendResponse.ok) {
          const errorData = await appendResponse.text();
          console.error('Twitter media APPEND error:', errorData);
          throw new Error(`Failed to upload video data: ${errorData}`);
        }
        
        console.log('Media APPEND successful');
        
        // Step 3: FINALIZE - Tell Twitter we're done uploading
        const finalizeFormData = new FormData();
        finalizeFormData.append('command', 'FINALIZE');
        finalizeFormData.append('media_id', mediaIdString);
        
        const finalizeAuthHeader = generateOAuth1Header('POST', mediaUrl, {});
        const finalizeResponse = await fetch(mediaUrl, {
          method: 'POST',
          headers: {
            'Authorization': finalizeAuthHeader
          },
          body: finalizeFormData
        });
        
        if (!finalizeResponse.ok) {
          const errorData = await finalizeResponse.text();
          console.error('Twitter media FINALIZE error:', errorData);
          throw new Error(`Failed to finalize video upload: ${errorData}`);
        }
        
        const finalizeData = await finalizeResponse.json();
        mediaId = finalizeData.media_id_string;
        console.log('Media FINALIZE successful, ID:', mediaId);
        
        // Step 4: STATUS - Check processing status (optional but recommended)
        // For videos, Twitter needs to process them before they can be used
        let processingInfo = finalizeData.processing_info;
        if (processingInfo) {
          console.log('Video processing required:', processingInfo);
          
          // Poll for status until processing is complete
          while (processingInfo && processingInfo.state !== 'succeeded') {
            if (processingInfo.state === 'failed') {
              console.error('Video processing failed:', processingInfo.error);
              throw new Error(`Video processing failed: ${processingInfo.error.message}`);
            }
            
            // Wait for the check_after_secs before checking again
            const waitTime = (processingInfo.check_after_secs || 1) * 1000;
            console.log(`Waiting ${waitTime}ms before checking video processing status...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Check status - construct the URL properly for OAuth signing
            // For GET requests with query parameters, we need to include those in the OAuth signature
            const statusParams = {
              'command': 'STATUS',
              'media_id': mediaIdString
            };
            
            // Build the base URL without query parameters for fetch
            const statusBaseUrl = 'https://upload.twitter.com/1.1/media/upload.json';
            
            // Generate OAuth header with the parameters included
            const statusAuthHeader = generateOAuth1Header('GET', statusBaseUrl, statusParams);
            
            // Build the full URL with query parameters for the fetch request
            const statusUrl = `${statusBaseUrl}?command=STATUS&media_id=${mediaIdString}`;
            
            console.log('Checking video processing status...');
            const statusResponse = await fetch(statusUrl, {
              method: 'GET',
              headers: {
                'Authorization': statusAuthHeader
              }
            });
            
            if (!statusResponse.ok) {
              const errorData = await statusResponse.text();
              console.error('Twitter media STATUS error:', errorData);
              throw new Error(`Failed to check video processing status: ${errorData}`);
            }
            
            const statusData = await statusResponse.json();
            processingInfo = statusData.processing_info;
            console.log('Video processing status:', processingInfo?.state);
          }
          
          console.log('Video processing complete, ready to use');
        }
      } else {
        // For images, we can use the simple upload process
        const mediaFormData = new FormData();
        mediaFormData.append('media', new Blob([buffer]), media.name);
        
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
        console.log('Image uploaded successfully, ID:', mediaId);
      }
    }

    console.log('Using Twitter OAuth 1.0a User Context authentication with v2 API');

    // Switch to v2 API for tweet creation
    const tweetUrl = 'https://api.twitter.com/2/tweets';
>>>>>>> Stashed changes
    
    if (!userData?.twitterAccount?.accessToken) {
      return NextResponse.json({ success: false, error: 'Twitter not connected' }, { status: 400 });
    }

    // Post tweet using OAuth 2.0
    const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userData.twitterAccount.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!tweetResponse.ok) {
<<<<<<< Updated upstream
      const error = await tweetResponse.json();
      console.error('Tweet error:', error);
      return NextResponse.json({ success: false, error: 'Failed to post tweet' }, { status: 500 });
=======
      const errorData = await tweetResponse.text();
      console.error('Twitter API error response:', errorData);
      
      // Try to parse the error response as JSON
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch {
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
>>>>>>> Stashed changes
    }

    const tweet = await tweetResponse.json();
    return NextResponse.json({ success: true, tweet });

  } catch (error) {
    console.error('Error posting tweet:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Delete all of this code below - it's causing the errors
// and is not needed since this logic is already in the generateOAuth1Header function