import { request } from './http';

export type CombinedLocationType = 'STATE' | 'DISTRICT' | 'MANDAL' | 'VILLAGE' | string;

export type CombinedLocationMatch = { id: string; name: string };

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
  items: CombinedLocationItem[];
};

export async function searchCombinedLocations(q: string, limit = 20): Promise<SearchCombinedLocationsResponse> {
  const sp = new URLSearchParams();
  sp.set('q', q);
  sp.set('limit', String(limit));
  return await request<SearchCombinedLocationsResponse>(`/locations/search-combined?${sp.toString()}`);
}
