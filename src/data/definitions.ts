/**
 * Definition 데이터. 브리핑 4절에 따라 2개만 만든다 (30개 채우기는 하지 않는다).
 *
 * namePool이 여러 개인 이유는 규칙 8이다. 같은 Definition을 두 번 소환하면
 * 다른 이름·다른 성격의 개체가 나와야 한다.
 */

import type { CharacterDefinition } from '../core/definition.js';
import { definitionId } from '../core/ids.js';

export const VANGUARD: CharacterDefinition = {
  definitionId: definitionId('vanguard'),
  archetype: '선봉',
  namePool: ['라온', '세인', '도하', '유진'],
  personalityRanges: {
    risk: { min: 40, max: 60 },
    loyalty: { min: 50, max: 90 },
    sociability: { min: 30, max: 70 },
    aggression: { min: 45, max: 75 },
    honesty: { min: 30, max: 80 },
  },
  baseHealth: 100,
};

export const SCOUT: CharacterDefinition = {
  definitionId: definitionId('scout'),
  archetype: '정찰',
  namePool: ['미라', '세라', '노아', '이린'],
  personalityRanges: {
    risk: { min: 45, max: 75 },
    loyalty: { min: 40, max: 80 },
    sociability: { min: 40, max: 80 },
    aggression: { min: 30, max: 60 },
    honesty: { min: 40, max: 90 },
  },
  baseHealth: 80,
};

export const ALL_DEFINITIONS: readonly CharacterDefinition[] = [VANGUARD, SCOUT];
