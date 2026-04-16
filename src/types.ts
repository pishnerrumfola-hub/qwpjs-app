export type GameMode = 'simulation' | 'table' | 'challenge';
export type DivisionType = 'byParts' | 'byEach';

export interface Candy {
  id: string;
  color: string;
}

export interface Plate {
  id: string;
  candies: Candy[];
}
