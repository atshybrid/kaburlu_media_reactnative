import { request } from './http';

export type CombinedLocationType = 'STATE' | 'DISTRICT' | 'ASSEMBLY' | 'MANDAL' | 'VILLAGE' | string;

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
  assemblyConstituency?: CombinedLocationMatch | null;
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

export type SmartAddLocationRequest = {
  areaName: string;
  languageCode?: string;
  forceType?: 'district' | 'mandal' | 'village' | 'town';
  stateId?: string;
  stateName?: string;
  parentDistrictName?: string;
  parentDistrictId?: string;
};

export type SmartAddLocationResponse = {
  success: boolean;
  type: 'mandal' | 'village' | 'town' | 'district' | 'state';
  location: {
    id: string;
    name: string;
    districtId?: string;
    stateId?: string;
    translations: Array<{
      id: string;
      language: string;
      name: string;
    }>;
    district?: {
      id: string;
      name: string;
      stateId: string;
    };
    state?: {
      id: string;
      name: string;
    };
  };
  translation?: {
    id: string;
    language: string;
    name: string;
  };
  aiDetected: boolean;
};

/**
 * Smart add location - creates location immediately with AI assistance
 * Returns the created location that can be used right away
 */
export async function smartAddLocation(
  params: SmartAddLocationRequest
): Promise<SmartAddLocationResponse> {
  return await request<SmartAddLocationResponse>('/location/smart-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

/**
 * Search for districts by name
 */
export async function searchDistricts(
  query: string,
  stateId?: string,
  limit = 20
): Promise<SearchCombinedLocationsResponse> {
  const sp = new URLSearchParams();
  sp.set('q', query);
  sp.set('limit', String(limit));
  sp.set('type', 'DISTRICT');
  if (stateId) sp.set('stateId', stateId);
  
  try {
    return await request<SearchCombinedLocationsResponse>(`/locations/search-combined?${sp.toString()}`);
  } catch (e: any) {
    if (e?.status === 404) {
      return { q: query, count: 0, items: [] };
    }
    throw e;
  }
}
