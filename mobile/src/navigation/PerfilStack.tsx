import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { PerfilStackParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { TimeEntriesScreen } from '../screens/profile/TimeEntriesScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';

const Stack = createNativeStackNavigator<PerfilStackParamList>();

export function PerfilStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.secondary.white },
        headerTitleStyle: {
          fontFamily: typography.fonts.semiBold,
          fontSize: 18,
          color: colors.primary.charcoal,
        },
        headerTintColor: colors.primary.charcoal,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configuracoes' }}
      />
      <Stack.Screen
        name="TimeEntries"
        component={TimeEntriesScreen}
        options={{ title: 'Ponto' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notificacoes' }}
      />
    </Stack.Navigator>
  );
}
