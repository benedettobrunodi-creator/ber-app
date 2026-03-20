import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComunicadosStackParamList } from '../../navigation/types';
import {
  getAnnouncement,
  Announcement,
  AnnouncementCategory,
} from '../../services/announcements';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<ComunicadosStackParamList, 'AnnouncementDetail'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  urgente: colors.support.error,
  informativo: colors.info,
  rh: colors.secondary.darkTeal,
  obra: colors.primary.olive,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnouncementDetailScreen({ route, navigation }: Props) {
  const { announcementId } = route.params;

  const {
    data: announcement,
    isLoading,
    isError,
    refetch,
  } = useQuery<Announcement>({
    queryKey: ['announcement', announcementId],
    queryFn: () => getAnnouncement(announcementId),
  });

  // ── Loading ────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Comunicado" onBack={() => navigation.goBack()} />
        <Loading message="Carregando comunicado..." />
      </View>
    );
  }

  // ── Error ──────────────────────────────────────
  if (isError || !announcement) {
    return (
      <View style={styles.container}>
        <Header title="Comunicado" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Erro ao carregar"
          message="Nao foi possivel carregar este comunicado."
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const categoryColor =
    CATEGORY_COLORS[announcement.category] ?? colors.secondary.warmGray;

  return (
    <View style={styles.container}>
      <Header title="Comunicado" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category badge */}
        <Badge
          label={announcement.category.toUpperCase()}
          color={categoryColor}
        />

        {/* Title */}
        <Text style={styles.title}>{announcement.title}</Text>

        {/* Author & date */}
        <View style={styles.meta}>
          <Text style={styles.author}>
            {announcement.author?.name ?? 'Autor desconhecido'}
          </Text>
          <Text style={styles.separator}>{'·'}</Text>
          <Text style={styles.date}>
            {formatFullDate(announcement.createdAt)}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Body */}
        <Text style={styles.body}>{announcement.body}</Text>

        {/* Read count */}
        {announcement.readCount !== undefined && (
          <View style={styles.readCountContainer}>
            <Text style={styles.readCountText}>
              Lido por {announcement.readCount}{' '}
              {announcement.readCount === 1 ? 'pessoa' : 'pessoas'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  title: {
    fontFamily: typography.fonts.bold,
    fontSize: 24,
    color: colors.primary.charcoal,
    marginTop: spacing.md,
    lineHeight: 32,
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  author: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.secondary.darkTeal,
  },
  separator: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
  },
  date: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  body: {
    fontFamily: typography.fonts.regular,
    fontSize: 16,
    color: colors.primary.charcoal,
    lineHeight: 26,
  },

  readCountContainer: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  readCountText: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
  },
});
