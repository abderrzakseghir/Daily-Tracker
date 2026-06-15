import { NextRequest, NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import { DailyEntry, ApiResponse } from '@/types';

const BLOB_PREFIX = 'daily-tracker/entries';

// GET all entries or specific entry
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (!userId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `${BLOB_PREFIX}/${userId}/`,
    });

    if (date) {
      // Get specific entry
      const blob = blobs.find((b) => b.pathname.includes(date));
      
      if (!blob) {
        return NextResponse.json<ApiResponse<DailyEntry | null>>({
          success: true,
          data: null,
        });
      }

      const response = await fetch(blob.url);
      const entry = await response.json();

      return NextResponse.json<ApiResponse<DailyEntry>>({
        success: true,
        data: entry,
      });
    }

    // Get all entries
    const entries: DailyEntry[] = await Promise.all(
      blobs.map(async (blob) => {
        const response = await fetch(blob.url);
        return response.json();
      })
    );

    return NextResponse.json<ApiResponse<DailyEntry[]>>({
      success: true,
      data: entries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch entries',
    }, { status: 500 });
  }
}

// POST create new entry
export async function POST(request: NextRequest) {
  try {
    const entry: DailyEntry = await request.json();

    if (!entry.userId || !entry.date) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and date are required',
      }, { status: 400 });
    }

    const blob = await put(
      `${BLOB_PREFIX}/${entry.userId}/${entry.date}.json`,
      JSON.stringify(entry),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      }
    );

    return NextResponse.json<ApiResponse<DailyEntry>>({
      success: true,
      data: entry,
      message: 'Entry created successfully',
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to create entry',
    }, { status: 500 });
  }
}

// PUT update entry
export async function PUT(request: NextRequest) {
  try {
    const entry: DailyEntry = await request.json();

    if (!entry.userId || !entry.date) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and date are required',
      }, { status: 400 });
    }

    const blob = await put(
      `${BLOB_PREFIX}/${entry.userId}/${entry.date}.json`,
      JSON.stringify(entry),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      }
    );

    return NextResponse.json<ApiResponse<DailyEntry>>({
      success: true,
      data: entry,
      message: 'Entry updated successfully',
    });
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to update entry',
    }, { status: 500 });
  }
}

// DELETE entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (!userId || !date) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and date are required',
      }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `${BLOB_PREFIX}/${userId}/${date}`,
    });

    if (blobs.length > 0) {
      await del(blobs[0].url);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting entry:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to delete entry',
    }, { status: 500 });
  }
}
