import { request } from './http';

export type CombinedLocationType = 'STATE' | 'DISTRICT' | 'MANDAL' | 'VILLAGE' | string;

export type CombinedLocationMatch = {
  id: string;
  name: string;
  names?: Record<string, string>;
};

export type CombinedLocationItem = {
  type: CombinedLocationType;
  match: CombinedLocationMatch;
  state: CombinedLocationMatch | null;
  district: CombinedLocationMatch | null;
  mandal: CombinedLocationMatch | null;
  village: CombinedLocationMatch | null;
};

export type SearchCombinedLocationsResponse = {
  q: string;
  count: number;
  tenant?: {
    id?: string;
    name?: string;
    nativeName?: string;
    languageCode?: string;
  };
  items: CombinedLocationItem[];
};

export async function searchCombinedLocations(q: string, limit = 20, tenantId?: string): Promise<SearchCombinedLocationsResponse> {
  const sp = new URLSearchParams();
  sp.set('q', q);
  sp.set('limit', String(limit));
  if (tenantId) sp.set('tenantId', String(tenantId));
  
  try {
    return await request<SearchCombinedLocationsResponse>(`/locations/search-combined?${sp.toString()}`);
  } catch (e: any) {
    // Handle 404 gracefully - location not found, return empty results
    if (e?.status === 404) {
      console.log('[Locations] No results found for:', q);
      return {
        q,
        count: 0,
        items: [],
      };
    }
    // Re-throw other errors
    throw e;
  }
}

/**
 * Request to add a new location to the database
 * This creates a request for admin to review and add the location
 */
export async function requestAddLocation(
  placeName: string,
  tenantId: string,
  languageCode?: string
): Promise<{ success: boolean; message?: string }> {
  return await request<{ success: boolean; message?: string }>('/locations/request-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placeName,
      tenantId,
      languageCode: languageCode || 'te',
    }),
  });
}
