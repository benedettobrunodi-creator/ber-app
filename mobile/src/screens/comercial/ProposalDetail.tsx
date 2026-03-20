import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getProposal, Proposal, ProposalStatus } from '../../services/proposals';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import type { ComercialStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ComercialStackParamList, 'ProposalDetail'>;

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

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={rowStyles.container}>
      <Ionicons
        name={icon}
        size={20}
        color={colors.secondary.darkTeal}
        style={rowStyles.icon}
      />
      <View style={rowStyles.textContainer}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
});

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────

export default function ProposalDetail({ route, navigation }: Props) {
  const { proposalId } = route.params;

  const {
    data: proposal,
    isLoading,
    isError,
    refetch,
  } = useQuery<Proposal>({
    queryKey: ['proposal', proposalId],
    queryFn: () => getProposal(proposalId),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando proposta...</Text>
      </View>
    );
  }

  if (isError || !proposal) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.error}
        />
        <Text style={styles.errorText}>Erro ao carregar proposta</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[proposal.status];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {proposal.title}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor }]}
          >
            <Text style={styles.statusText}>
              {STATUS_LABELS[proposal.status]}
            </Text>
          </View>
        </View>

        {/* Value Card */}
        <View style={styles.valueCard}>
          <Text style={styles.valueLabel}>Valor da Proposta</Text>
          <Text style={styles.valueAmount}>{formatBRL(proposal.value)}</Text>
        </View>

        {/* Details Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Detalhes</Text>
          <DetailRow
            icon="person-outline"
            label="Cliente"
            value={proposal.clientName}
          />
          <DetailRow
            icon="document-text-outline"
            label="Título"
            value={proposal.title}
          />
          <DetailRow
            icon="pricetag-outline"
            label="Status"
            value={STATUS_LABELS[proposal.status]}
          />
        </View>

        {/* Dates Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Datas</Text>
          <DetailRow
            icon="calendar-outline"
            label="Data de Envio"
            value={formatDate(proposal.sentDate)}
          />
          <DetailRow
            icon="checkmark-circle-outline"
            label="Data de Fechamento"
            value={formatDate(proposal.closedDate)}
          />
          <DetailRow
            icon="time-outline"
            label="Criado em"
            value={formatDate(proposal.createdAt)}
          />
        </View>

        {/* Notes Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Observações</Text>
          {proposal.notes ? (
            <Text style={styles.notesText}>{proposal.notes}</Text>
          ) : (
            <Text style={styles.emptyNotes}>
              Nenhuma observação registrada.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.sage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? spacing.xxl + spacing.md : spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typography.h3.fontFamily,
    fontSize: typography.h3.fontSize,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.secondary.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueCard: {
    backgroundColor: colors.primary.charcoal,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  valueLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  valueAmount: {
    fontFamily: typography.fonts.bold,
    fontSize: 32,
    color: colors.primary.olive,
  },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontFamily: typography.h3.fontFamily,
    fontSize: typography.h3.fontSize,
    color: colors.text,
    marginBottom: spacing.md,
  },
  notesText: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.text,
    lineHeight: 24,
  },
  emptyNotes: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
});
