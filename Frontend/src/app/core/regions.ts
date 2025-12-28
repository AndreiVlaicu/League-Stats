export type RegionUI = 'EUW' | 'EUNE' | 'NA' | 'KR' | 'BR' | 'JP' | 'OCE' | 'TR' | 'RU' | 'LAN' | 'LAS';

export const REGION_TO_PLATFORM: Record<RegionUI, string> = {
  EUW: 'euw1',
  EUNE: 'eun1',
  NA: 'na1',
  KR: 'kr',
  BR: 'br1',
  JP: 'jp1',
  OCE: 'oc1',
  TR: 'tr1',
  RU: 'ru',
  LAN: 'la1',
  LAS: 'la2',
};

export const REGION_TO_ROUTING: Record<RegionUI, string> = {
  EUW: 'europe',
  EUNE: 'europe',
  NA: 'americas',
  KR: 'asia',
  BR: 'americas',
  JP: 'asia',
  OCE: 'sea',
  TR: 'europe',
  RU: 'europe',
  LAN: 'americas',
  LAS: 'americas',
};

// (opțional) queueId -> nume
export const QUEUE_NAMES: Record<number, string> = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
};
