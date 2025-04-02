'use client';

import { SignupForm } from '@/components/auth/SignupForm';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-500">
              sign in to your account
            </Link>
          </p>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-md">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}