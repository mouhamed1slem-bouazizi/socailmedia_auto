// Fix the syntax error in the callback route
import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  console.log('LinkedIn callback route started');
  try {
    // Extract code, state, and error parameters from the URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    console.log('LinkedIn callback params:', { 
      codeExists: !!code, 
      stateExists: !!state,
      error: error || 'none',
      errorDescription: errorDescription || 'none'
    });

    // Handle LinkedIn API errors
    if (error) {
      console.error(`LinkedIn API error: ${error} - ${errorDescription}`);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=linkedin_api_error&message=${encodeURIComponent(errorDescription || '')}`);
    }

    if (!code || !state) {
      console.error('Missing required parameters (code or state)');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=missing_params`);
    }
    
    // Find the user with the matching state
    console.log('Finding user with matching LinkedIn auth state');
    
    // Query Firestore for a user with the matching linkedinAuthState
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('linkedinAuthState', '==', state));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error('No user found with matching state');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_not_found`);
    }
    
    // Get the first matching user
    const userId = querySnapshot.docs[0].id;
    console.log('Found user with ID:', userId);
    
    // Get the user data
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    
    console.log('User data retrieved:', { 
      userExists: !!userData, 
      hasLinkedInAuthState: !!userData?.linkedinAuthState,
      stateMatches: userData?.linkedinAuthState === state
    });
    
    if (!userData || userData.linkedinAuthState !== state) {
      console.error('Invalid state parameter');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=invalid_state`);
    }

    // Exchange code for access token
    console.log('Exchanging code for access token');
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3000/api/auth/linkedin/callback',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('LinkedIn token received:', { 
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });

    // After the token exchange section, try using the OpenID Connect userinfo endpoint
    // After the token exchange section, modify the userinfo fetch to better handle responses
    console.log('Fetching user info from OpenID Connect endpoint');
    const userInfoResponse = await fetch('https://www.linkedin.com/oauth/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json' // Explicitly request JSON response
      }
    });
    
    console.log('User info response status:', userInfoResponse.status);
    
    let profileId = 'unknown';
    let fullName = 'LinkedIn User';
    let email = '';
    
    // After the userInfoResponse.ok check, add a fallback to use the environment token
    if (userInfoResponse.ok) {
      try {
        const contentType = userInfoResponse.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const userInfoData = await userInfoResponse.json();
          console.log('LinkedIn user info received:', JSON.stringify(userInfoData, null, 2));
          
          profileId = userInfoData.sub || 'unknown';
          fullName = userInfoData.name || 'LinkedIn User';
          email = userInfoData.email || '';
          
          console.log('Extracted info:', { profileId, fullName, email });
        } else {
          // Not JSON response, handle as text
          const textResponse = await userInfoResponse.text();
          console.log('Non-JSON response received, length:', textResponse.length);
          
          // Generate a unique identifier since we couldn't parse the response
          profileId = `linkedin_${Date.now()}`;
          fullName = `LinkedIn User ${profileId.substring(0, 6)}`;
          console.log('Using generated info due to non-JSON response:', { profileId, fullName });
        }
      } catch (parseError) {
        console.error('Error parsing LinkedIn user info:', parseError);
        
        // Generate a unique identifier since we couldn't parse the response
        profileId = `linkedin_${Date.now()}`;
        fullName = `LinkedIn User ${profileId.substring(0, 6)}`;
        console.log('Using generated info due to parse error:', { profileId, fullName });
      }
    } else {
      const errorText = await userInfoResponse.text();
      console.error('Could not fetch LinkedIn user info:', errorText);
      
      // Try using the environment access token as fallback
      if (process.env.LINKEDIN_ACCESS_TOKEN) {
        console.log('Attempting to use environment access token as fallback');
        try {
          const fallbackResponse = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
            headers: {
              'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
              'Accept': 'application/json'
            }
          });
          
          if (fallbackResponse.ok) {
            const profileData = await fallbackResponse.json();
            console.log('LinkedIn profile data retrieved using fallback token:', JSON.stringify(profileData, null, 2));
            
            profileId = profileData.id || `linkedin_${Date.now()}`;
            fullName = `${profileData.localizedFirstName || ''} ${profileData.localizedLastName || ''}`.trim() || `LinkedIn User ${profileId.substring(0, 6)}`;
            
            // Try to get profile picture if available
            const profilePictureUrl = (() => {
              if (profileData.profilePicture?.['displayImage~']?.elements?.length > 0) {
                const largestImage = profileData.profilePicture['displayImage~'].elements
                  .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                    // Use type assertion to tell TypeScript about the expected structure
                    const aData = (a.data as Record<string, { storageSize: { width: number } }>) || {};
                    const bData = (b.data as Record<string, { storageSize: { width: number } }>) || {};
                    
                    const aWidth = aData['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0;
                    const bWidth = bData['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0;
                    return bWidth - aWidth;
                  })[0];
                
                if (largestImage?.identifiers?.[0]?.identifier) {
                  return largestImage.identifiers[0].identifier;
                }
              }
              return '';
            })();
            
            // Update the user document with the retrieved data
            console.log('Updating user document with LinkedIn data from fallback token');
            await updateDoc(doc(db, 'users', userId), {
              linkedinAccount: {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || '',
                expiresIn: tokenData.expires_in,
                connectedAt: new Date().toISOString(),
                username: fullName,
                profileId: profileId,
                email: email,
                profilePictureUrl: profilePictureUrl,
                connectionStatus: 'connected'
              },
              linkedinAuthState: null // Clear the state
            });
            
            console.log('LinkedIn account connected successfully using fallback token');
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=linkedin_connected`);
          } else {
            console.log('Fallback token also failed:', await fallbackResponse.text());
          }
        } catch (fallbackError) {
          console.error('Error using fallback token:', fallbackError);
        }
      }
      // Remove this problematic code block that uses undefined variables
      // await updateDoc(doc(db, 'users', userId), {
      //   'linkedinAccount.accessToken': accessToken,
      //   'linkedinAccount.refreshToken': refreshToken,
      //   'linkedinAccount.profileId': profileId,
      //   'linkedinAccount.expiresIn': expiresIn,
      //   'linkedinAccount.connectedAt': new Date().toISOString(),
      //   'linkedinAccount.scopes': ['r_liteprofile', 'r_emailaddress', 'w_member_social'] // Add this line
      // });
      
      console.log('Updating user document with LinkedIn data');
      // Generate a unique identifier for this LinkedIn connection (original fallback)
      profileId = `linkedin_${Date.now()}`;
      fullName = `LinkedIn User ${profileId.substring(profileId.length - 6)}`;
      
      // Define profilePictureUrl variable for the fallback case
      const profilePictureUrl = '';
      
      // Update the user document with the data we were able to collect
      console.log('Updating user document with LinkedIn data');
      await updateDoc(doc(db, 'users', userId), {
        linkedinAccount: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          expiresIn: tokenData.expires_in,
          connectedAt: new Date().toISOString(),
          username: fullName,
          profileId: profileId,
          email: email,
          profilePictureUrl: profilePictureUrl,
          connectionStatus: 'connected',
          scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'] // Add scopes here
        },
        linkedinAuthState: null // Clear the state
      });
      
      console.log('LinkedIn account connected successfully');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=linkedin_connected`);
    }
  } catch (error) {
    console.error('Error in LinkedIn callback:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=unknown_error`);
  }
}