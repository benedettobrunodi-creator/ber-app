import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, rightAction }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.left}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backArrow}>{'\u2039'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.right}>
          {rightAction ? (
            <TouchableOpacity onPress={rightAction.onPress}>
              <Text style={styles.rightActionText}>{rightAction.label}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>
    </View>
  );
};

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight ?? 0;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary.white,
    paddingTop: STATUSBAR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary.sage,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.md,
  },
  left: {
    width: 60,
    alignItems: 'flex-start',
  },
  right: {
    width: 60,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: spacing.xs,
  },
  backArrow: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.primary.charcoal,
    fontFamily: typography.fonts.regular,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fonts.bold,
    fontSize: 18,
    color: colors.primary.charcoal,
  },
  rightActionText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.olive,
  },
  placeholder: {
    width: 40,
  },
});

export default Header;
