import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  Alert,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PerfilStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<PerfilStackParamList, 'Settings'>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? '1.0.0';

  const handleTogglePush = useCallback((value: boolean) => {
    setPushEnabled(value);
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } catch {
              Alert.alert('Erro', 'Nao foi possivel sair. Tente novamente.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [logout]);

  return (
    <View style={styles.container}>
      <Header title="Configuracoes" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push notifications toggle */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowTextWrapper}>
              <Text style={styles.rowLabel}>Notificacoes Push</Text>
              <Text style={styles.rowDescription}>
                Receba alertas sobre comunicados, chat e ponto.
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{
                false: colors.secondary.sage,
                true: colors.primary.olive,
              }}
              thumbColor={colors.secondary.white}
            />
          </View>
        </View>

        {/* App info */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Versao do App</Text>
            <Text style={styles.versionText}>{appVersion}</Text>
          </View>
        </View>

        {/* Spacer to push logout to bottom */}
        <View style={styles.spacer} />

        {/* Logout button */}
        <View style={styles.logoutWrapper}>
          <Button
            title="Sair"
            variant="danger"
            fullWidth
            onPress={handleLogout}
            loading={isLoggingOut}
            disabled={isLoggingOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },

  // Section card
  section: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    ...shadows.md,
  } as ViewStyle,

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowTextWrapper: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.primary.charcoal,
  },
  rowDescription: {
    fontFamily: typography.fonts.regular,
    fontSize: 13,
    color: colors.secondary.warmGray,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  versionText: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    color: colors.secondary.warmGray,
  },

  spacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },

  logoutWrapper: {
    paddingHorizontal: spacing.lg,
  },
});
