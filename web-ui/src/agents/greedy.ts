
import { FarkleEngine } from "../farkle-engine";
import { Agent, AgentMove } from "./types";

export class GreedyAgent implements Agent {
    async getNextMove(engine: FarkleEngine, onProgress?: (message: string) => void): Promise<AgentMove> {
        // Simulate thinking time
        await new Promise(r => setTimeout(r, 1000));

        // Get current state from engine
        const rolled = engine.dice.filter(d => d.state === 'rolled');
        const counts = this.getCounts(rolled);
        const aiKeeps: number[] = [];

        // Logic: Keep MAX scoring dice
        const findIds = (val: number): number[] => {
            return rolled.filter(d => d.value === val).map(d => d.id);
        };

        // 1. Triples / 4x / 5x / 6x
        for (let i = 1; i <= 6; i++) {
            const count = counts[i] || 0;
            if (count >= 3) {
                // Keep ALL of them
                aiKeeps.push(...findIds(i));
                counts[i] = 0; // Consumed
            }
        }

        // 2. Singles (1s and 5s)
        [1, 5].forEach(val => {
            if (counts[val] > 0) {
                aiKeeps.push(...findIds(val));
            }
        });

        // Current decision: BANK immediately after keeping if score > 0
        // BUT, engine requires us to provide dice to keep.
        // Returning action 'BANK' means we keep these dice THEN bank.
        // Or if we roll again?
        // Greedy Strategy: Always Bank unless forced to roll? Or strict threshold?
        // Original logic was: Keep max scoring -> Bank.

        // Wait, if no scoring dice -> Farkle. But engine handles Farkle check *before* move?
        // No, engine is in 'rolling' state after roll.
        // If farkle happened, engine status is 'farkle'.
        // So we just need to return 'BANK' if we have score.

        return {
            keepDiceIds: aiKeeps,
            action: 'BANK',
            explanation: "I'll take the points and run!"
        };
    }

    private getCounts(dice: { value: number }[]): Record<number, number> {
        const counts: Record<number, number> = {};
        dice.forEach(d => counts[d.value] = (counts[d.value] || 0) + 1);
        return counts;
    }
}
