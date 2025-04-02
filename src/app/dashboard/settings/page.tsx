'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/core/Button';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [twitterAccount, setTwitterAccount] = useState({
    username: '',
    profileImage: '',
    accessToken: '',
    refreshToken: ''
  });

  useEffect(() => {
    if (user) {
      fetchTwitterAccount();
    }
  }, [user]);

  const fetchTwitterAccount = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const data = userDoc.data();
      if (data?.twitterAccount) {
        setTwitterAccount(data.twitterAccount);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error fetching Twitter account:', error);
    }
  };

  const handleTwitterConnect = async () => {
    try {
      const response = await fetch('/api/auth/twitter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to initialize Twitter connection');
      }
  
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting Twitter:', error);
      // Handle error appropriately
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-6">Twitter Integration</h2>
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
              onClick={() => setIsConnected(false)}
              variant="outline"
              className="mt-4"
            >
              Disconnect Account
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