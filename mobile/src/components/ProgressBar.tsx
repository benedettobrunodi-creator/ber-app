import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = false,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.container}>
      {showLabel ? (
        <Text style={styles.label}>{Math.round(clampedProgress)}%</Text>
      ) : null}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              height,
              width: `${clampedProgress}%`,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.primary.charcoal,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  track: {
    width: '100%',
    backgroundColor: colors.secondary.sage,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary.olive,
    borderRadius: borderRadius.full,
  },
});

export default ProgressBar;
