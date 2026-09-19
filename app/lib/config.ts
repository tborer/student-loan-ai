import regulatory from '@/config/regulatory.json';
import providers from '@/config/providers.json';
import type { ProviderConfig, RegulatoryConfig } from '@/utils/analysis';

/**
 * The regulatory and provider tables the analysis engine runs against.
 *
 * Per the spec these are config-driven rather than hardcoded, so the rules
 * can be refreshed as RAP/IBR/PSLF change without touching engine code.
 */
export const analysisConfig: RegulatoryConfig & ProviderConfig = {
  ...regulatory,
  ...providers,
};
