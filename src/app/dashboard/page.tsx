'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/core/Card';
import { Button } from '@/components/ui/core/Button';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex space-x-4">
          <Link href="/dashboard/settings">
            <Button variant="outline">Settings</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-2">Total Posts</h3>
          <p className="text-3xl font-bold">24</p>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-2">Engagement Rate</h3>
          <p className="text-3xl font-bold">4.5%</p>
        </div>
        <div className="bg-purple-500 text-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-2">Total Followers</h3>
          <p className="text-3xl font-bold">1,234</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((post) => (
              <div key={post} className="border-b pb-4">
                <h3 className="font-medium">Post Title {post}</h3>
                <p className="text-gray-600 text-sm">Posted 2 days ago</p>
                <div className="flex space-x-4 mt-2 text-sm text-gray-500">
                  <span>👍 24 Likes</span>
                  <span>💬 8 Comments</span>
                  <span>🔄 12 Shares</span>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">View All Posts</Button>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Schedule</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((schedule) => (
              <div key={schedule} className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-medium">Scheduled Post {schedule}</h3>
                  <p className="text-gray-600 text-sm">Tomorrow at 10:00 AM</p>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">View Calendar</Button>
        </Card>
      </div>
    </div>
  );
}