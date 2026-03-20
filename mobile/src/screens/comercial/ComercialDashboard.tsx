import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  getProposalStats,
  getProposals,
  getAgendorStats,
  ProposalStats,
  Proposal,
  ProposalStatus,
  AgendorStats,
} from '../../services/proposals';
import FunnelChart, {
  DNN_STAGE_ORDER,
  FunnelStage,
} from '../../components/FunnelChart';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import type { ComercialStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ComercialStackParamList, 'ComercialDashboard'>;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const STATUS_LABELS: Record<ProposalStatus, string> = {
  leads_info: 'Leads - Info',
  leads_aguardando: 'Leads - Aguard.',
  contato: 'Contato',
  analise: 'Análise Go/No Go',
  go_aguardando: 'Go - Aguard.',
  proposta_dev: 'Proposta Dev.',
  enviada_alta: 'Env. Alta',
  enviada_media: 'Env. Média',
  enviada_baixa: 'Env. Baixa',
  ganha: 'Ganha',
  perdida: 'Perdida',
};

const STATUS_COLORS: Record<ProposalStatus, string> = {
  leads_info: colors.secondary.warmGray,
  leads_aguardando: colors.secondary.warmGray,
  contato: colors.info,
  analise: colors.primary.olive,
  go_aguardando: colors.info,
  proposta_dev: colors.primary.olive,
  enviada_alta: colors.success,
  enviada_media: colors.warning,
  enviada_baixa: colors.secondary.warmGray,
  ganha: colors.success,
  perdida: colors.error,
};

const STATUS_ORDER: ProposalStatus[] = [
  'leads_info',
  'leads_aguardando',
  'contato',
  'analise',
  'go_aguardando',
  'proposta_dev',
  'enviada_alta',
  'enviada_media',
  'enviada_baixa',
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parseBRLString(value: string): string {
  // The backend returns strings like "R$ 1.234,56" or raw numbers as strings
  if (value.startsWith('R$')) return value;
  const num = Number(value);
  if (isNaN(num)) return value;
  return formatBRL(num);
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={statStyles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  label: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: typography.fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
});

function StatusBadge({
  status,
  count,
}: {
  status: ProposalStatus;
  count: number;
}) {
  return (
    <View
      style={[badgeStyles.badge, { backgroundColor: STATUS_COLORS[status] }]}
    >
      <Text style={badgeStyles.count}>{count}</Text>
      <Text style={badgeStyles.label} numberOfLines={1}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  count: {
    fontFamily: typography.fonts.bold,
    fontSize: 12,
    color: colors.secondary.white,
    marginRight: 4,
  },
  label: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 10,
    color: colors.secondary.white,
  },
});

function ProposalCard({
  proposal,
  onPress,
}: {
  proposal: Proposal;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLORS[proposal.status];

  return (
    <TouchableOpacity
      style={proposalStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={proposalStyles.header}>
        <Text style={proposalStyles.title} numberOfLines={1}>
          {proposal.title}
        </Text>
        <View
          style={[proposalStyles.badge, { backgroundColor: statusColor }]}
        >
          <Text style={proposalStyles.badgeText}>
            {STATUS_LABELS[proposal.status]}
          </Text>
        </View>
      </View>
      <Text style={proposalStyles.client} numberOfLines={1}>
        {proposal.clientName}
      </Text>
      <Text style={proposalStyles.value}>{formatBRL(proposal.value)}</Text>
    </TouchableOpacity>
  );
}

const proposalStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 10,
    color: colors.secondary.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  client: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.primary.olive,
  },
});

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────

export default function ComercialDashboard({ navigation }: Props) {
  const statsQuery = useQuery<ProposalStats>({
    queryKey: ['proposalStats'],
    queryFn: getProposalStats,
  });

  const agendorQuery = useQuery<AgendorStats>({
    queryKey: ['agendorStats'],
    queryFn: getAgendorStats,
  });

  const proposalsQuery = useQuery({
    queryKey: ['proposals', { limit: 10 }],
    queryFn: () => getProposals({ limit: 10 }),
  });

  const isLoading = statsQuery.isLoading || proposalsQuery.isLoading;
  const isRefreshing =
    statsQuery.isRefetching ||
    proposalsQuery.isRefetching ||
    agendorQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    statsQuery.refetch();
    proposalsQuery.refetch();
    agendorQuery.refetch();
  }, [statsQuery, proposalsQuery, agendorQuery]);

  const proposals = proposalsQuery.data?.data ?? [];
  const stats = statsQuery.data;

  // Build funnel stages from agendor data (DNN funnel only, ordered)
  const funnelStages: FunnelStage[] = useMemo(() => {
    if (!agendorQuery.data?.byStage) return [];
    const byStage = agendorQuery.data.byStage;
    return DNN_STAGE_ORDER.reduce<FunnelStage[]>((acc, name) => {
      const stage = byStage[name];
      if (stage) {
        acc.push({ name, count: stage.count, value: stage.value });
      }
      return acc;
    }, []);
  }, [agendorQuery.data]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (statsQuery.isError || proposalsQuery.isError) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.error}
        />
        <Text style={styles.errorText}>Erro ao carregar dados</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary.olive]}
          tintColor={colors.primary.olive}
        />
      }
    >
      {/* Header */}
      <Text style={styles.screenTitle}>Comercial</Text>

      {/* Stats Row */}
      {stats && (
        <View style={styles.statsRow}>
          <StatCard
            label="Total de Propostas"
            value={String(stats.total)}
          />
          <StatCard
            label="Taxa de Conversão"
            value={stats.conversionRate}
          />
          <StatCard
            label="Valor Ganho"
            value={parseBRLString(stats.wonValue)}
          />
        </View>
      )}

      {/* Status Badges */}
      {stats && (
        <View style={styles.badgesRow}>
          {STATUS_ORDER.map((status) => (
            <StatusBadge
              key={status}
              status={status}
              count={stats.pipeline[status] ?? 0}
            />
          ))}
        </View>
      )}

      {/* Funnel Chart */}
      {funnelStages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funil Comercial</Text>
          <View style={styles.funnelCard}>
            <FunnelChart stages={funnelStages} />
          </View>
        </View>
      )}

      {/* Recent Proposals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Propostas Recentes</Text>

        {proposals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.border}
            />
            <Text style={styles.emptyText}>Nenhuma proposta encontrada</Text>
          </View>
        ) : (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onPress={() =>
                navigation.navigate('ProposalDetail', {
                  proposalId: proposal.id,
                })
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.sage,
  },
  contentContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,
    letterSpacing: typography.h1.letterSpacing,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.h3.fontFamily,
    fontSize: typography.h3.fontSize,
    color: colors.text,
    marginBottom: spacing.md,
  },
  funnelCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondary.sage,
    padding: spacing.lg,
  },
  loadingText: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 16,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.md,
  },
  retryText: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.secondary.white,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
