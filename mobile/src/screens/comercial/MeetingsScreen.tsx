import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getUpcomingMeetings, Meeting } from '../../services/meetings';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import type { ComercialStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ComercialStackParamList, 'MeetingsScreen'>;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

interface MeetingSection {
  title: string;
  data: Meeting[];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowOnly = new Date(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
  );

  if (dateOnly.getTime() === todayOnly.getTime()) return 'Hoje';
  if (dateOnly.getTime() === tomorrowOnly.getTime()) return 'Amanhã';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function groupMeetingsByDate(meetings: Meeting[]): MeetingSection[] {
  const groups = new Map<string, Meeting[]>();

  for (const meeting of meetings) {
    const key = getDateKey(meeting.startTime);
    const existing = groups.get(key) ?? [];
    existing.push(meeting);
    groups.set(key, existing);
  }

  const sections: MeetingSection[] = [];
  for (const [, groupMeetings] of groups) {
    // Sort meetings within each group by start time
    groupMeetings.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    sections.push({
      title: getDateLabel(groupMeetings[0].startTime),
      data: groupMeetings,
    });
  }

  return sections;
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const startTime = formatTime(meeting.startTime);
  const endTime = formatTime(meeting.endTime);

  return (
    <View style={cardStyles.container}>
      {/* Time Column */}
      <View style={cardStyles.timeColumn}>
        <Text style={cardStyles.startTime}>{startTime}</Text>
        <Text style={cardStyles.endTime}>{endTime}</Text>
      </View>

      {/* Divider */}
      <View style={cardStyles.divider}>
        <View style={cardStyles.dot} />
        <View style={cardStyles.line} />
      </View>

      {/* Content */}
      <View style={cardStyles.content}>
        <Text style={cardStyles.title} numberOfLines={2}>
          {meeting.title}
        </Text>

        {meeting.clientName && (
          <View style={cardStyles.infoRow}>
            <Ionicons
              name="person-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={cardStyles.infoText}>{meeting.clientName}</Text>
          </View>
        )}

        {meeting.location && (
          <View style={cardStyles.infoRow}>
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={cardStyles.infoText} numberOfLines={1}>
              {meeting.location}
            </Text>
          </View>
        )}

        {meeting.description && (
          <Text style={cardStyles.description} numberOfLines={2}>
            {meeting.description}
          </Text>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  startTime: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  endTime: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.olive,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  description: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────

export default function MeetingsScreen({ navigation }: Props) {
  const {
    data: meetings,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery<Meeting[]>({
    queryKey: ['upcomingMeetings'],
    queryFn: getUpcomingMeetings,
  });

  const sections = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];
    return groupMeetingsByDate(meetings);
  }, [meetings]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando reuniões...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.error}
        />
        <Text style={styles.errorText}>Erro ao carregar reuniões</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Reuniões</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="calendar-outline"
            size={64}
            color={colors.border}
          />
          <Text style={styles.emptyTitle}>Nenhuma reunião agendada</Text>
          <Text style={styles.emptySubtitle}>
            Quando houver reuniões futuras, elas aparecerão aqui.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MeetingCard meeting={item} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[colors.primary.olive]}
              tintColor={colors.primary.olive}
            />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
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
    fontFamily: typography.h2.fontFamily,
    fontSize: typography.h2.fontSize,
    letterSpacing: typography.h2.letterSpacing,
    color: colors.text,
  },
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.text,
    textTransform: 'capitalize',
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
  emptyTitle: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 18,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
