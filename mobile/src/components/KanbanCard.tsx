import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { Avatar } from './Avatar';

interface Task {
  title: string;
  assignee?: string;
  priority: string;
  dueDate?: string;
  status: string;
}

interface KanbanCardProps {
  task: Task;
  onPress?: () => void;
}

const priorityColorMap: Record<string, string> = {
  low: '#4CAF50',
  medium: colors.primary.olive,
  high: '#FF9800',
  urgent: colors.support.error,
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const KanbanCard: React.FC<KanbanCardProps> = ({ task, onPress }) => {
  const priorityColor = priorityColorMap[task.priority] ?? colors.secondary.warmGray;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>

        <View style={styles.footer}>
          {task.assignee ? (
            <Avatar name={task.assignee} size={24} />
          ) : (
            <View />
          )}

          {task.dueDate ? (
            <Text style={styles.dueDate}>{formatDate(task.dueDate)}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  } as ViewStyle,
  priorityBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: spacing.sm + 2,
  },
  title: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.charcoal,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDate: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
});

export default KanbanCard;
