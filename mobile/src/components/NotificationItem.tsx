import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, shadows } from '../theme/spacing';

interface Notification {
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

const typeIcons: Record<string, string> = {
  task: '\u2611',
  message: '\u2709',
  obra: '\u2692',
  proposal: '\u2709',
  alert: '\u26A0',
  meeting: '\uD83D\uDCC5',
};

const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
}) => {
  const isUnread = !notification.read;
  const icon = typeIcons[notification.type] ?? '\uD83D\uDD14';

  return (
    <TouchableOpacity
      style={[styles.container, isUnread && styles.unreadContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUnread ? <View style={styles.accentBar} /> : null}

      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[styles.title, isUnread && styles.titleUnread]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={styles.time}>
            {getTimeAgo(notification.createdAt)}
          </Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary.white,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary.sage,
  },
  unreadContainer: {
    backgroundColor: '#FAFDF0',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary.olive,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.primary.charcoal,
    marginRight: spacing.sm,
  },
  titleUnread: {
    fontFamily: typography.fonts.bold,
  },
  time: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
  body: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.secondary.warmGray,
    lineHeight: 18,
  },
});

export default NotificationItem;
