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
  // Replace imageUrl state with file states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
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

  const postTweet = async (text: string, image?: File) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('userId', user.uid);
      
      // Add image to formData if provided
      if (image) {
        console.log('Attaching image to tweet:', image.name);
        formData.append('image', image);
      }

      console.log('Sending tweet request with text:', text);
      
      const response = await fetch('/api/twitter/tweet', {
        method: 'POST',
        body: formData
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Twitter API error response:', responseData);
        
        if (response.status === 401) {
          throw new Error('Twitter authentication failed. Please reconnect your account in settings.');
        }
        
        if (response.status === 403 && responseData.detail?.includes('duplicate content')) {
          throw new Error('Cannot post duplicate tweet. Please modify your content.');
        }
        
        throw new Error(responseData.error || responseData.detail || `Failed to post tweet (${response.status})`);
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
      // Pass the image file if it exists
      const result = await postTweet(newTweet, imageFile);
      console.log('Post result from Twitter API:', result);
      
      // Get existing tweets or initialize empty array
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const existingTweets = userDoc.data()?.twitterAccount?.tweets || [];
  
      // Save to Firebase with flexible ID extraction to handle different API response formats
      const userRef = doc(db, 'users', user!.uid);
      const tweetId = result?.data?.id || result?.id_str || result?.id || 'unknown';
      
      await updateDoc(userRef, {
        'twitterAccount.tweets': [{
          content: newTweet,
          createdAt: new Date().toISOString(),
          status: 'posted',
          tweetId: tweetId,
          hasImage: !!imageFile
        }, ...existingTweets]
      });
      
      setImageFile(null);
      setImagePreview('');
      setNewTweet('');
      alert('Tweet posted successfully!');
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Failed to post tweet. Please try again.';
      
      if (error.message?.includes('access level')) {
        errorMessage = 'Your Twitter API access level does not allow posting tweets. Please upgrade your Twitter developer account.';
      } else if (error.message?.includes('authentication')) {
        errorMessage = 'Twitter authentication failed. Please reconnect your account in settings.';
      } else if (error.message?.includes('duplicate content')) {
        errorMessage = 'Cannot post duplicate tweet. Please modify your content.';
      } else if (error.message?.includes('Failed to upload image')) {
        errorMessage = 'Failed to upload image. Please try a different image or post without an image.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
    setPosting(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
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
              <Input
                label="Tweet Content"
                value={newTweet}
                onChange={(e) => setNewTweet(e.target.value)}
                maxLength={280}
                placeholder="What's happening?"
                multiline="true"
              />
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-block px-4 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                >
                  Choose Image
                </label>
                {imagePreview && (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="rounded-lg max-h-48 object-cover"
                    />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                )}
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