
import Cookies from 'js-cookie';
import { Agent, AgentMove, GameState } from "./types";
import { FarkleEngine } from "../farkle-engine";

export class CustomAgent implements Agent {
    private getUri(playerIndex: number): string | undefined {
        return Cookies.get(`custom_agent_uri_p${playerIndex}`);
    }

    setUri(playerIndex: number, uri: string) {
        Cookies.set(`custom_agent_uri_p${playerIndex}`, uri, { expires: 365 });
    }

    async getNextMove(engine: FarkleEngine, onProgress?: (message: string) => void): Promise<AgentMove> {
        const playerIndex = engine.currentPlayerIndex;
        const uri = this.getUri(playerIndex);

        if (!uri) {
            throw new Error("No API URI configured for this player.");
        }

        if (onProgress) {
            onProgress(`Calling Custom API: ${uri}...`);
        }

        // Construct Game State
        const gameState: GameState = {
            message: engine.message,
            status: engine.status,
            turnScore: engine.turnScore,
            currentKeepScore: engine.currentKeepScore,
            dice: engine.dice.map(d => ({
                id: d.id,
                value: d.value,
                state: d.state
            })),
            players: engine.players.map(p => ({
                name: p.name,
                score: p.score,
                isMyTurn: p.id === engine.currentPlayerIndex
            }))
        };

        try {
            const response = await fetch(uri, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gameState),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
            }

            const move: AgentMove = await response.json();

            // Basic validation
            if (!move || typeof move.action !== 'string' || !Array.isArray(move.keepDiceIds)) {
                throw new Error("Invalid response format from API. Expected AgentMove.");
            }

            return move;
        } catch (error: any) {
            console.error("Custom Agent Error:", error);
            throw error;
        }
    }
}
