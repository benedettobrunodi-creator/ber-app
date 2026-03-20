import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface TimeEntryButtonProps {
  isCheckedIn: boolean;
  onPress: () => void;
  loading?: boolean;
}

const CHECK_IN_COLOR = '#4CAF50';
const CHECK_OUT_COLOR = colors.support.error;

export const TimeEntryButton: React.FC<TimeEntryButtonProps> = ({
  isCheckedIn,
  onPress,
  loading = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCheckedIn) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCheckedIn, pulseAnim]);

  const bgColor = isCheckedIn ? CHECK_OUT_COLOR : CHECK_IN_COLOR;
  const label = isCheckedIn ? 'CHECK OUT' : 'CHECK IN';

  return (
    <Animated.View
      style={[
        styles.outerRing,
        {
          borderColor: bgColor,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, { backgroundColor: bgColor }]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.secondary.white} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const BUTTON_SIZE = 120;

const styles = StyleSheet.create({
  outerRing: {
    width: BUTTON_SIZE + 16,
    height: BUTTON_SIZE + 16,
    borderRadius: (BUTTON_SIZE + 16) / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.fonts.bold,
    fontSize: 16,
    color: colors.secondary.white,
    letterSpacing: 1,
  },
});

export default TimeEntryButton;
