import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing, borderRadius, shadows } from '../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentBorder?: boolean;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  accentBorder = false,
  onPress,
}) => {
  const cardStyle = [
    styles.container,
    accentBorder && styles.accentBorder,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.md,
  } as ViewStyle,
  accentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.olive,
  },
});

export default Card;
