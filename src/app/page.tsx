'use client';

import { Button } from '@/components/ui/core/Button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-end space-x-4 mb-8">
        {user ? (
          <>
            <Link href="/dashboard/profile">
              <Button variant="outline">Profile</Button>
            </Link>
            <Link href="/dashboard/settings">
              <Button variant="outline">Account Settings</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary">Dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary">Sign Up</Button>
            </Link>
          </>
        )}
      </div>
      <h1 className="text-4xl font-bold mb-8">
        Social Media Management Platform
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Analytics Dashboard</h2>
          <p className="text-gray-600">
            View your social media performance metrics
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Content Calendar</h2>
          <p className="text-gray-600">
            Schedule and manage your social media posts
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Account Management</h2>
          <p className="text-gray-600">
            Connect and manage your social media accounts
          </p>
        </div>
      </div>
    </div>
  );
}
