import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ComunicadosStackParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { AnnouncementsListScreen } from '../screens/comunicados/AnnouncementsListScreen';
import { AnnouncementDetailScreen } from '../screens/comunicados/AnnouncementDetailScreen';

const Stack = createNativeStackNavigator<ComunicadosStackParamList>();

export function ComunicadosStack() {
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
        name="AnnouncementsList"
        component={AnnouncementsListScreen}
        options={{ title: 'Comunicados' }}
      />
      <Stack.Screen
        name="AnnouncementDetail"
        component={AnnouncementDetailScreen}
        options={{ title: 'Comunicado' }}
      />
    </Stack.Navigator>
  );
}
