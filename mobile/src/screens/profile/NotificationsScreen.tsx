import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PerfilStackParamList } from '../../navigation/types';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  Notification,
} from '../../services/notifications';
import { useNotificationStore } from '../../stores/notificationStore';
import { Header } from '../../components/Header';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<PerfilStackParamList, 'Notifications'>;

const NOTIFICATIONS_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const decrementUnread = useNotificationStore((s) => s.decrementUnread);

  // ── Data fetching (paginated) ──────────────────
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = 1 }) => {
      return getNotifications({
        page: pageParam,
        limit: NOTIFICATIONS_PER_PAGE,
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const notifications = data?.pages.flatMap((page) => page.data) ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  // ── Mutations ──────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      decrementUnread();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // ── Callbacks ──────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  const handlePress = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        markReadMutation.mutate(notification.id);
      }
      // Navigate based on notification data if applicable
      // For now, just mark as read
    },
    [markReadMutation],
  );

  // ── Render helpers ─────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const isUnread = !item.read;

      return (
        <TouchableOpacity
          style={[styles.notificationItem, isUnread && styles.notificationUnread]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          {isUnread && <View style={styles.unreadAccent} />}

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text
                style={[
                  styles.notificationTitle,
                  isUnread && styles.notificationTitleBold,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>

            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handlePress],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary.olive} />
      </View>
    );
  }, [isFetchingNextPage]);

  // ── Loading ────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Notificacoes" onBack={() => navigation.goBack()} />
        <Loading message="Carregando notificacoes..." />
      </View>
    );
  }

  // ── Error ──────────────────────────────────────
  if (isError) {
    return (
      <View style={styles.container}>
        <Header title="Notificacoes" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Erro ao carregar"
          message="Nao foi possivel carregar as notificacoes."
          actionLabel="Tentar novamente"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Notificacoes" onBack={() => navigation.goBack()} />

      {/* Mark all as read */}
      {hasUnread && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllRead}
          disabled={markAllReadMutation.isPending}
          activeOpacity={0.7}
        >
          {markAllReadMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary.olive} />
          ) : (
            <Text style={styles.markAllText}>Marcar todas como lidas</Text>
          )}
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.olive}
            colors={[colors.primary.olive]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState
            title="Sem notificacoes"
            message="Voce nao possui notificacoes no momento."
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

  // Mark all button
  markAllButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  markAllText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },

  // Notification item
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary.white,
  },
  notificationUnread: {
    backgroundColor: '#FAFDF0', // very subtle olive tint
  },
  unreadAccent: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primary.olive,
    marginRight: spacing.sm,
    alignSelf: 'stretch',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.primary.charcoal,
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTitleBold: {
    fontFamily: typography.fonts.semiBold,
  },
  notificationTime: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
  notificationBody: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.secondary.warmGray,
    lineHeight: 19,
  },

  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
