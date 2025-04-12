import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Add a function to refresh LinkedIn access token
async function refreshLinkedInToken(refreshToken: string) {
  console.log('Attempting to refresh LinkedIn token');
  
  try {
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to refresh LinkedIn token:', errorText);
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('LinkedIn token refreshed successfully');
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
      expiresIn: tokenData.expires_in
    };
  } catch (error) {
    console.error('Error refreshing LinkedIn token:', error);
    throw error;
  }
}

// Add a function to get a fresh LinkedIn access token
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getFreshLinkedInToken() {
  console.log('Getting fresh LinkedIn access token');
  
  try {
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get fresh LinkedIn token:', errorText);
      throw new Error(`Token acquisition failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Fresh LinkedIn token acquired successfully');
    
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting fresh LinkedIn token:', error);
    throw error;
  }
}

// Then modify your POST function to use this fresh token
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const text = formData.get('text') as string;
    const userId = formData.get('userId') as string;
    const media = formData.get('media') as File | null;
    const mediaType = formData.get('mediaType') as string | null;

    if (!text || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('LinkedIn post request received:', {
      userId,
      textLength: text.length,
      hasMedia: !!media,
      mediaType
    });

    // Get user's LinkedIn credentials from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();

    if (!userData?.linkedinAccount?.accessToken) {
      return NextResponse.json(
        { error: 'LinkedIn account not connected' },
        { status: 401 }
      );
    }

    // Try to get a fresh application token first
    let accessToken;
    try {
      // Since application tokens aren't working, let's skip this step for now
      // and directly use the user token
      throw new Error('Skipping application token - using user token directly');
    } catch { 
      console.log('Using user token for LinkedIn post');
      // Fall back to user token if we can't get a fresh one
      accessToken = userData.linkedinAccount.accessToken;
      let refreshToken = userData.linkedinAccount.refreshToken;
      
      // Check if we have the necessary scopes
      const scopes = userData.linkedinAccount.scopes || [];
      console.log('LinkedIn account scopes:', scopes);
      
      // Check if scopes array is empty or doesn't include the required scope
      if (!scopes.length) {
        console.error('No LinkedIn scopes found in user account. This likely means the scopes were not saved during authentication.');
        
        // Check if we need to update the auth URL to include the right scopes
        const redirectUri = process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT_URI || '';
        const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
          process.env.LINKEDIN_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=${encodeURIComponent(
          'r_liteprofile r_emailaddress w_member_social'
        )}&state=${userId}`;
        
        return NextResponse.json(
          { 
            error: 'LinkedIn permission error', 
            details: 'Your LinkedIn connection is missing the required permissions to post content. Please reconnect your account.',
            code: 'MISSING_SCOPES',
            reconnectUrl: linkedInAuthUrl
          },
          { status: 403 }
        );
      }
      
      if (!scopes.includes('w_member_social')) {
        console.error('Missing required LinkedIn scope: w_member_social. Available scopes:', scopes.join(', '));
        
        // Same auth URL as above
        const redirectUri = process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT_URI || '';
        const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
          process.env.LINKEDIN_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=${encodeURIComponent(
          'r_liteprofile r_emailaddress w_member_social'
        )}&state=${userId}`;
        
        return NextResponse.json(
          { 
            error: 'LinkedIn permission error', 
            details: 'Your LinkedIn connection is missing the w_member_social permission required to post content. Please reconnect your account.',
            code: 'MISSING_SCOPE',
            requiredScope: 'w_member_social',
            reconnectUrl: linkedInAuthUrl
          },
          { status: 403 }
        );
      }
      
      const tokenExpiry = userData.linkedinAccount.expiresIn ? 
        new Date(userData.linkedinAccount.connectedAt).getTime() + (userData.linkedinAccount.expiresIn * 1000) : 
        null;
      
      // Check if token is expired or about to expire (within 5 minutes)
      const isTokenExpired = tokenExpiry && (Date.now() > (tokenExpiry - 5 * 60 * 1000));
      
      // If token is expired and we have a refresh token, try to refresh it
      if (isTokenExpired && refreshToken) {
        console.log('LinkedIn token expired or about to expire, attempting to refresh');
        try {
          // Refresh the token
          const newTokenData = await refreshLinkedInToken(refreshToken);
          
          // Update the tokens
          accessToken = newTokenData.accessToken;
          refreshToken = newTokenData.refreshToken;
          
          // Log the new access token for debugging
          console.log('New LinkedIn access token received:', accessToken.substring(0, 10) + '...');
          console.log('Token expires in:', newTokenData.expiresIn, 'seconds');
          
          // Update the user document with new token information
          await updateDoc(doc(db, 'users', userId), {
            'linkedinAccount.accessToken': accessToken,
            'linkedinAccount.refreshToken': refreshToken,
            'linkedinAccount.expiresIn': newTokenData.expiresIn,
            'linkedinAccount.connectedAt': new Date().toISOString()
          });
          
          console.log('Updated user document with new LinkedIn tokens');
        } catch (refreshError) {
          console.error('Error refreshing LinkedIn token:', refreshError);
          return NextResponse.json(
            { 
              error: 'LinkedIn session expired', 
              details: 'Your LinkedIn session has expired and we could not refresh it. Please reconnect your LinkedIn account.',
              code: 'TOKEN_REFRESH_FAILED'
            },
            { status: 401 }
          );
        }
      }

      const profileId = userData.linkedinAccount.profileId;
      
      // Log the access token being used for the API call
      console.log('Using LinkedIn access token for post:', accessToken.substring(0, 10) + '...');
      console.log('Using profile ID:', profileId);
      console.log('LinkedIn scopes needed: w_member_social');
      
      // For media uploads
      const mediaUrl = null;
      if (media) {
        // Media handling would go here
      }
      
      try {
        // Use the LinkedIn Share API with the fresh or refreshed token
        const postResult = await shareOnLinkedIn(text, mediaUrl, accessToken, profileId);
        return NextResponse.json(postResult);
      } catch (error) {
        // Check if the error is related to token revocation
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('revoked') || errorMessage.includes('invalid_token') || 
            errorMessage.includes('expired') || errorMessage.includes('401')) {
          return NextResponse.json(
            { 
              error: 'LinkedIn authentication error', 
              details: 'Your LinkedIn session has expired. Please reconnect your LinkedIn account.',
              code: 'TOKEN_REVOKED',
              technicalDetails: errorMessage
            },
            { status: 401 }
          );
        } else if (errorMessage.includes('ACCESS_DENIED') || errorMessage.includes('permissions') || 
                  errorMessage.includes('ugcPosts.CREATE.NO_VERSION')) {
          // This is likely a LinkedIn Developer App permission issue
          return NextResponse.json(
            { 
              error: 'LinkedIn API permission error', 
              details: 'Your LinkedIn Developer App does not have the necessary permissions to post content. Please check your LinkedIn Developer App settings and ensure it has the "Share on LinkedIn" and "Post, Comment & React" product permissions enabled.',
              code: 'APP_PERMISSION_ERROR',
              technicalDetails: errorMessage
            },
            { status: 403 }
          );
        }
        
        // For other errors
        throw error;
      }
    }
  } catch (error: unknown) {
    console.error('Error posting to LinkedIn:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to LinkedIn' },
      { status: 500 }
    );
  }
} // End of POST function

// Updated function that uses the stored profile ID instead of fetching it
async function shareOnLinkedIn(text: string, mediaUrl: string | null, accessToken: string, profileId: string) {
  console.log('Sharing on LinkedIn using UGC Posts API', { textLength: text.length, hasMedia: !!mediaUrl, profileId });
  
  try {
    // Extract the actual ID if it has a linkedin_ prefix
    const cleanProfileId = profileId.startsWith('linkedin_') ? profileId.split('_')[1] : profileId;
    console.log('Clean profile ID for LinkedIn API:', cleanProfileId);
    
    // Use the UGC Posts API directly since it's working in Postman
    const ugcPostData = {
      author: `urn:li:person:${cleanProfileId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: text
          },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };
    
    console.log('Sending LinkedIn UGC Posts API request with data:', JSON.stringify(ugcPostData, null, 2));
    
    // Add the LinkedIn-Version header which is required for some API calls
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);
    headers.append("Content-Type", "application/json");
    headers.append("X-Restli-Protocol-Version", "2.0.0");
    headers.append("LinkedIn-Version", "202401"); // must be string, exactly this

    
    console.log('Using LinkedIn API headers:', Object.fromEntries(headers.entries()));
    
    // Try using the Share API endpoint as a fallback if the UGC Posts API fails
    let response;
    let responseText;
    
    try {
      // First try the UGC Posts API - USE ugcPostData instead of postPayload
      response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers,
        body: JSON.stringify(ugcPostData)
      });
      
      responseText = await response.text();
      console.log('LinkedIn UGC Posts API response:', response.status, responseText);
      
      // If we get a permissions error, try the Share API as fallback
      if (response.status === 403 && responseText.includes('ugcPosts.CREATE.NO_VERSION')) {
        console.log('UGC Posts API failed due to permissions, trying Share API as fallback');
        
        // Construct the Share API request
        const shareData = {
          content: {
            contentEntities: [],
            title: '',
            description: '',
            shareText: text
          },
          distribution: {
            linkedInDistributionTarget: {}
          },
          owner: `urn:li:person:${cleanProfileId}`,
          subject: '',
          text: { text: text }
        };
        
        console.log("Final LinkedIn Headers:", Object.fromEntries(headers.entries()));
        console.log("LinkedIn Payload:", JSON.stringify(ugcPostData, null, 2));
        // Try the Share API
        response = await fetch('https://api.linkedin.com/v2/shares', {
          method: 'POST',
          headers,
          body: JSON.stringify(shareData)
        });
        
        responseText = await response.text();
        console.log('LinkedIn Share API fallback response:', response.status, responseText);
      }
    } catch (apiError) {
      console.error('LinkedIn API request failed:', apiError);
      const errorMessage = apiError instanceof Error 
        ? apiError.message 
        : 'Unknown API error';
      throw new Error(`LinkedIn API request failed: ${errorMessage}`);
    }
    
    if (!response.ok) {
      let errorMessage = `LinkedIn API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorMessage;
        
        // Add more specific error handling for common LinkedIn API errors
        if (errorMessage.includes('ugcPosts.CREATE.NO_VERSION')) {
          throw new Error('Your LinkedIn Developer App does not have the necessary product permissions. Please add the "Share on LinkedIn" and "Post, Comment & React" products to your app in the LinkedIn Developer Portal.');
        }
      } catch {
        // Use underscore to indicate intentionally unused parameter
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { id: 'unknown', raw: responseText };
    }
    
    console.log('LinkedIn post created successfully:', result);
    
    return {
      id: result.id || 'unknown',
      created: new Date().toISOString(),
      status: 'POSTED'
    };
  } catch (error) {
    console.error('Error sharing on LinkedIn:', error);
    throw error;
  }
}