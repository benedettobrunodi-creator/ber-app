import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelStage {
  name: string;
  count: number;
  value: number;
}

interface Props {
  stages: FunnelStage[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered stage names for the DNN funnel (sequence 1–9) */
export const DNN_STAGE_ORDER = [
  'Leads - Informações de mercado',
  'Leads - Aguardando entrada',
  'Contato / Identificação de interesse',
  'ANALISE DE GO X NO GO',
  'GO - Aguardando para inicio de orcamento',
  'Proposta em desenvolvimento',
  'Enviadas - Probabilidade Alta',
  'Enviadas - Probabilidade Media',
  'Enviadas - Probabilidade Baixa',
] as const;

/** Short labels for display */
const SHORT_LABELS: Record<string, string> = {
  'Leads - Informações de mercado': 'Info. Mercado',
  'Leads - Aguardando entrada': 'Aguard. Entrada',
  'Contato / Identificação de interesse': 'Contato / Interesse',
  'ANALISE DE GO X NO GO': 'Go x No Go',
  'GO - Aguardando para inicio de orcamento': 'Aguard. Orçamento',
  'Proposta em desenvolvimento': 'Em Desenvolvimento',
  'Enviadas - Probabilidade Alta': 'Prob. Alta',
  'Enviadas - Probabilidade Media': 'Prob. Média',
  'Enviadas - Probabilidade Baixa': 'Prob. Baixa',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Interpolate between olive (#B5B820) and charcoal (#2D2D2D) */
function interpolateColor(ratio: number): string {
  const r = Math.round(0xb5 + (0x2d - 0xb5) * ratio);
  const g = Math.round(0xb8 + (0x2d - 0xb8) * ratio);
  const b = Math.round(0x20 + (0x2d - 0x20) * ratio);
  return `rgb(${r},${g},${b})`;
}

function formatCompactBRL(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MIN_WIDTH_PERCENT = 30;
const MAX_WIDTH_PERCENT = 100;

function FunnelChart({ stages }: Props) {
  const maxCount = useMemo(
    () => Math.max(...stages.map((s) => s.count), 1),
    [stages],
  );

  if (stages.length === 0) return null;

  return (
    <View style={funnelStyles.container}>
      {stages.map((stage, index) => {
        const ratio = index / Math.max(stages.length - 1, 1);
        const bg = interpolateColor(ratio);
        const widthPercent =
          MIN_WIDTH_PERCENT +
          (stage.count / maxCount) * (MAX_WIDTH_PERCENT - MIN_WIDTH_PERCENT);
        const label = SHORT_LABELS[stage.name] ?? stage.name;

        return (
          <View key={stage.name} style={funnelStyles.row}>
            <View
              style={[
                funnelStyles.bar,
                {
                  width: `${widthPercent}%`,
                  backgroundColor: bg,
                },
              ]}
            >
              <Text
                style={funnelStyles.barLabel}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
              <Text style={funnelStyles.barCount}>{stage.count}</Text>
            </View>
            <Text style={funnelStyles.valueLabel}>
              {formatCompactBRL(stage.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(FunnelChart);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const funnelStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 3,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    minHeight: 32,
  },
  barLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: 11,
    color: colors.secondary.white,
    flex: 1,
    marginRight: spacing.xs,
  },
  barCount: {
    fontFamily: typography.fonts.bold,
    fontSize: 13,
    color: colors.secondary.white,
  },
  valueLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    minWidth: 60,
  },
});
