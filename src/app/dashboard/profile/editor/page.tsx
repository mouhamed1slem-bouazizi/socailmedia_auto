'use client';

import { ProfileEditor } from '@/components/profile/ProfileEditor';

export default function ProfileEditorPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>
      <ProfileEditor />
    </div>
  );
}