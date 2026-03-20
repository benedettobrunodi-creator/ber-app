import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://api.ber-app.com.br';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface SocketEvents {
  join_room: (roomId: string) => void;
  leave_room: (roomId: string) => void;
  message: (payload: SendMessagePayload) => void;
  new_message: (message: IncomingMessage) => void;
  typing: (payload: TypingPayload) => void;
  read: (payload: ReadPayload) => void;
}

export interface SendMessagePayload {
  roomId: string;
  body: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

export interface IncomingMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  readBy: string[];
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface TypingPayload {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface ReadPayload {
  roomId: string;
  messageIds: string[];
}

// ---------------------------------------------------------------------------
// Socket management
// ---------------------------------------------------------------------------

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: {
      token,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function joinRoom(roomId: string): void {
  socket?.emit('join_room', roomId);
}

export function leaveRoom(roomId: string): void {
  socket?.emit('leave_room', roomId);
}

export function sendSocketMessage(payload: SendMessagePayload): void {
  socket?.emit('message', payload);
}

export function emitTyping(payload: TypingPayload): void {
  socket?.emit('typing', payload);
}

export function emitRead(payload: ReadPayload): void {
  socket?.emit('read', payload);
}
