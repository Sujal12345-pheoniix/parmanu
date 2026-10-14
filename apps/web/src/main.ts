// Parmanu Client Core Scripts
console.log('Parmanu Web UI initialized');

export interface StoryItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  category: string;
  url: string;
}

// Function to fetch live feed from Parmanu API if available
export async function fetchLiveFeed(): Promise<StoryItem[]> {
  try {
    const res = await fetch('/api/v1/feed');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    return data.stories || [];
  } catch (err) {
    console.debug('API offline or unreachable, using verified cache', err);
    return [];
  }
}
