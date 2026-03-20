import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  size?: BadgeSize;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = colors.primary.olive,
  textColor = colors.secondary.white,
  size = 'md',
}) => {
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: color },
        isSmall ? styles.small : styles.medium,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
          isSmall ? styles.textSmall : styles.textMedium,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
  small: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  medium: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 4,
  },
  text: {
    fontFamily: typography.fonts.semiBold,
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
});

export default Badge;
