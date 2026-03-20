import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/types';
import {
  getRoomMessages,
  sendMessage as sendMessageApi,
  ChatMessage,
} from '../../services/chat';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useSocket } from '../../hooks/useSocket';
import { Header } from '../../components/Header';
import { Avatar } from '../../components/Avatar';
import { Loading } from '../../components/Loading';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversation'>;

const MESSAGES_PER_PAGE = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationScreen({ route, navigation }: Props) {
  const { roomId, roomName } = route.params;

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // ── Stores ─────────────────────────────────────
  const currentUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const realtimeMessages = useChatStore((s) => s.messages);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);

  // ── Socket ─────────────────────────────────────
  const { joinRoom, leaveRoom, emitTyping } = useSocket(accessToken);

  useEffect(() => {
    setActiveRoom(roomId);
    joinRoom(roomId);

    return () => {
      leaveRoom(roomId);
      setActiveRoom(null);
    };
  }, [roomId, joinRoom, leaveRoom, setActiveRoom]);

  // ── Data fetching (paginated) ──────────────────
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['roomMessages', roomId],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await getRoomMessages(roomId, {
        page: pageParam,
        limit: MESSAGES_PER_PAGE,
      });
      return response;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  // ── Merge API messages with realtime messages ──
  const allMessages = useMemo(() => {
    const apiMessages: ChatMessage[] =
      data?.pages.flatMap((page) => page.data) ?? [];

    const realtimeRoomMessages = realtimeMessages.get(roomId) ?? [];

    // Merge, deduplicate by id, sort newest first (for inverted FlatList)
    const merged = new Map<string, ChatMessage>();
    for (const msg of apiMessages) {
      merged.set(msg.id, msg as any);
    }
    for (const msg of realtimeRoomMessages) {
      merged.set(msg.id, msg as any);
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data, realtimeMessages, roomId]);

  // ── Typing indicator ──────────────────────────
  const roomTypingUsers = typingUsers.get(roomId) ?? [];
  const isTyping =
    roomTypingUsers.length > 0 &&
    roomTypingUsers.some((uid) => uid !== currentUser?.id);

  // ── Callbacks ─────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      await sendMessageApi(roomId, trimmed);
    } catch {
      // Restore text on failure
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, roomId]);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (text.length > 0) {
        emitTyping(roomId);
      }
    },
    [emitTyping, roomId],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render helpers ────────────────────────────
  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMine = item.senderId === currentUser?.id;

      return (
        <View
          style={[
            styles.messageBubbleWrapper,
            isMine ? styles.messageMine : styles.messageTheirs,
          ]}
        >
          {!isMine && (
            <Avatar
              name={item.sender?.name ?? '?'}
              uri={item.sender?.avatarUrl ?? undefined}
              size={28}
            />
          )}
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            {!isMine && item.sender?.name && (
              <Text style={styles.senderName}>{item.sender.name}</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isMine ? styles.messageTextMine : styles.messageTextTheirs,
              ]}
            >
              {item.body}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.messageTimeMine : styles.messageTimeTheirs,
              ]}
            >
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [currentUser?.id],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary.olive} />
      </View>
    );
  }, [isFetchingNextPage]);

  // ── Loading state ─────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title={roomName} onBack={() => navigation.goBack()} />
        <Loading message="Carregando mensagens..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={roomName} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages list (inverted) */}
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>Alguem esta digitando...</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Digite uma mensagem..."
            placeholderTextColor={colors.secondary.warmGray}
            multiline
            maxLength={2000}
            editable={!isSending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.secondary.white} />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.sage,
  } as ViewStyle,

  keyboardAvoiding: {
    flex: 1,
  },

  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },

  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Message bubbles
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  messageMine: {
    justifyContent: 'flex-end',
  },
  messageTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  bubbleMine: {
    backgroundColor: colors.primary.olive,
    borderBottomRightRadius: spacing.xs,
  },
  bubbleTheirs: {
    backgroundColor: colors.secondary.white,
    borderBottomLeftRadius: spacing.xs,
  },
  senderName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.darkTeal,
    marginBottom: spacing.xs,
  },
  messageText: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextMine: {
    color: colors.secondary.white,
  },
  messageTextTheirs: {
    color: colors.primary.charcoal,
  },
  messageTime: {
    fontFamily: typography.fonts.regular,
    fontSize: 10,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageTimeTheirs: {
    color: colors.secondary.warmGray,
  },

  // Typing
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  typingText: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
    fontStyle: 'italic',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.secondary.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.primary.charcoal,
    backgroundColor: colors.secondary.sage,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.secondary.white,
  },
});
