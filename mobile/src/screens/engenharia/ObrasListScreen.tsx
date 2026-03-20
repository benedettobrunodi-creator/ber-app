import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EngenhariaStackParamList } from '../../navigation/types';
import { getObras, Obra, ObraStatus } from '../../services/obras';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<EngenhariaStackParamList, 'ObrasList'>;

type FilterOption = {
  key: ObraStatus | 'all';
  label: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS: FilterOption[] = [
  { key: 'all', label: 'Todos' },
  { key: 'em_andamento', label: 'Em Andamento' },
  { key: 'planejamento', label: 'Planejamento' },
  { key: 'pausada', label: 'Pausada' },
  { key: 'concluida', label: 'Concluída' },
];

const STATUS_CONFIG: Record<ObraStatus, { label: string; color: string }> = {
  em_andamento: { label: 'Em Andamento', color: colors.primary.olive },
  planejamento: { label: 'Planejamento', color: colors.info },
  pausada: { label: 'Pausada', color: colors.warning },
  concluida: { label: 'Concluída', color: colors.success },
  cancelada: { label: 'Cancelada', color: colors.error },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObrasListScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<ObraStatus | 'all'>('all');

  const {
    data: obrasResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['obras', activeFilter],
    queryFn: () =>
      getObras(activeFilter === 'all' ? undefined : { status: activeFilter }),
  });

  const obras = obrasResponse?.data ?? [];

  const handleObraPress = useCallback(
    (obraId: string) => {
      navigation.navigate('ObraDetail', { obraId });
    },
    [navigation],
  );

  // ── Filter bar ──────────────────────────────────────────────────────────

  const renderFilterPill = useCallback(
    ({ item }: { item: FilterOption }) => {
      const isActive = item.key === activeFilter;
      return (
        <TouchableOpacity
          style={[styles.filterPill, isActive && styles.filterPillActive]}
          onPress={() => setActiveFilter(item.key)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterPillText,
              isActive && styles.filterPillTextActive,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [activeFilter],
  );

  // ── Obra card ───────────────────────────────────────────────────────────

  const renderObraCard = useCallback(
    ({ item }: { item: Obra }) => {
      const statusCfg = STATUS_CONFIG[item.status];
      return (
        <Card
          style={styles.obraCard}
          accentBorder
          onPress={() => handleObraPress(item.id)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.obraName} numberOfLines={1}>
              {item.name}
            </Text>
            <Badge
              label={statusCfg.label}
              color={statusCfg.color}
              size="sm"
            />
          </View>

          <Text style={styles.clientText} numberOfLines={1}>
            {item.client}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${item.progressPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {item.progressPercent}%
            </Text>
          </View>
        </Card>
      );
    },
    [handleObraPress],
  );

  // ── Empty & error states ────────────────────────────────────────────────

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Nenhuma obra encontrada</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter !== 'all'
            ? 'Tente alterar o filtro selecionado.'
            : 'Ainda não há obras cadastradas.'}
        </Text>
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Engenharia</Text>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBarWrapper}>
        <FlatList
          data={FILTERS}
          keyExtractor={(f) => f.key}
          renderItem={renderFilterPill}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        />
      </View>

      {/* Error banner */}
      {isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Erro ao carregar obras.{' '}
            {(error as Error)?.message ?? 'Tente novamente.'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.olive} />
          <Text style={styles.loadingText}>Carregando obras...</Text>
        </View>
      ) : (
        <FlatList
          data={obras}
          keyExtractor={(item) => item.id}
          renderItem={renderObraCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary.olive}
              colors={[colors.primary.olive]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  },

  // Header
  header: {
    paddingTop: 60,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary.charcoal,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.secondary.white,
  },

  // Filter bar
  filterBarWrapper: {
    backgroundColor: colors.primary.charcoal,
    paddingBottom: spacing.md,
  },
  filterBarContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary.darkTeal,
  },
  filterPillActive: {
    backgroundColor: colors.primary.olive,
  },
  filterPillText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.secondary.white,
    opacity: 0.8,
  },
  filterPillTextActive: {
    opacity: 1,
  },

  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },

  // Obra card
  obraCard: {
    paddingVertical: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  obraName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  clientText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.secondary.sage,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.full,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Error
  errorBanner: {
    backgroundColor: '#FFF0F0',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  retryText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.primary.olive,
    marginLeft: spacing.sm,
  },
});
