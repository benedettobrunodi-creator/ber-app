import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PerfilStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { Header } from '../../components/Header';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<PerfilStackParamList, 'Profile'>;

interface MenuItem {
  key: string;
  label: string;
  screen: keyof PerfilStackParamList;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  diretoria: 'Diretoria',
  coordenacao: 'Coordenacao',
  gestor: 'Gestor',
  campo: 'Campo',
};

const MENU_ITEMS: MenuItem[] = [
  { key: 'timeEntries', label: 'Registro de Ponto', screen: 'TimeEntries' },
  { key: 'notifications', label: 'Notificacoes', screen: 'Notifications' },
  { key: 'settings', label: 'Configuracoes', screen: 'Settings' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);

  const handleNavigate = useCallback(
    (screen: keyof PerfilStackParamList) => {
      navigation.navigate(screen as any);
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <Header title="Perfil" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & basic info */}
        <View style={styles.profileHeader}>
          <Avatar
            uri={user?.avatarUrl}
            name={user?.name ?? 'Usuario'}
            size={100}
          />

          <Text style={styles.name}>{user?.name ?? 'Usuario'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>

          {user?.role && (
            <Badge
              label={ROLE_LABELS[user.role] ?? user.role}
              color={colors.secondary.darkTeal}
            />
          )}

          {user?.phone && (
            <Text style={styles.phone}>{user.phone}</Text>
          )}
        </View>

        {/* Edit profile button */}
        <View style={styles.editButtonWrapper}>
          <Button
            title="Editar Perfil"
            variant="outline"
            fullWidth
            onPress={() => {
              // TODO: navigate to EditProfile screen
            }}
          />
        </View>

        {/* Menu items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          ))}
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
    paddingBottom: spacing.xxl,
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.secondary.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.h2,
    color: colors.primary.charcoal,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  email: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  phone: {
    fontFamily: typography.fonts.regular,
    fontSize: 14,
    color: colors.secondary.warmGray,
    marginTop: spacing.sm,
  },

  // Edit button
  editButtonWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Menu
  menuSection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    backgroundColor: colors.secondary.white,
    borderRadius: borderRadius.md,
    ...shadows.md,
  } as ViewStyle,
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 15,
    color: colors.primary.charcoal,
  },
  menuArrow: {
    fontSize: 24,
    color: colors.secondary.warmGray,
    fontFamily: typography.fonts.regular,
  },
});
