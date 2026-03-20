import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, shadows } from '../theme/spacing';

export const TabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? String(options.tabBarLabel)
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const icon = options.tabBarIcon
          ? options.tabBarIcon({
              focused: isFocused,
              color: isFocused ? colors.primary.olive : colors.secondary.warmGray,
              size: 24,
            })
          : null;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            {icon}
            <Text
              style={[
                styles.label,
                {
                  color: isFocused
                    ? colors.primary.olive
                    : colors.secondary.warmGray,
                  fontFamily: isFocused
                    ? typography.fonts.semiBold
                    : typography.fonts.regular,
                },
              ]}
            >
              {label}
            </Text>
            {isFocused ? <View style={styles.indicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const BOTTOM_INSET = Platform.OS === 'ios' ? 20 : 0;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.secondary.white,
    borderTopWidth: 1,
    borderTopColor: colors.secondary.sage,
    paddingBottom: BOTTOM_INSET,
    ...shadows.sm,
  } as any,
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary.olive,
  },
});

export default TabBar;
