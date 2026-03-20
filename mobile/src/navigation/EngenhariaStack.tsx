import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { EngenhariaStackParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ObrasListScreen } from '../screens/engenharia/ObrasListScreen';
import { ObraDetailScreen } from '../screens/engenharia/ObraDetailScreen';
import { KanbanBoardScreen } from '../screens/engenharia/KanbanBoardScreen';
import { PhotoGalleryScreen } from '../screens/engenharia/PhotoGalleryScreen';
import { PhotoUploadScreen } from '../screens/engenharia/PhotoUploadScreen';

const Stack = createNativeStackNavigator<EngenhariaStackParamList>();

export function EngenhariaStack() {
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
        name="ObrasList"
        component={ObrasListScreen}
        options={{ title: 'Obras' }}
      />
      <Stack.Screen
        name="ObraDetail"
        component={ObraDetailScreen}
        options={{ title: 'Obra' }}
      />
      <Stack.Screen
        name="KanbanBoard"
        component={KanbanBoardScreen}
        options={{ title: 'Kanban' }}
      />
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={{ title: 'Fotos' }}
      />
      <Stack.Screen
        name="PhotoUpload"
        component={PhotoUploadScreen}
        options={{ title: 'Enviar Foto' }}
      />
    </Stack.Navigator>
  );
}
