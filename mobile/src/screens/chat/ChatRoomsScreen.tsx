import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/types';
import { getChatRooms, ChatRoom, ChatRoomType } from '../../services/chat';
import { Header } from '../../components/Header';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatRooms'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOM_TYPE_LABELS: Record<ChatRoomType, string> = {
  obra: 'Obra',
  group: 'Grupo',
  direct: 'DM',
};

const ROOM_TYPE_COLORS: Record<ChatRoomType, string> = {
  obra: colors.secondary.darkTeal,
  group: colors.primary.olive,
  direct: colors.secondary.warmGray,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (diffDays === 1) {
    return 'Ontem';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatRoomsScreen({ navigation }: Props) {
  const {
    data: rooms = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: getChatRooms,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePress = useCallback(
    (room: ChatRoom) => {
      navigation.navigate('Conversation', {
        roomId: room.id,
        roomName: room.name,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRoom }) => {
      const hasUnread = (item.unreadCount ?? 0) > 0;

      return (
        <TouchableOpacity
          style={styles.roomItem}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          <Avatar name={item.name} size={48} />

          <View style={styles.roomContent}>
            <View style={styles.roomTopRow}>
              <View style={styles.roomNameRow}>
                <Text
                  style={[styles.roomName, hasUnread && styles.roomNameBold]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Badge
                  label={ROOM_TYPE_LABELS[item.type]}
                  color={ROOM_TYPE_COLORS[item.type]}
                  size="sm"
                />
              </View>
              {item.lastMessage && (
                <Text style={styles.roomTime}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              )}
            </View>

            <View style={styles.roomBottomRow}>
              <Text
                style={[
                  styles.lastMessage,
                  hasUnread && styles.lastMessageUnread,
                ]}
                numberOfLines={1}
              >
                {item.lastMessage?.body ?? 'Nenhuma mensagem ainda'}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount! > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handlePress],
  );

  const keyExtractor = useCallback((item: ChatRoom) => item.id, []);

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  // ── Loading ────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Chat" />
        <Loading message="Carregando conversas..." />
      </View>
    );
  }

  // ── Error ──────────────────────────────────────
  if (isError) {
    return (
      <View style={styles.container}>
        <Header title="Chat" />
        <EmptyState
          title="Erro ao carregar"
          message="Nao foi possivel carregar as conversas."
          actionLabel="Tentar novamente"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Chat" />

      <FlatList
        data={rooms}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={
          rooms.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.olive}
            colors={[colors.primary.olive]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma conversa"
            message="Voce ainda nao participa de nenhuma conversa."
          />
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  listContent: {
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
  },

  // Room item
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  roomContent: {
    flex: 1,
  },
  roomTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.sm,
  },
  roomName: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.primary.charcoal,
    flexShrink: 1,
  },
  roomNameBold: {
    fontFamily: typography.fonts.semiBold,
  },
  roomTime: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
  roomBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.secondary.warmGray,
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMessageUnread: {
    color: colors.primary.charcoal,
    fontFamily: typography.fonts.semiBold,
  },

  // Unread badge
  unreadBadge: {
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs + 2,
  },
  unreadText: {
    fontFamily: typography.fonts.bold,
    fontSize: 11,
    color: colors.secondary.white,
  },

  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 48 + spacing.md, // avatar width + gaps
  },
});
