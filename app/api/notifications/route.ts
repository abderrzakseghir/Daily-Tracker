import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { ApiResponse } from '@/types';

// Set VAPID details (in production, use environment variables)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@dailytracker.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const { subscription, title, body, icon } = await request.json();

    if (!subscription || !title) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'subscription and title are required',
      }, { status: 400 });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: '/',
      },
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to send notification',
    }, { status: 500 });
  }
}

// GET VAPID public key
export async function GET() {
  return NextResponse.json<ApiResponse<string>>({
    success: true,
    data: VAPID_PUBLIC_KEY,
  });
}
