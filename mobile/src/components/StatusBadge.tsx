import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type StatusType = 'obra' | 'proposal' | 'task' | 'priority';

interface StatusBadgeProps {
  status: string;
  type: StatusType;
}

const statusColorMap: Record<StatusType, Record<string, string>> = {
  obra: {
    planejamento: colors.support.steelBlue,
    em_andamento: colors.primary.olive,
    pausada: colors.warning,
    concluida: colors.secondary.darkTeal,
  },
  proposal: {
    leads_info: colors.secondary.warmGray,
    leads_aguardando: colors.secondary.warmGray,
    contato: colors.support.steelBlue,
    analise: colors.primary.olive,
    go_aguardando: colors.support.steelBlue,
    proposta_dev: colors.primary.olive,
    enviada_alta: '#4CAF50',
    enviada_media: '#FF9800',
    enviada_baixa: colors.secondary.warmGray,
    ganha: '#4CAF50',
    perdida: colors.support.error,
  },
  task: {
    todo: colors.secondary.warmGray,
    in_progress: colors.primary.olive,
    review: '#FF9800',
    done: '#4CAF50',
  },
  priority: {
    low: '#4CAF50',
    medium: colors.primary.olive,
    high: '#FF9800',
    urgent: colors.support.error,
  },
};

const formatLabel = (status: string): string => {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type }) => {
  const colorMap = statusColorMap[type] ?? {};
  const bgColor = colorMap[status] ?? colors.secondary.warmGray;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{formatLabel(status)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
  },
  text: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 11,
    color: colors.secondary.white,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

export default StatusBadge;
