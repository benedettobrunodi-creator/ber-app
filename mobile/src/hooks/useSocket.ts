import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore, ChatMessage } from '../stores/chatStore';

const SOCKET_URL = 'https://api.ber-app.com.br';

// ──────────────────────────────────────────────
// Socket event payloads
// ──────────────────────────────────────────────

interface TypingPayload {
  roomId: string;
  userId: string;
}

interface OnlineUsersPayload {
  userIds: string[];
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const addMessage = useChatStore((s) => s.addMessage);
  const addTypingUser = useChatStore((s) => s.addTypingUser);
  const removeTypingUser = useChatStore((s) => s.removeTypingUser);
  const setOnlineUsers = useChatStore((s) => s.setOnlineUsers);

  // ── Connect / Disconnect ──────────────────
  useEffect(() => {
    if (!token) {
      // No token – make sure we're disconnected
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // ── Chat events ──
    socket.on('new_message', (message: ChatMessage) => {
      addMessage(message);
    });

    socket.on('typing', (payload: TypingPayload) => {
      addTypingUser(payload.roomId, payload.userId);

      // Auto-clear typing indicator after 3 seconds
      setTimeout(() => {
        removeTypingUser(payload.roomId, payload.userId);
      }, 3000);
    });

    socket.on('stop_typing', (payload: TypingPayload) => {
      removeTypingUser(payload.roomId, payload.userId);
    });

    socket.on('online_users', (payload: OnlineUsersPayload) => {
      setOnlineUsers(payload.userIds);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, addMessage, addTypingUser, removeTypingUser, setOnlineUsers]);

  // ── Room management ───────────────────────

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('join_room', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave_room', { roomId });
  }, []);

  // ── Messaging ─────────────────────────────

  const sendMessage = useCallback((roomId: string, body: string) => {
    socketRef.current?.emit('send_message', { roomId, body });
  }, []);

  const emitTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing', { roomId });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    emitTyping,
  } as const;
}
