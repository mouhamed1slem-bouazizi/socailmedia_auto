import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Twitter tokens from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    
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
      const error = await tweetResponse.json();
      console.error('Tweet error:', error);
      return NextResponse.json({ success: false, error: 'Failed to post tweet' }, { status: 500 });
    }

    const tweet = await tweetResponse.json();
    return NextResponse.json({ success: true, tweet });

  } catch (error) {
    console.error('Error posting tweet:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}