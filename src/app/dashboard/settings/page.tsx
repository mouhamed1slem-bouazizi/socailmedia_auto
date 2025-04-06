'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/core/Button';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [twitterAccount, setTwitterAccount] = useState({
    username: '',
    profileImage: '',
    accessToken: '',
    refreshToken: ''
  });

  const verifyTwitterConnection = async (twitterData: any) => {
    if (!twitterData) return false;
    
    return (
      twitterData.accessToken &&
      twitterData.refreshToken &&
      twitterData.connectedAt &&
      new Date(twitterData.connectedAt).getTime() > 0
    );
  };

  const fetchTwitterAccount = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const data = userDoc.data();
      
      if (data?.twitterAccount) {
        const isValid = await verifyTwitterConnection(data.twitterAccount);
        
        if (isValid) {
          setTwitterAccount({
            username: data.twitterAccount.username || '',
            profileImage: data.twitterAccount.profileImage || '',
            accessToken: data.twitterAccount.accessToken || '',
            refreshToken: data.twitterAccount.refreshToken || ''
          });
          setIsConnected(true);
          return;
        }
      }
      
      setIsConnected(false);
      setTwitterAccount({
        username: '',
        profileImage: '',
        accessToken: '',
        refreshToken: ''
      });
    } catch (error) {
      console.error('Error fetching Twitter account:', error);
      setIsConnected(false);
    }
  };

  // Add this useEffect to refetch when the component mounts and after connection
  useEffect(() => {
    if (user) {
      fetchTwitterAccount();
    }
  }, [user]);

  // Update handleTwitterConnect to refetch after redirect
  useEffect(() => {
    const checkTwitterConnection = async () => {
      if (window.location.search.includes('oauth_token')) {
        await fetchTwitterAccount();
      }
    };
    
    checkTwitterConnection();
  }, []);

  const handleTwitterConnect = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
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
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectTwitter = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user!.uid), {
        twitterAccount: {
          accessToken: '',
          refreshToken: '',
          connectedAt: '',
          profileImage: '',
          username: ''
        }
      });
      setIsConnected(false);
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
      setLoading(false);
    }
  };

  // Update the return JSX to show error message
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-6">Twitter Integration</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {twitterAccount.profileImage && (
                <img 
                  src={twitterAccount.profileImage} 
                  alt="Twitter Profile" 
                  className="w-12 h-12 rounded-full"
                />
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
              disabled={loading}
            >
              {loading ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleTwitterConnect}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Connecting...' : 'Connect with Twitter'}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-6">Account Settings</h2>
        <div className="space-y-4">
          <div className="pt-6 border-t">
            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}