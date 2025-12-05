export type ScreenType = 'home' | 'chat' | 'info';

// Mapeia a tabela 'messages' do Supabase
export interface Message {
  id: number | string; // Robustez para bigint/uuid
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  is_read: boolean;
  type?: 'text' | 'image'; 
  reactions?: { [userId: string]: string } | null;
}

// Mapeia a tabela 'profilesMSP'
export interface Profile {
  id: string; // uuid
  email: string;
  username: string;
  avatar_url: string;
}

export interface ChatSession {
  id: string; 
  contact: Profile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}