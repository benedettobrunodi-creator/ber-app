import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface KanbanColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
  status: string;
}

const statusColorMap: Record<string, string> = {
  todo: colors.secondary.warmGray,
  in_progress: colors.primary.olive,
  review: '#FF9800',
  done: '#4CAF50',
  backlog: colors.support.steelBlue,
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  count,
  children,
  status,
}) => {
  const headerColor = statusColorMap[status] ?? colors.secondary.darkTeal;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.secondary.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
});

export default KanbanColumn;
