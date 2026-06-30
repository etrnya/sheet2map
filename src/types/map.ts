export interface MapConfig {
  map_id: string;
  site_mode: 'public' | 'hub';
  theme_color: string;
  icon: string;
  default_zoom: number;
  show_directory: boolean;
  enable_gps: boolean;
  enable_share: boolean;
  enable_favorites: boolean;
  enable_cross_search: boolean;
}

export interface MapMetadata {
  title: string;
  description?: string;
  category: string;
  source_name: string;
  source_url: string;
  source_date: string;
  imported_at: string;
  maintainer?: string;
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  address?: string;
  district?: string;
  phone?: string;
  website?: string;
  description?: string;
  image?: string;
  opening_hours?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface MapDataPayload {
  success: boolean;
  config: MapConfig;
  metadata: MapMetadata;
  points: MapPoint[];
}
