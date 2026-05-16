export interface Profile {
  id: string;
  user_id?: string;
  uuid: string;
  display_name: string;
  age: number;
  gender: string;
  bio: string;
  avatar_url: string | null;
  avatar_urls: string[];
  avatar_x: number;
  avatar_y: number;
  banner_url: string | null;
  banner_urls: string[];
  banner_x: number;
  banner_y: number;
  location: string;
  looking_for: string;
  interests: string[];
  compatibility_score: number;
  online_status: boolean;
  type: "human" | "ai";
}
