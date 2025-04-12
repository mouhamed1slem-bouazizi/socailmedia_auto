'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/core/Button';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

// Define interfaces for better type safety
interface TwitterAccountData {
  username: string;
  profileImage: string;
  accessToken: string;
  refreshToken: string;
  connectedAt?: string;
}

interface LinkedInAccountData {
  username: string;
  profileImage: string;
  accessToken: string;
  refreshToken: string;
  connectedAt?: string;
  profilePictureUrl?: string;
}

interface InstagramAccountData {
  username: string;
  profileImage: string;
  accessToken: string;
  connectedAt?: string;
}

interface UserData {
  twitterAccount?: TwitterAccountData;
  linkedinAccount?: LinkedInAccountData;
  instagramAccount?: InstagramAccountData;
  [key: string]: unknown;
}


export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  // State variables
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [isTwitterConnected, setIsTwitterConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [twitterAccount, setTwitterAccount] = useState<TwitterAccountData>({
    username: '',
    profileImage: '',
    accessToken: '',
    refreshToken: ''
  });

  // Add a useEffect to fetch user data when the component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;
      
      try {
        setIsLoading(true);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data() as UserData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  // Twitter connection verification
  const verifyTwitterConnection = useCallback(async (twitterData: TwitterAccountData) => {
    if (!twitterData) return false;
    
    return (
      twitterData.accessToken &&
      twitterData.refreshToken &&
      twitterData.connectedAt &&
      new Date(twitterData.connectedAt).getTime() > 0
    );
  }, []);

  // Fetch Twitter account data
  const fetchTwitterAccount = useCallback(async () => {
    try {
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const data = userDoc.data() as UserData | undefined;
      
      if (data?.twitterAccount) {
        const isValid = await verifyTwitterConnection(data.twitterAccount);
        
        if (isValid) {
          setTwitterAccount({
            username: data.twitterAccount.username || '',
            profileImage: data.twitterAccount.profileImage || '',
            accessToken: data.twitterAccount.accessToken || '',
            refreshToken: data.twitterAccount.refreshToken || ''
          });
          setIsTwitterConnected(true);
          return;
        }
      }
      
      setIsTwitterConnected(false);
      setTwitterAccount({
        username: '',
        profileImage: '',
        accessToken: '',
        refreshToken: ''
      });
    } catch (error) {
      console.error('Error fetching Twitter account:', error);
      setIsTwitterConnected(false);
    }
  }, [user, verifyTwitterConnection]);

  // LinkedIn connection verification
  const verifyLinkedInConnection = useCallback(async (linkedinData: LinkedInAccountData) => {
    if (!linkedinData) return false;
    
    return (
      linkedinData.accessToken &&
      linkedinData.refreshToken &&
      linkedinData.connectedAt &&
      new Date(linkedinData.connectedAt).getTime() > 0
    );
  }, []);

  // Fetch LinkedIn account data
  const fetchLinkedInAccount = useCallback(async () => {
    try {
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const data = userDoc.data() as UserData | undefined;
      
      if (data?.linkedinAccount) {
        const isValid = await verifyLinkedInConnection(data.linkedinAccount);
        
        if (isValid) {
          // Update userData directly
          setUserData(data);
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching LinkedIn account:', error);
    }
  }, [user, verifyLinkedInConnection]);

  // Fetch accounts on component mount
  useEffect(() => {
    if (user) {
      fetchTwitterAccount();
      fetchLinkedInAccount();
    }
  }, [user, fetchTwitterAccount, fetchLinkedInAccount]);

  // Check for Twitter OAuth callback
  useEffect(() => {
    const checkTwitterConnection = async () => {
      if (window.location.search.includes('oauth_token')) {
        await fetchTwitterAccount();
      }
    };
    
    checkTwitterConnection();
  }, [fetchTwitterAccount]);

  // Check for LinkedIn OAuth callback
  useEffect(() => {
    const checkLinkedInConnection = async () => {
      if (window.location.search.includes('code') && window.location.search.includes('state')) {
        try {
          setLoading(true);
          setError('');
          
          // Extract the code and state from the URL
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const state = urlParams.get('state');
          
          if (!code || !state || !user) {
            throw new Error('Missing required parameters');
          }
          
          // Call the LinkedIn callback API
          const response = await fetch(`/api/auth/linkedin?code=${code}&state=${state}&userId=${user.uid}`, {
            method: 'GET'
          });
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to complete LinkedIn authentication');
          }
          
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Fetch the updated LinkedIn account
          await fetchLinkedInAccount();
          
        } catch (error: unknown) {
          console.error('LinkedIn callback error:', error);
          if (error instanceof Error) {
            setError(error.message || 'Failed to connect LinkedIn account');
          } else {
            setError('Failed to connect LinkedIn account');
          }
        } finally {
          setLoading(false);
        }
      }
    };
    
    if (user) {
      checkLinkedInConnection();
    }
  }, [user, fetchLinkedInAccount]);

  // Check Instagram connection status
  useEffect(() => {
    if (userData?.instagramAccount?.accessToken) {
      setIsInstagramConnected(true);
    } else {
      setIsInstagramConnected(false);
    }
  }, [userData]);

  // Handler functions
  const handleTwitterConnect = async () => {
    try {
      setTwitterLoading(true);
      setError('');
      
      const response = await fetch('/api/auth/twitter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user!.uid
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to initialize Twitter connection');
      }
  
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting Twitter:', error);
      setError('Failed to connect to Twitter. Please try again.');
    } finally {
      setTwitterLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      setError('');
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleDisconnectTwitter = async () => {
    try {
      setTwitterLoading(true);
      await updateDoc(doc(db, 'users', user!.uid), {
        twitterAccount: {
          accessToken: '',
          refreshToken: '',
          connectedAt: '',
          profileImage: '',
          username: ''
        }
      });
      setIsTwitterConnected(false);
      setTwitterAccount({
        username: '',
        profileImage: '',
        accessToken: '',
        refreshToken: ''
      });
    } catch (error) {
      console.error('Error disconnecting Twitter:', error);
      setError('Failed to disconnect Twitter account');
    } finally {
      setTwitterLoading(false);
    }
  };

  const handleLinkedInConnect = async () => {
    try {
      setLinkedinLoading(true);
      setError('');
      
      const response = await fetch('/api/auth/linkedin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user!.uid
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to initialize LinkedIn connection');
      }
  
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
      setError('Failed to connect to LinkedIn. Please try again.');
    } finally {
      setLinkedinLoading(false);
    }
  };
  
  const handleDisconnectLinkedIn = async () => {
    try {
      setLinkedinLoading(true);
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('/api/auth/linkedin/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect LinkedIn account');
      }
      
      setUserData((prev) => {
        if (!prev) return null;
        const newData = { ...prev };
        if ('linkedinAccount' in newData) {
          delete newData.linkedinAccount;
        }
        return newData;
      });
      
      setError('LinkedIn account disconnected successfully');
      
    } catch (error) {
      console.error('Error disconnecting LinkedIn account:', error);
      setError('Failed to disconnect LinkedIn account');
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleInstagramConnect = async () => {
    try {
      setInstagramLoading(true);
      setError('');
      
      console.log('Initializing Instagram connection...');
      
      const response = await fetch('/api/auth/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user!.uid
        }
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Instagram connection error:', errorData);
        throw new Error(errorData.error || 'Failed to initialize Instagram connection');
      }
    
      const data = await response.json();
      console.log('Redirecting to Instagram auth URL...');
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting Instagram:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Instagram. Please try again.');
    } finally {
      setInstagramLoading(false);
    }
  };
  
  const handleDisconnectInstagram = async () => {
    try {
      setInstagramLoading(true);
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      await updateDoc(doc(db, 'users', user.uid), {
        instagramAccount: {
          accessToken: '',
          connectedAt: '',
          profileImage: '',
          username: ''
        }
      });
      
      setIsInstagramConnected(false);
      setUserData((prev) => {
        if (!prev) return null;
        const newData = { ...prev };
        if ('instagramAccount' in newData) {
          delete newData.instagramAccount;
        }
        return newData;
      });
      
    } catch (error) {
      console.error('Error disconnecting Instagram account:', error);
      setError('Failed to disconnect Instagram account');
    } finally {
      setInstagramLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-6">Twitter Integration</h2>
        {isTwitterConnected ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {twitterAccount.profileImage && (
                <div className="relative w-12 h-12">
                  <Image 
                    src={twitterAccount.profileImage} 
                    alt="Twitter Profile" 
                    className="rounded-full"
                    width={48}
                    height={48}
                  />
                </div>
              )}
              <div>
                <p className="font-medium">@{twitterAccount.username}</p>
                <p className="text-sm text-green-600">Connected</p>
              </div>
            </div>
            <Button
              onClick={handleDisconnectTwitter}
              variant="outline"
              className="mt-4"
              disabled={twitterLoading}
            >
              {twitterLoading ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleTwitterConnect}
              disabled={twitterLoading}
              className="w-full"
            >
              {twitterLoading ? 'Connecting...' : 'Connect with Twitter'}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-6">LinkedIn Integration</h2>
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : userData?.linkedinAccount?.accessToken ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {userData.linkedinAccount.profilePictureUrl ? (
                <div className="relative w-12 h-12">
                  <Image 
                    src={userData.linkedinAccount.profilePictureUrl} 
                    alt="LinkedIn Profile" 
                    className="rounded-full"
                    width={48}
                    height={48}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-blue-100 flex items-center justify-center rounded-full">
                  <span className="text-blue-600 font-bold">in</span>
                </div>
              )}
              <div>
                <p className="font-medium">{userData.linkedinAccount.username}</p>
                <p className="text-sm text-green-600">Connected</p>
              </div>
            </div>
            <Button
              onClick={handleDisconnectLinkedIn}
              variant="outline"
              className="mt-4"
              disabled={linkedinLoading}
            >
              {linkedinLoading ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleLinkedInConnect}
              disabled={linkedinLoading}
              className="w-full"
            >
              {linkedinLoading ? 'Connecting...' : 'Connect with LinkedIn'}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-6">Instagram Integration</h2>
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
          </div>
        ) : isInstagramConnected ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {userData?.instagramAccount?.profileImage ? (
                <div className="relative w-12 h-12">
                  <Image 
                    src={userData.instagramAccount.profileImage} 
                    alt="Instagram Profile" 
                    className="rounded-full"
                    width={48}
                    height={48}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center rounded-full">
                  <span className="text-white font-bold">IG</span>
                </div>
              )}
              <div>
                <p className="font-medium">@{userData?.instagramAccount?.username}</p>
                <p className="text-sm text-green-600">Connected</p>
              </div>
            </div>
            <Button
              onClick={handleDisconnectInstagram}
              variant="outline"
              className="mt-4"
              disabled={instagramLoading}
            >
              {instagramLoading ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleInstagramConnect}
              disabled={instagramLoading}
              className="w-full"
            >
              {instagramLoading ? 'Connecting...' : 'Connect with Instagram'}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-6">Account Settings</h2>
        <div className="space-y-4">
          <div className="pt-6 border-t">
            <Button
              variant="primary"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              {logoutLoading ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}