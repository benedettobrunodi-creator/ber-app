import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { StatusBadge } from './StatusBadge';

interface Proposal {
  clientName: string;
  title: string;
  value: number;
  status: string;
  sentDate: string;
}

interface PipelineCardProps {
  proposal: Proposal;
  onPress?: () => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const PipelineCard: React.FC<PipelineCardProps> = ({
  proposal,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.clientName}>{proposal.clientName}</Text>
        <StatusBadge status={proposal.status} type="proposal" />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {proposal.title}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.value}>{formatCurrency(proposal.value)}</Text>
        <Text style={styles.date}>{formatDate(proposal.sentDate)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clientName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.secondary.darkTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.primary.charcoal,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: {
    fontFamily: typography.fonts.bold,
    fontSize: 18,
    color: colors.primary.olive,
  },
  date: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
});

export default PipelineCard;
