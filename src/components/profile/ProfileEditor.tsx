'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/core/Input';
import { Button } from '@/components/ui/core/Button';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export function ProfileEditor() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    photoURL: user?.photoURL || '/images/default-avatar.png'
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        return;
      }
      
      setSelectedImage(file);
      const previewUrl = URL.createObjectURL(file);
      setProfile(prev => ({ ...prev, photoURL: previewUrl }));
    }
  };

  const uploadImage = async (file: File) => {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `profile-pictures/${user?.uid}/${fileName}`);
      
      // Add proper metadata
      const metadata = {
        contentType: file.type,
        cacheControl: 'public,max-age=7200'
      };
      
      // Upload with metadata
      await uploadBytes(storageRef, file, metadata);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: unknown) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (user) {
        let photoURL = profile.photoURL;
        
        if (selectedImage) {
          try {
            photoURL = await uploadImage(selectedImage);
          } catch {
            setMessage({ type: 'error', text: 'Failed to upload image. Profile update cancelled.' });
            setLoading(false);
            return;
          }
        }

        // Update Auth profile
        await updateProfile(user, {
          displayName: profile.displayName,
          photoURL
        });

        // Update Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          displayName: profile.displayName,
          email: user.email,
          photoURL,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => {
          router.push('/dashboard/profile');
        }, 1500);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {message.text && (
          <div className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-32 h-32">
            <Image
              src={profile.photoURL}
              alt="Profile"
              fill
              className="rounded-full object-cover"
              priority
              sizes="(max-width: 128px) 100vw, 128px"
            />
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Change Profile Picture
          </Button>
        </div>

        <div className="space-y-4">
          <Input
            label="Display Name"
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={profile.email}
            disabled
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}