
import { GoogleGenAI } from "@google/genai";
import { Agent, AgentMove, GameState } from "./types";
import { FarkleEngine } from "../farkle-engine";
import rulesMd from "../FarkleRules.md?raw";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = "gemini-3-flash-preview";

export class GeminiAgent implements Agent {
    private client: GoogleGenAI;

    constructor() {
        if (!API_KEY) {
            console.error("VITE_GEMINI_API_KEY is missing!");
        }
        this.client = new GoogleGenAI({ apiKey: API_KEY });
    }

    async getNextMove(engine: FarkleEngine, onProgress?: (message: string) => void): Promise<AgentMove> {
        // Construct Game State JSON
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

        const prompt = `
        You are an expert Farkle player. 
        Your goal is to win the game by reaching 10,000 points.
        
        RULES CONTEXT:
        ${rulesMd}
        
        CURRENT GAME STATE:
        ${JSON.stringify(gameState, null, 2)}
        
        INSTRUCTIONS:
        1. Analyze the dice and scores.
        2. Select which dice to KEEP (must be scoring dice).
        3. Decide whether to BANK the points or ROLL again.
        
        Output a valid JSON object.
        `;

        const responseSchema = {
            type: "OBJECT",
            properties: {
                explanation: { type: "STRING" },
                keepDiceIds: { type: "ARRAY", items: { type: "INTEGER" } },
                action: { type: "STRING", enum: ["ROLL", "BANK"] }
            },
            required: ["keepDiceIds", "action"]
        };

        // Retry config
        const MAX_RETRIES = 50; // Effectively infinite for user perception
        const BASE_DELAY = 1000;

        const generateWithRetry = async (retries = MAX_RETRIES, delay = BASE_DELAY): Promise<any> => {
            try {
                const response = await this.client.models.generateContent({
                    model: MODEL_NAME,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        thinkingConfig: {
                            thinkingLevel: "MEDIUM" as any 
                        }
                    },
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                });

                const text = response.text;
                if (!text) throw new Error("Empty response from Gemini");
                return JSON.parse(text);
            } catch (error: any) {
                // Check for transient errors: 429, 500, 502, 503, 504
                const isTransient = 
                    error.status === 429 || 
                    error.status === 503 || 
                    (error.status >= 500 && error.status < 600) ||
                    (error.message && (error.message.includes('429') || error.message.includes('503')));

                if (isTransient && retries > 0) {
                    const attempt = MAX_RETRIES - retries + 1;
                    const msg = `Connection issue (503/429). Retrying in ${delay/1000}s... (Attempt ${attempt})`;
                    console.warn(`Gemini Agent: ${msg}`);
                    
                    if (onProgress) {
                        onProgress(msg);
                    }

                    await new Promise(r => setTimeout(r, delay));
                    // Cap delay at 30 seconds to avoid overly long waits? Or keep doubling?
                    // Let's cap at 16s to be reasonable.
                    const nextDelay = Math.min(delay * 2, 16000); 
                    return generateWithRetry(retries - 1, nextDelay);
                }
                throw error;
            }
        };

        try {
            const result = await generateWithRetry();

            return {
                keepDiceIds: result.keepDiceIds || [],
                action: result.action as 'ROLL' | 'BANK',
                explanation: result.explanation
            };

        } catch (error) {
            console.error("Gemini Agent Error (Final):", error);
            throw error; 
        }
    }
}
