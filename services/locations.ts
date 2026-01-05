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
  return await request<SearchCombinedLocationsResponse>(`/locations/search-combined?${sp.toString()}`);
}
