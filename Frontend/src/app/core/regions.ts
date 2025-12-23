export type RegionUI = 'EUW' | 'EUNE' | 'NA';

export const REGION_TO_PLATFORM: Record<RegionUI, string> = {
  EUW: 'euw1',
  EUNE: 'eun1',
  NA: 'na1',
};

export const REGION_TO_ROUTING: Record<RegionUI, string> = {
  EUW: 'europe',
  EUNE: 'europe',
  NA: 'americas',
};

// (opțional) queueId -> nume
export const QUEUE_NAMES: Record<number, string> = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
};
