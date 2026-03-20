import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { MainTabsParamList } from './types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotificationStore } from '../stores/notificationStore';

import { ComercialStack } from './ComercialStack';
import { EngenhariaStack } from './EngenhariaStack';
import { ComunicadosStack } from './ComunicadosStack';
import { ChatStack } from './ChatStack';
import { PerfilStack } from './PerfilStack';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// ──────────────────────────────────────────────
// Tab icon component (text-based, no icon lib)
// ──────────────────────────────────────────────

const TAB_ICONS: Record<keyof MainTabsParamList, string> = {
  Comercial: '\u2696',    // balance scale
  Engenharia: '\u2692',   // hammer & pick
  Comunicados: '\u{1F4E2}', // loudspeaker
  Chat: '\u{1F4AC}',      // speech balloon
  Perfil: '\u{1F464}',    // bust in silhouette
};

function TabIcon({ name, focused }: { name: keyof MainTabsParamList; focused: boolean }) {
  return (
    <Text
      style={[
        styles.tabIcon,
        { color: focused ? colors.primary.olive : colors.primary.charcoal },
      ]}
    >
      {TAB_ICONS[name]}
    </Text>
  );
}

// ──────────────────────────────────────────────
// Badge component for Chat tab
// ──────────────────────────────────────────────

function ChatBadge() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  if (unreadCount <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// MainTabs navigator
// ──────────────────────────────────────────────

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.olive,
        tabBarInactiveTintColor: colors.primary.charcoal,
        tabBarLabelStyle: {
          fontFamily: typography.fonts.semiBold,
          fontSize: 11,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          backgroundColor: colors.secondary.white,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Comercial"
        component={ComercialStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Comercial" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Engenharia"
        component={EngenhariaStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Engenharia" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Comunicados"
        component={ComunicadosStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Comunicados" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon name="Chat" focused={focused} />
              <ChatBadge />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Perfil" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.secondary.white,
    fontFamily: typography.fonts.bold,
    fontSize: 10,
    textAlign: 'center',
  },
});
