export type TermDays = 7 | 30 | 180 | 365;
export type TermKey = 'd7' | 'd30' | 'd180' | 'd365';

export function termKeyFromDays(termDays: TermDays): TermKey {
  switch (termDays) {
    case 7:
      return 'd7';
    case 30:
      return 'd30';
    case 180:
      return 'd180';
    case 365:
      return 'd365';
    default:
      // This should never happen because termDays is a union type
      throw new Error(`Unsupported term: ${termDays}`);
  }
}

