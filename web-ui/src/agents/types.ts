
import { FarkleEngine, DieState } from "../farkle-engine";

export type AgentAction = 'ROLL' | 'BANK';

export interface AgentMove {
    action: AgentAction;
    keepDiceIds: number[];
    explanation?: string; // Optional explanation for the move
}

export interface PlayerInfo {
    name: string;
    score: number;
    isMyTurn: boolean;
}

export interface GameState {
    message: string;
    status: string;
    turnScore: number;
    currentKeepScore: number;
    dice: {
        id: number;
        value: number;
        state: DieState;
    }[];
    players: PlayerInfo[];
}

export interface Agent {
    getNextMove(engine: FarkleEngine, onProgress?: (message: string) => void): Promise<AgentMove>;
}
