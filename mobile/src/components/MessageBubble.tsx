import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface Message {
  body: string;
  createdAt: string;
  sender?: string;
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
}) => {
  return (
    <View
      style={[
        styles.wrapper,
        isMine ? styles.wrapperMine : styles.wrapperTheirs,
      ]}
    >
      {!isMine && message.sender ? (
        <Text style={styles.sender}>{message.sender}</Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text
          style={[styles.body, isMine ? styles.bodyMine : styles.bodyTheirs]}
        >
          {message.body}
        </Text>
      </View>
      <Text
        style={[styles.time, isMine ? styles.timeMine : styles.timeTheirs]}
      >
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  wrapperMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapperTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  sender: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 12,
    color: colors.secondary.darkTeal,
    marginBottom: 2,
    marginLeft: spacing.xs,
  },
  bubble: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
  },
  bubbleMine: {
    backgroundColor: colors.primary.olive,
    borderBottomRightRadius: spacing.xs,
  },
  bubbleTheirs: {
    backgroundColor: colors.secondary.sage,
    borderBottomLeftRadius: spacing.xs,
  },
  body: {
    fontFamily: typography.fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  bodyMine: {
    color: colors.secondary.white,
  },
  bodyTheirs: {
    color: colors.primary.charcoal,
  },
  time: {
    fontFamily: typography.fonts.regular,
    fontSize: 11,
    color: colors.secondary.warmGray,
    marginTop: 2,
  },
  timeMine: {
    marginRight: spacing.xs,
  },
  timeTheirs: {
    marginLeft: spacing.xs,
  },
});

export default MessageBubble;
