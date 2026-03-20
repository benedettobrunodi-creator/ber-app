import type { NavigatorScreenParams } from '@react-navigation/native';

// ──────────────────────────────────────────────
// Auth Stack
// ──────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

// ──────────────────────────────────────────────
// Feature Stacks
// ──────────────────────────────────────────────

export type ComercialStackParamList = {
  ComercialDashboard: undefined;
  ProposalDetail: { proposalId: string };
  MeetingsScreen: undefined;
};

export type EngenhariaStackParamList = {
  ObrasList: undefined;
  ObraDetail: { obraId: string };
  KanbanBoard: { obraId: string };
  PhotoGallery: { obraId: string };
  PhotoUpload: { obraId: string; taskId?: string };
};

export type ComunicadosStackParamList = {
  AnnouncementsList: undefined;
  AnnouncementDetail: { announcementId: string };
};

export type ChatStackParamList = {
  ChatRooms: undefined;
  Conversation: { roomId: string; roomName: string };
};

export type PerfilStackParamList = {
  Profile: undefined;
  Settings: undefined;
  TimeEntries: undefined;
  Notifications: undefined;
};

// ──────────────────────────────────────────────
// Main Tabs
// ──────────────────────────────────────────────

export type MainTabsParamList = {
  Comercial: NavigatorScreenParams<ComercialStackParamList>;
  Engenharia: NavigatorScreenParams<EngenhariaStackParamList>;
  Comunicados: NavigatorScreenParams<ComunicadosStackParamList>;
  Chat: NavigatorScreenParams<ChatStackParamList>;
  Perfil: NavigatorScreenParams<PerfilStackParamList>;
};

// ──────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
};

// ──────────────────────────────────────────────
// Global declaration for useNavigation typing
// ──────────────────────────────────────────────

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
