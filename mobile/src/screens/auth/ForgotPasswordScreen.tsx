import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import * as authService from '../../services/auth';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const isFormValid = email.trim().length > 0;

  const handleSendLink = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setIsSent(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        'Não foi possível enviar o link. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recuperar Senha</Text>
        </View>

        {isSent ? (
          /* Success State */
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={colors.success}
              />
            </View>
            <Text style={styles.successTitle}>E-mail enviado!</Text>
            <Text style={styles.successMessage}>
              Enviamos um link de recuperação para{' '}
              <Text style={styles.successEmail}>{email}</Text>. Verifique sua
              caixa de entrada e siga as instruções para redefinir sua senha.
            </Text>
            <View style={styles.successButtonWrapper}>
              <Button
                title="Voltar ao Login"
                onPress={() => navigation.navigate('Login')}
                variant="primary"
                fullWidth
                size="lg"
              />
            </View>
          </View>
        ) : (
          /* Form State */
          <View style={styles.formContainer}>
            <Text style={styles.description}>
              Informe o e-mail da sua conta e enviaremos um link para você
              redefinir sua senha.
            </Text>

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Send Link Button */}
            <View style={styles.buttonWrapper}>
              <Button
                title="Enviar Link"
                onPress={handleSendLink}
                variant="primary"
                fullWidth
                size="lg"
                loading={isLoading}
                disabled={!isFormValid}
              />
            </View>

            {/* Back to Login */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.backToLoginButton}
              disabled={isLoading}
            >
              <Text style={styles.backToLoginText}>Voltar ao Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? spacing.xxl : spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerTitle: {
    fontFamily: typography.h2.fontFamily,
    fontSize: typography.h2.fontSize,
    letterSpacing: typography.h2.letterSpacing,
    color: colors.text,
  },
  formContainer: {
    width: '100%',
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.label.fontFamily,
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: 16,
    color: colors.text,
    height: '100%',
  },
  buttonWrapper: {
    marginTop: spacing.lg,
  },
  backToLoginButton: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backToLoginText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 14,
    color: colors.secondary.darkTeal,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  successIconWrapper: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontFamily: typography.h2.fontFamily,
    fontSize: typography.h2.fontSize,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  successEmail: {
    fontFamily: typography.fonts.semiBold,
    color: colors.text,
  },
  successButtonWrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
});
