import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';

interface Photo {
  imageUrl: string;
  thumbnailUrl: string;
  caption: string;
  createdAt: string;
  uploader?: string;
}

interface PhotoCardProps {
  photo: Photo;
  onPress: () => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: photo.thumbnailUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <Text style={styles.caption} numberOfLines={2}>
          {photo.caption}
        </Text>
        {photo.uploader ? (
          <Text style={styles.uploader}>{photo.uploader}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const IMAGE_SIZE = 160;

const styles = StyleSheet.create({
  container: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  } as ViewStyle,
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.secondary.sage,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  caption: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.white,
  },
  uploader: {
    fontFamily: typography.fonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
});

export default PhotoCard;
