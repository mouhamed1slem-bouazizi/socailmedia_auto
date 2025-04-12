import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const text = formData.get('text') as string;
    const userId = formData.get('userId') as string;
    const media = formData.get('media') as File | null;
    const mediaType = formData.get('mediaType') as string | null;

    if (!text || !userId || !media) {
      return NextResponse.json(
        { error: 'Missing required fields. Instagram posts require text, userId, and media' },
        { status: 400 }
      );
    }

    console.log('Instagram post request received:', {
      userId,
      textLength: text.length,
      hasMedia: !!media,
      mediaType
    });

    // Get user's Instagram credentials from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();

    if (!userData?.instagramAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Instagram account not connected' },
        { status: 401 }
      );
    }

    const accessToken = userData.instagramAccount.accessToken;
    
    try {
      // Upload media to Instagram
      const mediaId = await uploadMediaToInstagram(media, text, accessToken, mediaType || 'image');
      
      // Create a container if needed and publish the post
      const postResult = await publishInstagramPost(mediaId, text, accessToken);
      
      return NextResponse.json(postResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('OAuthException') || errorMessage.includes('permissions')) {
        return NextResponse.json(
          { 
            error: 'Instagram API permission error', 
            details: 'Your Instagram app does not have the necessary permissions to post content.',
            technicalDetails: errorMessage
          },
          { status: 403 }
        );
      }
      
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error posting to Instagram:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to Instagram' },
      { status: 500 }
    );
  }
}

async function uploadMediaToInstagram(media: File, caption: string, accessToken: string, mediaType: string) {
  // For now, this is a placeholder implementation
  // In a real implementation, you would:
  // 1. Upload the media to a temporary URL
  // 2. Use the Instagram Graph API to create a media container
  
  console.log('Uploading media to Instagram:', {
    fileName: media.name,
    fileSize: media.size,
    mediaType
  });
  
  // This is a mock implementation - in reality, you would implement the actual Instagram API calls
  // Return a mock media ID for now
  return 'mock_media_id_' + Date.now();
}

async function publishInstagramPost(mediaId: string, caption: string, accessToken: string) {
  // This is a placeholder implementation
  // In a real implementation, you would use the Instagram Graph API to publish the post
  
  console.log('Publishing Instagram post with media ID:', mediaId, {
    captionLength: caption.length,
    hasAccessToken: !!accessToken
  });
  
  // In a real implementation, you would make an API call like:
  // const response = await fetch(`https://graph.instagram.com/me/media_publish?media_id=${mediaId}&caption=${encodeURIComponent(caption)}`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`
  //   }
  // });
  
  // Return a mock response for now
  return {
    id: 'instagram_post_' + Date.now(),
    created: new Date().toISOString(),
    status: 'POSTED'
  };
}