import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EngenhariaStackParamList } from '../../navigation/types';
import {
  getObra,
  getObraMembers,
  getObraStats,
  Obra,
  ObraMember,
  ObraStats,
  ObraStatus,
} from '../../services/obras';
import { Badge } from '../../components/Badge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<EngenhariaStackParamList, 'ObraDetail'>;

type TabKey = 'kanban' | 'fotos' | 'equipe' | 'ponto';

interface TabDef {
  key: TabKey;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: TabDef[] = [
  { key: 'kanban', label: 'Kanban' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'ponto', label: 'Ponto' },
];

const STATUS_CONFIG: Record<ObraStatus, { label: string; color: string }> = {
  em_andamento: { label: 'Em Andamento', color: colors.primary.olive },
  planejamento: { label: 'Planejamento', color: colors.info },
  pausada: { label: 'Pausada', color: colors.warning },
  concluida: { label: 'Concluída', color: colors.success },
  cancelada: { label: 'Cancelada', color: colors.error },
};

const ROLE_COLORS: Record<string, string> = {
  coordenador: colors.primary.olive,
  engenheiro: colors.secondary.darkTeal,
  mestre_de_obras: colors.warning,
  pedreiro: colors.info,
  eletricista: '#9C27B0',
  encanador: '#00BCD4',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObraDetailScreen({ route, navigation }: Props) {
  const { obraId } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>('equipe');

  // ── Queries ─────────────────────────────────────────────────────────────

  const {
    data: obra,
    isLoading: loadingObra,
    isError: errorObra,
  } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => getObra(obraId),
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['obraMembers', obraId],
    queryFn: () => getObraMembers(obraId),
  });

  const { data: stats } = useQuery({
    queryKey: ['obraStats', obraId],
    queryFn: () => getObraStats(obraId),
  });

  // ── Navigation handlers ─────────────────────────────────────────────────

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      if (tab === 'kanban') {
        navigation.navigate('KanbanBoard', { obraId });
        return;
      }
      if (tab === 'fotos') {
        navigation.navigate('PhotoGallery', { obraId });
        return;
      }
      setActiveTab(tab);
    },
    [navigation, obraId],
  );

  // ── Loading state ───────────────────────────────────────────────────────

  if (loadingObra) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando obra...</Text>
      </View>
    );
  }

  if (errorObra || !obra) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Erro ao carregar obra</Text>
        <Text style={styles.errorSubtitle}>
          Verifique sua conexao e tente novamente.
        </Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[obra.status];

  // ── Tab content ─────────────────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'equipe':
        return renderEquipeTab();
      case 'ponto':
        return renderPontoTab();
      default:
        return null;
    }
  };

  const renderEquipeTab = () => {
    if (loadingMembers) {
      return (
        <View style={styles.tabLoadingContainer}>
          <ActivityIndicator size="small" color={colors.primary.olive} />
        </View>
      );
    }

    if (members.length === 0) {
      return (
        <View style={styles.tabEmptyContainer}>
          <Text style={styles.tabEmptyText}>Nenhum membro na equipe.</Text>
        </View>
      );
    }

    return (
      <View style={styles.membersList}>
        {members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            {/* Avatar */}
            <View style={styles.avatar}>
              {member.user.avatarUrl ? (
                <Image
                  source={{ uri: member.user.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitials}>
                  {getInitials(member.user.name)}
                </Text>
              )}
            </View>

            {/* Info */}
            <View style={styles.memberInfo}>
              <Text style={styles.memberName} numberOfLines={1}>
                {member.user.name}
              </Text>
              <Badge
                label={member.role.replace(/_/g, ' ')}
                color={ROLE_COLORS[member.role] ?? colors.secondary.warmGray}
                size="sm"
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPontoTab = () => {
    // Show checked-in members (simplified: show all members as "present" placeholder)
    if (loadingMembers) {
      return (
        <View style={styles.tabLoadingContainer}>
          <ActivityIndicator size="small" color={colors.primary.olive} />
        </View>
      );
    }

    if (members.length === 0) {
      return (
        <View style={styles.tabEmptyContainer}>
          <Text style={styles.tabEmptyText}>
            Nenhum registro de ponto encontrado.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.pontoContainer}>
        <Text style={styles.pontoSectionTitle}>Presentes Hoje</Text>
        {members.map((member) => (
          <View key={member.id} style={styles.pontoRow}>
            <View style={styles.avatarSmall}>
              {member.user.avatarUrl ? (
                <Image
                  source={{ uri: member.user.avatarUrl }}
                  style={styles.avatarSmallImage}
                />
              ) : (
                <Text style={styles.avatarSmallInitials}>
                  {getInitials(member.user.name)}
                </Text>
              )}
            </View>
            <View style={styles.pontoInfo}>
              <Text style={styles.pontoName} numberOfLines={1}>
                {member.user.name}
              </Text>
              <Text style={styles.pontoRole}>
                {member.role.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.pontoStatusDot} />
          </View>
        ))}
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header section */}
      <View style={styles.headerSection}>
        <View style={styles.headerTopRow}>
          <Text style={styles.obraName} numberOfLines={2}>
            {obra.name}
          </Text>
          <Badge label={statusCfg.label} color={statusCfg.color} />
        </View>

        <Text style={styles.clientText}>{obra.client}</Text>

        {/* Progress bar (large) */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressTitle}>Progresso</Text>
            <Text style={styles.progressPercent}>
              {obra.progressPercent}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${obra.progressPercent}%` },
              ]}
            />
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Inicio</Text>
            <Text style={styles.dateValue}>{formatDate(obra.startDate)}</Text>
          </View>
          <View style={styles.dateArrow}>
            <Text style={styles.dateArrowText}>→</Text>
          </View>
          <View style={[styles.dateBlock, styles.dateBlockEnd]}>
            <Text style={styles.dateLabel}>Previsao</Text>
            <Text style={styles.dateValue}>
              {formatDate(obra.expectedEndDate)}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Tarefas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.membersCount}</Text>
              <Text style={styles.statLabel}>Equipe</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.photosCount}</Text>
              <Text style={styles.statLabel}>Fotos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, stats.overdueTasks > 0 && styles.statValueAlert]}>
                {stats.overdueTasks}
              </Text>
              <Text style={styles.statLabel}>Atrasadas</Text>
            </View>
          </View>
        )}
      </View>

      {/* Tab navigation */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  isActive && styles.tabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>{renderTabContent()}</View>
    </ScrollView>
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
  contentContainer: {
    paddingBottom: spacing.xxl,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.error,
  },
  errorSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  // Header section
  headerSection: {
    backgroundColor: colors.primary.charcoal,
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  obraName: {
    ...typography.h2,
    color: colors.secondary.white,
    flex: 1,
    marginRight: spacing.sm,
  },
  clientText: {
    ...typography.bodySmall,
    color: colors.secondary.sage,
    marginBottom: spacing.md,
  },

  // Progress (large)
  progressSection: {
    marginBottom: spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressTitle: {
    ...typography.caption,
    color: colors.secondary.sage,
  },
  progressPercent: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.primary.olive,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.full,
  },

  // Dates
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateBlock: {
    flex: 1,
  },
  dateBlockEnd: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    ...typography.caption,
    color: colors.secondary.warmGray,
    marginBottom: 2,
  },
  dateValue: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.secondary.white,
  },
  dateArrow: {
    paddingHorizontal: spacing.md,
  },
  dateArrowText: {
    fontSize: 18,
    color: colors.secondary.warmGray,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: typography.fonts.bold,
    fontSize: 18,
    color: colors.secondary.white,
  },
  statValueAlert: {
    color: colors.error,
  },
  statLabel: {
    ...typography.caption,
    color: colors.secondary.warmGray,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.secondary.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary.olive,
  },
  tabButtonText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.primary.olive,
  },

  // Tab content
  tabContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tabLoadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  tabEmptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  tabEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Equipe tab
  membersList: {
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  } as any,
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary.darkTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitials: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.secondary.white,
  },
  memberInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  memberName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },

  // Ponto tab
  pontoContainer: {
    gap: spacing.sm,
  },
  pontoSectionTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pontoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    ...shadows.sm,
  } as any,
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary.darkTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarSmallImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarSmallInitials: {
    fontFamily: typography.fonts.bold,
    fontSize: 13,
    color: colors.secondary.white,
  },
  pontoInfo: {
    flex: 1,
  },
  pontoName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  pontoRole: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  pontoStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginLeft: spacing.sm,
  },
});
