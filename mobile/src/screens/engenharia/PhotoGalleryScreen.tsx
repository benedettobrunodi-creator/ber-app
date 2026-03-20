import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EngenhariaStackParamList } from '../../navigation/types';
import {
  getPhotos,
  getPhotoComments,
  addPhotoComment,
  Photo,
  PhotoComment,
} from '../../services/photos';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<EngenhariaStackParamList, 'PhotoGallery'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.xs;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - spacing.md * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhotoGalleryScreen({ route, navigation }: Props) {
  const { obraId } = route.params;
  const queryClient = useQueryClient();

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [commentText, setCommentText] = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────

  const {
    data: photos = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['photos', obraId],
    queryFn: () => getPhotos(obraId),
  });

  const {
    data: comments = [],
    isLoading: loadingComments,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['photoComments', selectedPhoto?.id],
    queryFn: () => getPhotoComments(selectedPhoto!.id),
    enabled: !!selectedPhoto,
  });

  // ── Mutations ───────────────────────────────────────────────────────────

  const commentMutation = useMutation({
    mutationFn: ({ photoId, body }: { photoId: string; body: string }) =>
      addPhotoComment(photoId, body),
    onSuccess: () => {
      setCommentText('');
      if (selectedPhoto) {
        queryClient.invalidateQueries({
          queryKey: ['photoComments', selectedPhoto.id],
        });
      }
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handlePhotoPress = useCallback((photo: Photo) => {
    setSelectedPhoto(photo);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPhoto(null);
    setCommentText('');
  }, []);

  const handleSendComment = useCallback(() => {
    if (!selectedPhoto || !commentText.trim()) return;
    commentMutation.mutate({
      photoId: selectedPhoto.id,
      body: commentText.trim(),
    });
  }, [selectedPhoto, commentText, commentMutation]);

  const handleUploadPress = useCallback(() => {
    navigation.navigate('PhotoUpload', { obraId });
  }, [navigation, obraId]);

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.olive} />
        <Text style={styles.loadingText}>Carregando fotos...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Erro ao carregar fotos</Text>
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
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary.olive}
            colors={[colors.primary.olive]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.photoTile}
            onPress={() => handlePhotoPress(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.thumbnailUrl ?? item.imageUrl }}
              style={styles.photoImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nenhuma foto</Text>
            <Text style={styles.emptySubtitle}>
              Toque no botao + para adicionar a primeira foto desta obra.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleUploadPress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Photo detail modal */}
      <Modal
        visible={!!selectedPhoto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseModal}>
              <Text style={styles.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Large image */}
            {selectedPhoto && (
              <>
                <Image
                  source={{ uri: selectedPhoto.imageUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />

                {/* Caption */}
                {selectedPhoto.caption && (
                  <Text style={styles.modalCaption}>
                    {selectedPhoto.caption}
                  </Text>
                )}

                {/* Uploader & date */}
                <View style={styles.modalMeta}>
                  {selectedPhoto.uploader && (
                    <Text style={styles.modalUploader}>
                      {selectedPhoto.uploader.name}
                    </Text>
                  )}
                  <Text style={styles.modalDate}>
                    {formatDate(selectedPhoto.createdAt)}
                  </Text>
                </View>

                {/* Comments section */}
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsSectionTitle}>
                    Comentarios ({comments.length})
                  </Text>

                  {loadingComments ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary.olive}
                      style={styles.commentsLoading}
                    />
                  ) : comments.length === 0 ? (
                    <Text style={styles.commentsEmpty}>
                      Nenhum comentario ainda.
                    </Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {comment.user
                              ? getInitials(comment.user.name)
                              : '?'}
                          </Text>
                        </View>
                        <View style={styles.commentContent}>
                          <Text style={styles.commentAuthor}>
                            {comment.user?.name ?? 'Usuario'}
                          </Text>
                          <Text style={styles.commentBody}>
                            {comment.body}
                          </Text>
                          <Text style={styles.commentDate}>
                            {formatDate(comment.createdAt)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Comment input */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Adicionar comentario..."
              placeholderTextColor={colors.secondary.warmGray}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.commentSendButton,
                (!commentText.trim() || commentMutation.isPending) &&
                  styles.commentSendDisabled,
              ]}
              onPress={handleSendComment}
              disabled={!commentText.trim() || commentMutation.isPending}
            >
              {commentMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.secondary.white} />
              ) : (
                <Text style={styles.commentSendText}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

  // Grid
  gridContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  photoTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.secondary.sage,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
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

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 16,
    color: colors.primary.olive,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: spacing.lg,
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: colors.primary.charcoal,
  },
  modalCaption: {
    ...typography.body,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalUploader: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  modalDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Comments section
  commentsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  commentsSectionTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.md,
  },
  commentsLoading: {
    paddingVertical: spacing.lg,
  },
  commentsEmpty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary.darkTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  commentAvatarText: {
    fontFamily: typography.fonts.bold,
    fontSize: 12,
    color: colors.secondary.white,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  commentBody: {
    ...typography.bodySmall,
    color: colors.text,
    marginTop: 2,
  },
  commentDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Comment input
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.secondary.white,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.secondary.sage,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.text,
    maxHeight: 80,
    marginRight: spacing.sm,
  },
  commentSendButton: {
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  commentSendDisabled: {
    opacity: 0.5,
  },
  commentSendText: {
    fontFamily: typography.fonts.bold,
    fontSize: 13,
    color: colors.secondary.white,
  },
});
