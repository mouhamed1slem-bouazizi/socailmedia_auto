'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/core/Input';
import { Button } from '@/components/ui/core/Button';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TwitterAccount {
  username: string;
  accessToken: string;
  refreshToken: string;
  connectedAt: string;
  profileImage?: string;
}

export default function TwitterPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [twitterAccount, setTwitterAccount] = useState<TwitterAccount | null>(null);
  const [newTweet, setNewTweet] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (user) {
      checkFirestoreData(); // Add this line
      fetchTwitterAccount();
    }
  }, [user]);

  const checkFirestoreData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const data = userDoc.data();
      console.log('Full Firestore data:', data);
      console.log('Twitter account data structure:', {
        exists: userDoc.exists(),
        hasTwitterAccount: !!data?.twitterAccount,
        twitterData: data?.twitterAccount || null
      });
    } catch (error) {
      console.error('Error checking Firestore data:', error);
    }
  };

  const fetchTwitterAccount = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const data = userDoc.data();
      
      if (data?.twitterAccount?.accessToken) {
        console.log('Found Twitter account with access token');
        setTwitterAccount({
          username: data.twitterAccount.username,
          accessToken: data.twitterAccount.accessToken,
          refreshToken: data.twitterAccount.refreshToken,
          connectedAt: data.twitterAccount.connectedAt,
          profileImage: data.twitterAccount.profileImage
        });
      } else {
        console.log('No valid Twitter account found:', {
          hasData: !!data,
          hasTwitterAccount: !!data?.twitterAccount,
          hasAccessToken: !!data?.twitterAccount?.accessToken
        });
        setTwitterAccount(null);
      }
    } catch (error) {
      console.error('Error fetching Twitter account:', error);
      setTwitterAccount(null);
    }
    setLoading(false);
  };

  const postTweet = async (text: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const response = await fetch('/api/twitter/tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'Authorization': `Bearer ${twitterAccount?.accessToken}`
        },
        body: JSON.stringify({ text })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Twitter authentication expired. Please reconnect your account in settings.');
        }
        
        if (response.status === 403 && responseData.detail?.includes('duplicate content')) {
          throw new Error('Cannot post duplicate tweet. Please modify your content.');
        }
        
        throw new Error(responseData.detail || responseData.error || `Failed to post tweet (${response.status})`);
      }
      
      return responseData;
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      throw error;
    }
  };

  const handlePostTweet = async () => {
    if (!twitterAccount || !newTweet.trim()) return;
    
    setPosting(true);
    try {
      const result = await postTweet(newTweet);
      console.log('Post result:', result); // Debug log
      
      // Get existing tweets or initialize empty array
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const existingTweets = userDoc.data()?.twitterAccount?.tweets || [];
  
      // Save to Firebase with safe access to ID
      const userRef = doc(db, 'users', user!.uid);
      await updateDoc(userRef, {
        'twitterAccount.tweets': [{
          content: newTweet,
          createdAt: new Date().toISOString(),
          status: 'posted',
          tweetId: result?.id || result?.data?.id || 'unknown' // Handle different response structures
        }, ...existingTweets]
      });
      
      setNewTweet('');
      alert('Tweet posted successfully!');
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      alert(error.message || 'Failed to post tweet. Please try again.');
    }
    setPosting(false);
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">X Twitter Management</h1>
      
      {twitterAccount ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Connected Account</h2>
            <p className="text-gray-600">@{twitterAccount.username}</p>
            <p className="text-sm text-gray-500">
              Connected since: {new Date(twitterAccount.connectedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Post New Tweet</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tweet Content
                </label>
                <textarea
                  value={newTweet}
                  onChange={(e) => setNewTweet(e.target.value)}
                  maxLength={280}
                  placeholder="What's happening?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {newTweet.length}/280 characters
                </span>
                <Button
                  onClick={handlePostTweet}
                  disabled={posting || !newTweet.trim()}
                >
                  {posting ? 'Posting...' : 'Post Tweet'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">No Twitter Account Connected</h2>
          <p className="text-gray-600 mb-4">
            Please connect your Twitter account in the settings to start managing your tweets.
          </p>
          <Button onClick={() => window.location.href = '/dashboard/settings'}>
            Go to Settings
          </Button>
        </div>
      )}
    </div>
  );
}