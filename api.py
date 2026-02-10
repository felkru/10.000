import os
import sys
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from stable_baselines3 import PPO

# Add src to sys.path to find farkle_core and farkle_env
sys.path.append(os.path.join(os.getcwd(), "src"))
import farkle_core

# Model path
MODEL_PATH = "checkpoints/farkle_ppo_mvp.zip"
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    global model
    if os.path.exists(MODEL_PATH):
        model = PPO.load(MODEL_PATH)
        print(f"Model loaded from {MODEL_PATH}")
    else:
        print(f"Model not found at {MODEL_PATH}. API will return random moves.")
    yield
    # Clean up the ML model and release the resources
    model = None

app = FastAPI(title="Zehntausend Custom Agent API", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev; narrow down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas from custom-agent-api.json
class Die(BaseModel):
    id: int
    value: int
    state: str

class PlayerInfo(BaseModel):
    name: str
    score: int
    isMyTurn: bool

class GameState(BaseModel):
    message: str
    status: str
    turnScore: int
    currentKeepScore: int
    dice: List[Die]
    players: List[PlayerInfo]

class AgentMove(BaseModel):
    action: str
    keepDiceIds: List[int]
    explanation: Optional[str] = None

def get_obs_from_state(state: GameState):
    obs = np.zeros(16, dtype=np.float32)
    state_map = {"rolled": 0, "kept": 1, "banked": 2}
    
    # Sort dice by ID to ensure consistent mapping to the observation vector
    sorted_dice = sorted(state.dice, key=lambda d: d.id)
    
    for d in state.dice:
        if d.id < 6:
            obs[d.id] = d.value / 6.0
            obs[d.id + 6] = state_map.get(d.state, 0) / 2.0
    
    # Identify which player is "me"
    me = next((p for p in state.players if p.isMyTurn), state.players[0])
    # Identify opponent
    opponent = next((p for p in state.players if not p.isMyTurn), state.players[0])
    
    obs[12] = state.turnScore / 10000.0
    obs[13] = state.currentKeepScore / 10000.0
    obs[14] = me.score / 10000.0
    obs[15] = opponent.score / 10000.0
    return obs

@app.post("/move", response_model=AgentMove)
async def get_move(state: GameState):
    global model
    
    # Sort once here to use for both observation and action mapping
    sorted_dice = sorted(state.dice, key=lambda d: d.id)
    
    if model:
        obs = get_obs_from_state(state)
        action, _states = model.predict(obs, deterministic=True)
    else:
        # Fallback to random if no model
        action = np.random.randint(0, 128)
    
    is_bank = action >= 64
    mask = action % 64
    
    keep_dice_ids = []
    for i in range(min(6, len(sorted_dice))):
        if (mask >> i) & 1:
            keep_dice_ids.append(sorted_dice[i].id)
    
    return AgentMove(
        action="BANK" if is_bank else "ROLL",
        keepDiceIds=keep_dice_ids,
        explanation=f"RL Agent decision (mask={mask}, total_dice={len(sorted_dice)})"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
