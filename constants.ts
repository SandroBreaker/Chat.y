import { ChatSession, Profile } from './types';

export const CURRENT_USER_AVATAR = "https://picsum.photos/seed/me/200/200";

export const PARTNER: Profile = {
  id: 'c1',
  username: 'Amor ❤️',
  avatar_url: 'https://picsum.photos/seed/partner/200/200',
  email: 'partner@example.com'
};

export const GEMINI_BOT: Profile = {
  id: 'gemini-bot',
  username: 'Gemini AI ✨',
  avatar_url: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
  email: 'ai@google.com'
};

export const INITIAL_CHATS: ChatSession[] = [
  {
    id: '1',
    contact: PARTNER,
    lastMessage: 'Comprou o jantar?',
    lastMessageTime: '13:58',
    unreadCount: 1,
    messages: [
      { id: 1, content: 'Bom dia meu amor! ☀️', sender_id: 'c1', recipient_id: 'me', created_at: '08:30', is_read: true },
      { id: 2, content: 'Bom dia! Dormiu bem?', sender_id: 'me', recipient_id: 'c1', created_at: '08:32', is_read: true },
      { id: 3, content: 'Sim, sonhei com a gente.', sender_id: 'c1', recipient_id: 'me', created_at: '08:33', is_read: true },
      { id: 4, content: 'Vamos ao cinema hoje?', sender_id: 'me', recipient_id: 'c1', created_at: '11:15', is_read: true },
      { id: 5, content: 'Claro! Qual filme?', sender_id: 'c1', recipient_id: 'me', created_at: '11:20', is_read: true },
      { id: 6, content: 'Aquele novo de ficção científica.', sender_id: 'me', recipient_id: 'c1', created_at: '11:22', is_read: true },
      { id: 7, content: 'Combinado. Te amo!', sender_id: 'c1', recipient_id: 'me', created_at: '11:25', is_read: true },
      { id: 8, content: 'Também te amo muito ❤️', sender_id: 'me', recipient_id: 'c1', created_at: '11:25', is_read: true },
      { id: 9, content: 'Comprou o jantar?', sender_id: 'c1', recipient_id: 'me', created_at: '13:58', is_read: false }
    ]
  },
  {
    id: '2',
    contact: { id: 'c2', username: 'Mãe', avatar_url: 'https://picsum.photos/seed/mom/200/200', email: 'mom@example.com' },
    lastMessage: 'Vem almoçar domingo?',
    lastMessageTime: 'Ontem',
    unreadCount: 0,
    messages: []
  },
  {
    id: '3',
    contact: { id: 'c3', username: 'João Trabalho', avatar_url: 'https://picsum.photos/seed/joao/200/200', email: 'work@example.com' },
    lastMessage: 'O relatório já foi enviado.',
    lastMessageTime: 'Terça',
    unreadCount: 0,
    messages: []
  }
];

export const SUGGESTED_PHOTOS = [
  "https://picsum.photos/seed/img1/300/300",
  "https://picsum.photos/seed/img2/300/300",
  "https://picsum.photos/seed/img3/300/300",
  "https://picsum.photos/seed/img4/300/300",
  "https://picsum.photos/seed/img5/300/300",
  "https://picsum.photos/seed/img6/300/300",
];