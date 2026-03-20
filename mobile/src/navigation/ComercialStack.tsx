import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ComercialStackParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ComercialDashboardScreen } from '../screens/comercial/ComercialDashboardScreen';
import { ProposalDetailScreen } from '../screens/comercial/ProposalDetailScreen';
import MeetingsScreen from '../screens/comercial/MeetingsScreen';

const Stack = createNativeStackNavigator<ComercialStackParamList>();

export function ComercialStack() {
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
        name="ComercialDashboard"
        component={ComercialDashboardScreen}
        options={{ title: 'Comercial' }}
      />
      <Stack.Screen
        name="ProposalDetail"
        component={ProposalDetailScreen}
        options={{ title: 'Proposta' }}
      />
      <Stack.Screen
        name="MeetingsScreen"
        component={MeetingsScreen}
        options={{ title: 'Reunioes' }}
      />
    </Stack.Navigator>
  );
}
