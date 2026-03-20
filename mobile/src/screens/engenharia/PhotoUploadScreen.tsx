import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EngenhariaStackParamList } from '../../navigation/types';
import { uploadPhoto } from '../../services/photos';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<EngenhariaStackParamList, 'PhotoUpload'>;

interface SelectedImage {
  uri: string;
  fileName: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhotoUploadScreen({ route, navigation }: Props) {
  const { obraId } = route.params;
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [caption, setCaption] = useState('');

  // ── Mutation ────────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) throw new Error('Nenhuma imagem selecionada');

      const formData = new FormData();
      formData.append('image', {
        uri: selectedImage.uri,
        name: selectedImage.fileName,
        type: selectedImage.type,
      } as any);

      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      return uploadPhoto(obraId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', obraId] });
      Alert.alert('Sucesso', 'Foto enviada com sucesso!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err) => {
      Alert.alert(
        'Erro',
        (err as Error)?.message ?? 'Nao foi possivel enviar a foto.',
      );
    },
  });

  // ── Image picker ────────────────────────────────────────────────────────

  const handlePickImage = useCallback(() => {
    Alert.alert('Selecionar Imagem', 'Escolha a origem da imagem:', [
      {
        text: 'Camera',
        onPress: () => launchCamera(),
      },
      {
        text: 'Galeria',
        onPress: () => launchGallery(),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, []);

  const launchCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissao necessaria',
        'Permita o acesso a camera para tirar fotos.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
    }
  };

  const launchGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissao necessaria',
        'Permita o acesso a galeria para selecionar fotos.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!selectedImage) {
      Alert.alert('Atenção', 'Selecione uma imagem antes de enviar.');
      return;
    }
    uploadMutation.mutate();
  }, [selectedImage, uploadMutation]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image picker area */}
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={handlePickImage}
          activeOpacity={0.7}
          disabled={uploadMutation.isPending}
        >
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderIcon}>+</Text>
              <Text style={styles.placeholderText}>
                Toque para selecionar uma foto
              </Text>
              <Text style={styles.placeholderSubtext}>
                Camera ou galeria
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Change image button if image selected */}
        {selectedImage && (
          <TouchableOpacity
            style={styles.changeImageButton}
            onPress={handlePickImage}
            disabled={uploadMutation.isPending}
          >
            <Text style={styles.changeImageText}>Trocar imagem</Text>
          </TouchableOpacity>
        )}

        {/* Caption input */}
        <View style={styles.captionSection}>
          <Text style={styles.captionLabel}>Legenda</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Descreva a foto (opcional)..."
            placeholderTextColor={colors.secondary.warmGray}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
            editable={!uploadMutation.isPending}
          />
          <Text style={styles.charCount}>{caption.length}/300</Text>
        </View>

        {/* Upload progress */}
        {uploadMutation.isPending && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color={colors.primary.olive} />
            <Text style={styles.uploadProgressText}>Enviando foto...</Text>
          </View>
        )}

        {/* Submit button */}
        <View style={styles.submitSection}>
          <Button
            title="Enviar"
            onPress={handleSubmit}
            variant="primary"
            fullWidth
            size="lg"
            loading={uploadMutation.isPending}
            disabled={!selectedImage || uploadMutation.isPending}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Image picker
  imagePicker: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondary.sage,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeholderIcon: {
    fontSize: 48,
    color: colors.secondary.warmGray,
    fontFamily: typography.fonts.bold,
  },
  placeholderText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  placeholderSubtext: {
    ...typography.caption,
    color: colors.secondary.warmGray,
  },

  // Change image
  changeImageButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  changeImageText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },

  // Caption
  captionSection: {
    marginTop: spacing.lg,
  },
  captionLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  captionInput: {
    backgroundColor: colors.secondary.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    ...shadows.sm,
  } as any,
  charCount: {
    ...typography.caption,
    color: colors.secondary.warmGray,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Upload progress
  uploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F5F7F0',
    borderRadius: borderRadius.md,
  },
  uploadProgressText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },

  // Submit
  submitSection: {
    marginTop: spacing.xl,
  },
});
