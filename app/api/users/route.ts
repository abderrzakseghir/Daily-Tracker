import { NextRequest, NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import { User, ApiResponse } from '@/types';

const BLOB_PREFIX = 'daily-tracker/users';

// GET user by id
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `${BLOB_PREFIX}/${userId}`,
    });

    if (blobs.length === 0) {
      return NextResponse.json<ApiResponse<User | null>>({
        success: true,
        data: null,
      });
    }

    const response = await fetch(blobs[0].url);
    const user = await response.json();

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch user',
    }, { status: 500 });
  }
}

// POST create new user
export async function POST(request: NextRequest) {
  try {
    const user: User = await request.json();

    if (!user.id || !user.name || !user.pin) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'id, name, and pin are required',
      }, { status: 400 });
    }

    const blob = await put(
      `${BLOB_PREFIX}/${user.id}.json`,
      JSON.stringify(user),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      }
    );

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: { ...user, pin: undefined } as unknown as User,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to create user',
    }, { status: 500 });
  }
}

// PUT update user
export async function PUT(request: NextRequest) {
  try {
    const user: User = await request.json();

    if (!user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'id is required',
      }, { status: 400 });
    }

    const blob = await put(
      `${BLOB_PREFIX}/${user.id}.json`,
      JSON.stringify(user),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      }
    );

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: { ...user, pin: undefined } as unknown as User,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to update user',
    }, { status: 500 });
  }
}
