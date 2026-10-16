/**
 * Parmanu Consumer Platform Centralized API Client
 * Provides strictly typed client-side methods for discovery, search, dossiers, and bookmarks.
 */

export interface SourceAttribution {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export interface SourceItemSummary {
  id: string;
  headline: string;
  excerpt?: string | null;
  canonicalUrl: string;
  publishedAt: string;
  provenanceState: string;
  source: SourceAttribution;
}

export interface StoryClaimEvidence {
  id: string;
  stance: 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXTUALIZES';
  quoteExcerpt?: string | null;
  sourceItem: {
    id: string;
    canonicalUrl: string;
    source: {
      name: string;
    };
  };
}

export interface StoryClaimSummary {
  id: string;
  claimText: string;
  claimType: string;
  verificationStatus: string;
  confidenceScore: number;
  evidenceRecords: StoryClaimEvidence[];
}

export interface AssociatedEntity {
  entity: {
    id: string;
    slug: string;
    canonicalName: string;
    entityType: string;
    isVerified: boolean;
  };
}

export interface StoryClusterDetail {
  id: string;
  clusterSlug: string;
  primaryHeadline: string;
  summary: string | null;
  category: string[];
  confidenceScore: number;
  itemCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  publishedAt?: string | null;
  status: string;
  correctionNotes?: string | null;
  items: Array<{
    sourceItem: SourceItemSummary;
  }>;
  claims?: StoryClaimSummary[];
  entityLinks?: AssociatedEntity[];
}

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

export interface SearchResultData {
  clusters: StoryClusterDetail[];
  entities: Array<{
    id: string;
    slug: string;
    canonicalName: string;
    entityType: string;
    isVerified: boolean;
  }>;
}

export interface BookmarkRecord {
  id: string;
  userId: string;
  sourceItemId?: string | null;
  storyClusterId?: string | null;
  createdAt: string;
  storyCluster?: StoryClusterDetail | null;
  sourceItem?: SourceItemSummary | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    requestId?: string;
    timestamp?: string;
  };
}

export class ParmanuApiClient {
  private static tokenKey = 'parmanu_auth_token';

  public static getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  public static setToken(token: string): void {
    try {
      localStorage.setItem(this.tokenKey, token);
    } catch {
      // ignore
    }
  }

  public static clearToken(): void {
    try {
      localStorage.removeItem(this.tokenKey);
    } catch {
      // ignore
    }
  }

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public static async fetchFeaturedStory(): Promise<StoryClusterDetail | null> {
    try {
      const res = await fetch('/api/v1/stories/featured', {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const json: ApiResponse<StoryClusterDetail> = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.error('Failed to fetch featured story', err);
      return null;
    }
  }

  public static async fetchTrendingStories(category?: string, limit = 10): Promise<StoryClusterDetail[]> {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'ALL') params.set('category', category);
      params.set('limit', String(limit));

      const res = await fetch(`/api/v1/stories/trending?${params.toString()}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const json: ApiResponse<StoryClusterDetail[]> = await res.json();
      return json.success ? json.data : [];
    } catch (err) {
      console.error('Failed to fetch trending stories', err);
      return [];
    }
  }

  public static async fetchStoryClusters(params: {
    category?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ clusters: StoryClusterDetail[]; total: number }> {
    try {
      const qs = new URLSearchParams();
      if (params.category && params.category !== 'ALL') qs.set('category', params.category);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.search) qs.set('search', params.search);

      const res = await fetch(`/api/v1/clusters?${qs.toString()}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return { clusters: [], total: 0 };
      const json = await res.json();
      return {
        clusters: json.data || [],
        total: json.meta?.total || 0,
      };
    } catch (err) {
      console.error('Failed to fetch story clusters', err);
      return { clusters: [], total: 0 };
    }
  }

  public static async fetchStoryDetail(id: string): Promise<StoryClusterDetail | null> {
    try {
      const res = await fetch(`/api/v1/clusters/${encodeURIComponent(id)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const json: ApiResponse<StoryClusterDetail> = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.error(`Failed to fetch story cluster ${id}`, err);
      return null;
    }
  }

  public static async fetchCategories(): Promise<CategorySummary[]> {
    try {
      const res = await fetch('/api/v1/categories', {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const json: ApiResponse<CategorySummary[]> = await res.json();
      return json.success ? json.data : [];
    } catch (err) {
      console.error('Failed to fetch categories', err);
      return [];
    }
  }

  public static async search(query: string, category?: string, page = 1): Promise<SearchResultData> {
    try {
      const qs = new URLSearchParams();
      qs.set('q', query);
      if (category && category !== 'ALL') qs.set('category', category);
      qs.set('page', String(page));

      const res = await fetch(`/api/v1/search?${qs.toString()}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return { clusters: [], entities: [] };
      const json: ApiResponse<SearchResultData> = await res.json();
      return json.success ? json.data : { clusters: [], entities: [] };
    } catch (err) {
      console.error('Failed to execute search', err);
      return { clusters: [], entities: [] };
    }
  }

  public static async fetchBookmarks(page = 1, limit = 20): Promise<{ bookmarks: BookmarkRecord[]; total: number }> {
    try {
      const res = await fetch(`/api/v1/bookmarks?page=${page}&limit=${limit}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return { bookmarks: [], total: 0 };
      const json: ApiResponse<BookmarkRecord[]> = await res.json();
      return {
        bookmarks: json.data || [],
        total: json.meta?.total || 0,
      };
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
      return { bookmarks: [], total: 0 };
    }
  }

  public static async checkBookmark(storyClusterId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/bookmarks/check/${encodeURIComponent(storyClusterId)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json?.data?.isBookmarked);
    } catch {
      return false;
    }
  }

  public static async saveBookmark(payload: { storyClusterId?: string; sourceItemId?: string }): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/bookmarks', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to save bookmark', err);
      return false;
    }
  }

  public static async removeBookmark(idOrTargetId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/bookmarks/${encodeURIComponent(idOrTargetId)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to remove bookmark', err);
      return false;
    }
  }

  public static async getCurrentUser(): Promise<any | null> {
    try {
      const token = this.getToken();
      if (!token) return null;
      const res = await fetch('/api/v1/auth/me', {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        this.clearToken();
        return null;
      }
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }
}
