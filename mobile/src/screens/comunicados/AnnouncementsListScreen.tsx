import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComunicadosStackParamList } from '../../navigation/types';
import {
  getAnnouncements,
  Announcement,
  AnnouncementCategory,
} from '../../services/announcements';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<ComunicadosStackParamList, 'AnnouncementsList'>;

type FilterOption = 'todos' | AnnouncementCategory;

interface FilterPill {
  key: FilterOption;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: FilterPill[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'urgente', label: 'Urgente' },
  { key: 'informativo', label: 'Informativo' },
  { key: 'rh', label: 'RH' },
  { key: 'obra', label: 'Obra' },
];

const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  urgente: colors.support.error,
  informativo: colors.info,
  rh: colors.secondary.darkTeal,
  obra: colors.primary.olive,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnouncementsListScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('todos');

  // ── Data fetching ──────────────────────────────
  const {
    data: announcements = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['announcements'],
    queryFn: getAnnouncements,
  });

  // ── Filtering & sorting ────────────────────────
  const filteredAnnouncements = useMemo(() => {
    let list =
      activeFilter === 'todos'
        ? announcements
        : announcements.filter((a) => a.category === activeFilter);

    // Pinned first, then most recent
    list = [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [announcements, activeFilter]);

  // ── Callbacks ──────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePress = useCallback(
    (id: string) => {
      navigation.navigate('AnnouncementDetail', { announcementId: id });
    },
    [navigation],
  );

  // ── Render helpers ─────────────────────────────
  const renderFilterPill = useCallback(
    (pill: FilterPill) => {
      const isActive = activeFilter === pill.key;
      return (
        <TouchableOpacity
          key={pill.key}
          style={[styles.pill, isActive && styles.pillActive]}
          onPress={() => setActiveFilter(pill.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
            {pill.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [activeFilter],
  );

  const renderItem = useCallback(
    ({ item }: { item: Announcement }) => {
      const categoryColor = CATEGORY_COLORS[item.category] ?? colors.secondary.warmGray;

      return (
        <Card
          style={styles.card}
          onPress={() => handlePress(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              {item.pinned && (
                <Text style={styles.pinIcon}>{'📌'}</Text>
              )}
              <Badge
                label={item.category.toUpperCase()}
                color={categoryColor}
                size="sm"
              />
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={styles.cardBody} numberOfLines={2}>
            {item.body}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardAuthor}>
              {item.author?.name ?? 'Autor desconhecido'}
            </Text>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </Card>
      );
    },
    [handlePress],
  );

  const keyExtractor = useCallback((item: Announcement) => item.id, []);

  // ── Main render ────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Comunicados" />
        <Loading message="Carregando comunicados..." />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Header title="Comunicados" />
        <EmptyState
          title="Erro ao carregar"
          message="Nao foi possivel carregar os comunicados. Tente novamente."
          actionLabel="Tentar novamente"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Comunicados" />

      {/* Filter pills */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTER_OPTIONS.map(renderFilterPill)}
        </ScrollView>
      </View>

      {/* Announcements list */}
      <FlatList
        data={filteredAnnouncements}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          filteredAnnouncements.length === 0
            ? styles.emptyContainer
            : styles.listContent
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
            title="Nenhum comunicado"
            message="Nao ha comunicados para a categoria selecionada."
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

  // Filters
  filtersWrapper: {
    backgroundColor: colors.secondary.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary.sage,
  },
  pillActive: {
    backgroundColor: colors.primary.olive,
  },
  pillText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.secondary.warmGray,
  },
  pillTextActive: {
    color: colors.secondary.white,
  },

  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
  },

  // Card
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pinIcon: {
    fontSize: 14,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.olive,
  },
  cardTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.primary.charcoal,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardAuthor: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.darkTeal,
  },
  cardDate: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
});
