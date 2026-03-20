import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EngenhariaStackParamList } from '../../navigation/types';
import {
  getTasks,
  createTask,
  updateTaskStatus,
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskData,
} from '../../services/tasks';
import { Badge } from '../../components/Badge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<EngenhariaStackParamList, 'KanbanBoard'>;

interface ColumnDef {
  key: TaskStatus;
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef[] = [
  { key: 'todo', label: 'Todo', color: colors.secondary.warmGray },
  { key: 'in_progress', label: 'Em Progresso', color: colors.info },
  { key: 'review', label: 'Revisao', color: colors.warning },
  { key: 'done', label: 'Concluido', color: colors.success },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: colors.secondary.warmGray },
  medium: { label: 'Media', color: colors.info },
  high: { label: 'Alta', color: colors.warning },
  urgent: { label: 'Urgente', color: colors.error },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'Em Progresso',
  review: 'Revisao',
  done: 'Concluido',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KanbanBoardScreen({ route }: Props) {
  const { obraId } = route.params;
  const queryClient = useQueryClient();

  // ── Query ───────────────────────────────────────────────────────────────

  const {
    data: tasksResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['tasks', obraId],
    queryFn: () => getTasks(obraId),
  });

  const tasks = tasksResponse?.data ?? [];

  // ── Grouped tasks ───────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    tasks.forEach((t) => {
      if (map[t.status]) {
        map[t.status].push(t);
      }
    });
    // Sort by position within each column
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.position - b.position),
    );
    return map;
  }, [tasks]);

  // ── Mutations ───────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', obraId] });
    },
    onError: () => {
      Alert.alert('Erro', 'Nao foi possivel atualizar o status da tarefa.');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskData) => createTask(obraId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', obraId] });
    },
    onError: () => {
      Alert.alert('Erro', 'Nao foi possivel criar a tarefa.');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCardPress = useCallback((task: Task) => {
    const priorityCfg = PRIORITY_CONFIG[task.priority];
    const assigneeName = task.assignee?.name ?? 'Nao atribuido';
    const dueDate = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString('pt-BR')
      : 'Sem prazo';

    Alert.alert(
      task.title,
      `Descricao: ${task.description ?? 'Sem descricao'}\n` +
        `Prioridade: ${priorityCfg.label}\n` +
        `Responsavel: ${assigneeName}\n` +
        `Prazo: ${dueDate}\n` +
        `Status: ${STATUS_LABELS[task.status]}`,
    );
  }, []);

  const handleCardLongPress = useCallback(
    (task: Task) => {
      const options = COLUMNS.map((c) => c.label);
      const cancelIndex = options.length;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...options, 'Cancelar'],
            cancelButtonIndex: cancelIndex,
            title: 'Mover para...',
          },
          (buttonIndex) => {
            if (buttonIndex < COLUMNS.length) {
              const newStatus = COLUMNS[buttonIndex].key;
              if (newStatus !== task.status) {
                statusMutation.mutate({ id: task.id, status: newStatus });
              }
            }
          },
        );
      } else {
        // Android fallback using Alert
        Alert.alert(
          'Mover para...',
          'Selecione o novo status:',
          [
            ...COLUMNS.filter((c) => c.key !== task.status).map((c) => ({
              text: c.label,
              onPress: () =>
                statusMutation.mutate({ id: task.id, status: c.key }),
            })),
            { text: 'Cancelar', style: 'cancel' as const },
          ],
        );
      }
    },
    [statusMutation],
  );

  const handleCreateTask = useCallback(() => {
    Alert.prompt(
      'Nova Tarefa',
      'Digite o titulo da tarefa:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Criar',
          onPress: (title) => {
            if (title && title.trim()) {
              createMutation.mutate({
                title: title.trim(),
                status: 'todo',
                priority: 'medium',
              });
            }
          },
        },
      ],
      'plain-text',
    );
  }, [createMutation]);

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando tarefas...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Erro ao carregar tarefas</Text>
        <Text style={styles.errorSubtitle}>
          {(error as Error)?.message ?? 'Tente novamente.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary.olive}
            colors={[colors.primary.olive]}
          />
        }
      >
        {COLUMNS.map((col) => {
          const columnTasks = grouped[col.key];
          return (
            <View key={col.key} style={styles.column}>
              {/* Column header */}
              <View style={styles.columnHeader}>
                <View
                  style={[styles.columnDot, { backgroundColor: col.color }]}
                />
                <Text style={styles.columnTitle}>{col.label}</Text>
                <View style={styles.columnCount}>
                  <Text style={styles.columnCountText}>
                    {columnTasks.length}
                  </Text>
                </View>
              </View>

              {/* Column cards */}
              <FlatList
                data={columnTasks}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => handleCardPress(item)}
                    onLongPress={() => handleCardLongPress(item)}
                    activeOpacity={0.7}
                    delayLongPress={400}
                  >
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.description && (
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <View style={styles.cardFooter}>
                      <Badge
                        label={PRIORITY_CONFIG[item.priority].label}
                        color={PRIORITY_CONFIG[item.priority].color}
                        size="sm"
                      />
                      {item.assignee && (
                        <Text style={styles.cardAssignee} numberOfLines={1}>
                          {item.assignee.name.split(' ')[0]}
                        </Text>
                      )}
                    </View>
                    {item.dueDate && (
                      <Text style={styles.cardDueDate}>
                        {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.columnContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.columnEmpty}>
                    <Text style={styles.columnEmptyText}>Nenhuma tarefa</Text>
                  </View>
                }
              />
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateTask}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const COLUMN_WIDTH = 280;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.sage,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.error,
  },
  errorSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: colors.secondary.white,
  },

  // Columns
  columnsContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  column: {
    width: COLUMN_WIDTH,
    marginRight: spacing.md,
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  columnTitle: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  columnCount: {
    backgroundColor: colors.secondary.sage,
    borderRadius: borderRadius.full,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  columnCountText: {
    fontFamily: typography.fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  columnContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  columnEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  columnEmptyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Kanban card
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as any,
  cardTitle: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAssignee: {
    ...typography.caption,
    color: colors.textSecondary,
    maxWidth: 100,
  },
  cardDueDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.olive,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  } as any,
  fabText: {
    fontSize: 28,
    color: colors.secondary.white,
    fontFamily: typography.fonts.bold,
    marginTop: -2,
  },
});
