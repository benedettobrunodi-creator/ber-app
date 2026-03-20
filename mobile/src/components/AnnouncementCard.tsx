import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { Badge } from './Badge';

interface Announcement {
  title: string;
  body: string;
  category: string;
  createdAt: string;
  isRead?: boolean;
  author?: string;
}

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  onPress,
}) => {
  const isUnread = announcement.isRead === false;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Badge
          label={announcement.category}
          color={colors.secondary.darkTeal}
          size="sm"
        />
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>

      <Text
        style={[styles.title, isUnread && styles.titleUnread]}
        numberOfLines={1}
      >
        {announcement.title}
      </Text>

      <Text style={styles.body} numberOfLines={2}>
        {announcement.body}
      </Text>

      <View style={styles.footer}>
        {announcement.author ? (
          <Text style={styles.author}>{announcement.author}</Text>
        ) : (
          <View />
        )}
        <Text style={styles.date}>{formatDate(announcement.createdAt)}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.olive,
  },
  title: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 16,
    color: colors.primary.charcoal,
    marginBottom: spacing.xs,
  },
  titleUnread: {
    fontFamily: typography.fonts.bold,
  },
  body: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.darkTeal,
  },
  date: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
  },
});

export default AnnouncementCard;
