import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Remove LinkedIn account information from the user's document
    await updateDoc(doc(db, 'users', userId), {
      linkedinAccount: null
    });
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error disconnecting LinkedIn account:', error);
    return NextResponse.json({ error: 'Failed to disconnect LinkedIn account' }, { status: 500 });
  }
}