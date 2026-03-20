import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface InputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  icon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  multiline = false,
  icon,
  keyboardType,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.support.error
    : isFocused
    ? colors.primary.olive
    : colors.secondary.sage;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, { borderColor }]}>
        {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
        <TextInput
          style={[
            styles.input,
            icon ? styles.inputWithIcon : null,
            multiline ? styles.multiline : null,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.secondary.warmGray}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.primary.charcoal,
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    backgroundColor: colors.secondary.white,
  },
  iconWrapper: {
    paddingLeft: spacing.sm + 4,
  },
  input: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: 16,
    color: colors.primary.charcoal,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm + 4,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  error: {
    fontFamily: typography.fonts.regular,
    fontSize: 12,
    color: colors.support.error,
    marginTop: spacing.xs,
  },
});

export default Input;
