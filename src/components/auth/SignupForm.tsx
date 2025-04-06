'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Input } from '@/components/ui/core/Input';
import { Button } from '@/components/ui/core/Button';
import { useAuth } from '@/contexts/AuthContext';

export function SignupForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [error, setError] = useState('');  // Add error state
  const [loading, setLoading] = useState(false);  // Add loading state
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      // Create authentication user
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const userId = userCredential.user.uid;

      // Save user data to Firestore
      await setDoc(doc(db, 'users', userId), {
        id: userId,
        email: formData.email,
        displayName: formData.displayName,
        photoURL: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        twitterAccount: {
          accessToken: '',
          refreshToken: '',
          connectedAt: '',
          profileImage: ''
        },
        tweets: []
      });

      router.push('/dashboard');
    } catch (err) {
      setError('Failed to create an account');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md">{error}</div>
      )}
      <Input
        label="Display Name"
        type="text"
        value={formData.displayName}
        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
        required
      />
      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <Input
        label="Password"
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />
      <Input
        label="Confirm Password"
        type="password"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
        required
      />
      <Button 
        type="submit" 
        variant="primary" 
        className="w-full"
        disabled={loading}
      >
        {loading ? 'Creating Account...' : 'Sign Up'}
      </Button>
    </form>
  );
}