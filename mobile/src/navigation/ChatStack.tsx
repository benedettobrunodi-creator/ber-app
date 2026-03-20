import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ChatStackParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ChatRoomsScreen } from '../screens/chat/ChatRoomsScreen';
import { ConversationScreen } from '../screens/chat/ConversationScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
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
        name="ChatRooms"
        component={ChatRoomsScreen}
        options={{ title: 'Conversas' }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={({ route }) => ({
          title: route.params.roomName,
        })}
      />
    </Stack.Navigator>
  );
}
