import { DailyEntry, User, ApiResponse } from '@/types';

const API_BASE = '/api';

class ApiService {
  // Entries
  async getEntries(userId: string): Promise<DailyEntry[]> {
    const response = await fetch(`${API_BASE}/entries?userId=${userId}`);
    const data: ApiResponse<DailyEntry[]> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch entries');
    }
    
    return data.data || [];
  }

  async getEntry(userId: string, date: string): Promise<DailyEntry | null> {
    const response = await fetch(`${API_BASE}/entries?userId=${userId}&date=${date}`);
    const data: ApiResponse<DailyEntry | null> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch entry');
    }
    
    return data.data || null;
  }

  async createEntry(entry: DailyEntry): Promise<DailyEntry> {
    const response = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data: ApiResponse<DailyEntry> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create entry');
    }
    
    return data.data!;
  }

  async updateEntry(entry: DailyEntry): Promise<DailyEntry> {
    const response = await fetch(`${API_BASE}/entries`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data: ApiResponse<DailyEntry> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update entry');
    }
    
    return data.data!;
  }

  async deleteEntry(userId: string, date: string): Promise<void> {
    const response = await fetch(`${API_BASE}/entries?userId=${userId}&date=${date}`, {
      method: 'DELETE',
    });
    const data: ApiResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete entry');
    }
  }

  // Users
  async getUser(userId: string): Promise<User | null> {
    const response = await fetch(`${API_BASE}/users?userId=${userId}`);
    const data: ApiResponse<User | null> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch user');
    }
    
    return data.data || null;
  }

  async createUser(user: User): Promise<User> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data: ApiResponse<User> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create user');
    }
    
    return data.data!;
  }

  async updateUser(user: User): Promise<User> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data: ApiResponse<User> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update user');
    }
    
    return data.data!;
  }

  // Notifications
  async sendNotification(
    subscription: PushSubscription,
    title: string,
    body?: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        title,
        body,
      }),
    });
    const data: ApiResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to send notification');
    }
  }

  async getVapidPublicKey(): Promise<string> {
    const response = await fetch(`${API_BASE}/notifications`);
    const data: ApiResponse<string> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get VAPID key');
    }
    
    return data.data || '';
  }
}

export const apiService = new ApiService();
