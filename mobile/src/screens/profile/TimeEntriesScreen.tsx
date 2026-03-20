import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Modal,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PerfilStackParamList } from '../../navigation/types';
import {
  getMyStatus,
  getMyEntries,
  checkIn,
  checkOut,
  TimeEntry,
  TimeEntryStatus,
} from '../../services/timeEntries';
import { getObras, Obra } from '../../services/obras';
import { useLocation } from '../../hooks/useLocation';
import { Header } from '../../components/Header';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<PerfilStackParamList, 'TimeEntries'>;

interface DayGroup {
  date: string;
  label: string;
  entries: TimeEntry[];
  totalHours: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';

  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
}

function computeTotalHours(entries: TimeEntry[]): string {
  let totalMs = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.type === 'checkin') {
      const checkoutEntry = entries.find(
        (e) => e.type === 'checkout' && new Date(e.timestamp) > new Date(entry.timestamp),
      );
      if (checkoutEntry) {
        totalMs +=
          new Date(checkoutEntry.timestamp).getTime() -
          new Date(entry.timestamp).getTime();
      }
    }
  }

  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h${minutes.toString().padStart(2, '0')}m`;
}

function groupEntriesByDate(entries: TimeEntry[]): DayGroup[] {
  const groups = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const dateKey = new Date(entry.timestamp).toDateString();
    const existing = groups.get(dateKey) ?? [];
    existing.push(entry);
    groups.set(dateKey, existing);
  }

  return Array.from(groups.entries())
    .map(([dateKey, dayEntries]) => {
      const sorted = dayEntries.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      return {
        date: dateKey,
        label: formatDateLabel(sorted[0].timestamp),
        entries: sorted,
        totalHours: computeTotalHours(sorted),
      };
    })
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeEntriesScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { loading: locationLoading, requestLocation } = useLocation();

  const [showObraModal, setShowObraModal] = useState(false);

  // ── Obras query ──────────────────────────────
  const { data: obrasResponse, isLoading: obrasLoading } = useQuery({
    queryKey: ['obras', 'active'],
    queryFn: () => getObras(),
  });

  const activeObras = useMemo(() => {
    const all = obrasResponse?.data ?? [];
    return all.filter(
      (o) => o.status === 'em_andamento' || o.status === 'planejamento',
    );
  }, [obrasResponse]);

  // ── Status query ───────────────────────────────
  const {
    data: status,
    isLoading: statusLoading,
  } = useQuery<TimeEntryStatus>({
    queryKey: ['timeEntryStatus'],
    queryFn: getMyStatus,
  });

  // ── Entries query ──────────────────────────────
  const {
    data: entriesResponse,
    isLoading: entriesLoading,
    isError: entriesError,
    refetch: refetchEntries,
    isRefetching,
  } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => getMyEntries(),
  });

  const entries = entriesResponse?.data ?? [];

  // ── Grouped entries ────────────────────────────
  const dayGroups = useMemo(() => groupEntriesByDate(entries), [entries]);

  // ── Today's entries ────────────────────────────
  const todayKey = new Date().toDateString();
  const todayGroup = dayGroups.find((g) => g.date === todayKey);
  const historyGroups = dayGroups.filter((g) => g.date !== todayKey);

  // ── Mutations ──────────────────────────────────
  const checkInMutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntryStatus'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: () => {
      Alert.alert('Erro', 'Nao foi possivel registrar o check-in. Tente novamente.');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntryStatus'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: () => {
      Alert.alert('Erro', 'Nao foi possivel registrar o check-out. Tente novamente.');
    },
  });

  const isMutating = checkInMutation.isPending || checkOutMutation.isPending;
  const isCheckedIn = status?.isCheckedIn ?? false;

  // ── Callbacks ──────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isCheckedIn) {
      const result = await requestLocation();
      if (result) {
        checkOutMutation.mutate({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          address: result.address ?? undefined,
        });
      }
    } else {
      setShowObraModal(true);
    }
  }, [isCheckedIn, requestLocation, checkOutMutation]);

  const handleSelectObra = useCallback(
    async (obra: Obra) => {
      setShowObraModal(false);
      const result = await requestLocation();
      if (result) {
        checkInMutation.mutate({
          obraId: obra.id,
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          address: result.address ?? undefined,
        });
      }
    },
    [requestLocation, checkInMutation],
  );

  const handleRefresh = useCallback(() => {
    refetchEntries();
  }, [refetchEntries]);

  // ── Status text ────────────────────────────────
  const statusText = useMemo(() => {
    if (!status) return '';
    if (status.isCheckedIn && status.checkedInSince) {
      const time = formatTime(status.checkedInSince);
      return `Voce esta em campo desde ${time}`;
    }
    return 'Voce nao esta em campo';
  }, [status]);

  // ── Loading ────────────────────────────────────
  const isLoading = statusLoading || entriesLoading;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Registro de Ponto" onBack={() => navigation.goBack()} />
        <Loading message="Carregando registros..." />
      </View>
    );
  }

  if (entriesError) {
    return (
      <View style={styles.container}>
        <Header title="Registro de Ponto" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Erro ao carregar"
          message="Nao foi possivel carregar seus registros."
          actionLabel="Tentar novamente"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────
  const renderEntry = (entry: TimeEntry) => {
    const obraName =
      entry.type === 'checkin' && entry.obraId
        ? activeObras.find((o) => o.id === entry.obraId)?.name
        : undefined;

    return (
      <View key={entry.id} style={styles.entryRow}>
        <View
          style={[
            styles.entryDot,
            {
              backgroundColor:
                entry.type === 'checkin' ? colors.success : colors.support.error,
            },
          ]}
        />
        <View style={styles.entryInfo}>
          <View>
            <Text style={styles.entryType}>
              {entry.type === 'checkin' ? 'Entrada' : 'Saida'}
            </Text>
            {obraName && (
              <Text style={styles.entryObra} numberOfLines={1}>
                {obraName}
              </Text>
            )}
          </View>
          <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
        </View>
      </View>
    );
  };

  const renderDayGroup = (group: DayGroup) => (
    <View key={group.date} style={styles.dayGroup}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{group.label}</Text>
        <Text style={styles.dayHours}>{group.totalHours}</Text>
      </View>
      {group.entries.map(renderEntry)}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Registro de Ponto" onBack={() => navigation.goBack()} />

      <FlatList
        data={[1]} // single item to enable pull-to-refresh on ScrollView-like content
        keyExtractor={() => 'content'}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.olive}
            colors={[colors.primary.olive]}
          />
        }
        renderItem={() => (
          <View style={styles.content}>
            {/* Big toggle button */}
            <TouchableOpacity
              style={[
                styles.toggleButton,
                isCheckedIn ? styles.toggleCheckedIn : styles.toggleCheckedOut,
              ]}
              onPress={handleToggle}
              disabled={isMutating || locationLoading}
              activeOpacity={0.8}
            >
              {isMutating || locationLoading ? (
                <ActivityIndicator size="large" color={colors.secondary.white} />
              ) : (
                <>
                  <Text style={styles.toggleIcon}>
                    {isCheckedIn ? '⏹' : '▶'}
                  </Text>
                  <Text style={styles.toggleLabel}>
                    {isCheckedIn ? 'Check-out' : 'Check-in'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Status text */}
            <Text style={styles.statusText}>{statusText}</Text>

            {/* Today's entries */}
            {todayGroup && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hoje</Text>
                {todayGroup.entries.map(renderEntry)}
                <Text style={styles.todayTotal}>
                  Total: {todayGroup.totalHours}
                </Text>
              </View>
            )}

            {/* History */}
            {historyGroups.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historico</Text>
                {historyGroups.map(renderDayGroup)}
              </View>
            )}

            {entries.length === 0 && (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  title="Sem registros"
                  message="Voce ainda nao possui registros de ponto."
                />
              </View>
            )}
          </View>
        )}
      />

      {/* Obra selection modal */}
      <Modal
        visible={showObraModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowObraModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Obra</Text>
              <TouchableOpacity
                onPress={() => setShowObraModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalClose}>Fechar</Text>
              </TouchableOpacity>
            </View>

            {obrasLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary.olive}
                style={{ marginTop: spacing.xl }}
              />
            ) : activeObras.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Nenhuma obra disponivel no momento.
              </Text>
            ) : (
              <ScrollView style={styles.modalList}>
                {activeObras.map((obra) => (
                  <TouchableOpacity
                    key={obra.id}
                    style={styles.obraRow}
                    onPress={() => handleSelectObra(obra)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.obraInfo}>
                      <Text style={styles.obraName} numberOfLines={1}>
                        {obra.name}
                      </Text>
                      <Text style={styles.obraClient} numberOfLines={1}>
                        {obra.client}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.obraStatusBadge,
                        {
                          backgroundColor:
                            obra.status === 'em_andamento'
                              ? colors.success
                              : colors.secondary.warmGray,
                        },
                      ]}
                    >
                      <Text style={styles.obraStatusText}>
                        {obra.status === 'em_andamento'
                          ? 'Em andamento'
                          : 'Planejamento'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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

  content: {
    paddingBottom: spacing.xxl,
  },

  // Toggle button
  toggleButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    ...shadows.lg,
  } as ViewStyle,
  toggleCheckedOut: {
    backgroundColor: colors.primary.olive,
  },
  toggleCheckedIn: {
    backgroundColor: colors.support.error,
  },
  toggleIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  toggleLabel: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.secondary.white,
  },

  statusText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.secondary.warmGray,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  // Section
  section: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.md,
  } as ViewStyle,
  sectionTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.primary.charcoal,
    marginBottom: spacing.md,
  },

  // Day group
  dayGroup: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.secondary.darkTeal,
    textTransform: 'capitalize',
  },
  dayHours: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    gap: spacing.sm,
  },
  entryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  entryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  entryType: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.primary.charcoal,
  },
  entryTime: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.charcoal,
  },

  todayTotal: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
    textAlign: 'right',
    marginTop: spacing.sm,
  },

  entryObra: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.secondary.warmGray,
    marginTop: 2,
  },

  emptyWrapper: {
    marginTop: spacing.xl,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.secondary.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  } as ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: 18,
    color: colors.primary.charcoal,
  },
  modalClose: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.primary.olive,
  },
  modalEmpty: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.secondary.warmGray,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  modalList: {
    paddingHorizontal: spacing.md,
  },
  obraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  obraInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  obraName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.primary.charcoal,
  },
  obraClient: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.secondary.warmGray,
    marginTop: 2,
  },
  obraStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  obraStatusText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 11,
    color: colors.secondary.white,
  },
});
