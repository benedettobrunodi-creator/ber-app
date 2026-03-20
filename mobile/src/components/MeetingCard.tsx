import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';

interface Meeting {
  title: string;
  clientName: string;
  location: string;
  startTime: string;
  endTime: string;
}

interface MeetingCardProps {
  meeting: Meeting;
  onPress?: () => void;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{formatTime(meeting.startTime)}</Text>
        <View style={styles.timeDivider} />
        <Text style={styles.time}>{formatTime(meeting.endTime)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.details}>
        <Text style={styles.date}>{formatDate(meeting.startTime)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {meeting.title}
        </Text>
        <Text style={styles.client} numberOfLines={1}>
          {meeting.clientName}
        </Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>{'\uD83D\uDCCD'}</Text>
          <Text style={styles.location} numberOfLines={1}>
            {meeting.location}
          </Text>
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
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  } as ViewStyle,
  timeColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
  },
  time: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },
  timeDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.secondary.sage,
    marginVertical: 2,
  },
  divider: {
    width: 1,
    backgroundColor: colors.secondary.sage,
    marginHorizontal: spacing.sm + 4,
  },
  details: {
    flex: 1,
  },
  date: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.primary.charcoal,
    marginBottom: 2,
  },
  client: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.secondary.darkTeal,
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  location: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
    flex: 1,
  },
});

export default MeetingCard;
