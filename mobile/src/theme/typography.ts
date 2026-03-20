export const typography = {
  fonts: {
    regular: 'Montserrat_400Regular',
    semiBold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
    black: 'Montserrat_900Black',
  },

  h1: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 28,
    letterSpacing: -0.5,
  },

  h2: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
  },

  h3: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 18,
    letterSpacing: 0,
  },

  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
  },

  bodySmall: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },

  caption: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    letterSpacing: 0.2,
  },

  button: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  label: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.3,
  },
} as const;
