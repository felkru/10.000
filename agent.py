import os
import sys
import argparse
import optuna
import numpy as np
import uvicorn
from fastapi import FastAPI
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback

# Add src to sys.path
sys.path.append(os.path.join(os.getcwd(), "src"))
from farkle_env import FarkleEnv

# --- Callbacks ---

class FarkleMetricsCallback(BaseCallback):
    def __init__(self, verbose=0):
        super(FarkleMetricsCallback, self).__init__(verbose)
        self.legal_moves = 0
        self.total_moves = 0
        self.total_points = 0
        self.turns_ended = 0
        self.wins = 0
        self.games_ended = 0

    def _on_step(self) -> bool:
        for info in self.locals['infos']:
            if info.get('legal_move'):
                self.legal_moves += 1
            self.total_moves += 1
            
            if "turn_points" in info:
                self.total_points += info["turn_points"]
                self.turns_ended += 1
            
            if info.get("win"):
                self.wins += 1
                self.games_ended += 1
            elif self.locals['dones'][0]: # Simplified game end check
                self.games_ended += 1
        return True

    def _on_rollout_end(self) -> None:
        legal_ratio = self.legal_moves / self.total_moves if self.total_moves > 0 else 0
        avg_points = self.total_points / self.turns_ended if self.turns_ended > 0 else 0
        win_rate = self.wins / self.games_ended if self.games_ended > 0 else 0
        
        self.logger.record("train/legal_move_ratio", legal_ratio)
        self.logger.record("train/avg_points_per_turn", avg_points)
        self.logger.record("train/win_percentage", win_rate * 100)
        
        # Reset for next rollout
        self.legal_moves = 0
        self.total_moves = 0
        self.total_points = 0
        self.turns_ended = 0
        self.wins = 0
        self.games_ended = 0

    @property
    def legal_ratio(self):
        return self.legal_moves / self.total_moves if self.total_moves > 0 else 0

def count_parameters(model):
    return sum(p.numel() for p in model.policy.parameters() if p.requires_grad)

# --- Optuna Objective ---

def objective(trial, tune_timesteps=200000):
    lr = trial.suggest_float("learning_rate", 1e-4, 5e-3, log=True)
    ent_coef = trial.suggest_float("ent_coef", 0.001, 0.1, log=True)
    clip_range = trial.suggest_float("clip_range", 0.1, 0.4)
    n_steps = trial.suggest_categorical("n_steps", [512, 1024, 2048])
    batch_size = trial.suggest_categorical("batch_size", [32, 64, 128])
    penalty = trial.suggest_float("illegal_action_penalty", 10.0, 200.0)
    
    # Tunable Architecture
    n_layers = trial.suggest_int("n_layers", 1, 3)
    layer_size = trial.suggest_categorical("layer_size", [32, 64, 128, 256])
    net_arch = [layer_size] * n_layers
    policy_kwargs = dict(net_arch=dict(pi=net_arch, vf=net_arch))

    env = make_vec_env(lambda: FarkleEnv(illegal_action_penalty=penalty), n_envs=4)
    model = PPO(
        "MlpPolicy", env, verbose=0,
        learning_rate=lr, ent_coef=ent_coef,
        clip_range=clip_range, n_steps=n_steps,
        batch_size=batch_size,
        policy_kwargs=policy_kwargs,
        tensorboard_log="./tensorboard/"
    )
    
    params_count = count_parameters(model)
    print(f"🔹 Trial {trial.number}: Layers={n_layers}, Size={layer_size}, Params={params_count:,}")

    # Use full metrics callback even for tuning to see progress in TensorBoard
    metrics_callback = FarkleMetricsCallback()
    model.learn(
        total_timesteps=tune_timesteps, 
        callback=metrics_callback,
        tb_log_name=f"trial_{trial.number}"
    )
    
    return metrics_callback.legal_ratio # We need to use the property from the callback

# --- Actions ---

def run_tune(trials=10, final_timesteps=500000, tune_timesteps=200000):
    print(f"🚀 Starting AutoML Tuning ({trials} trials, {tune_timesteps} steps each)...")
    study = optuna.create_study(direction="maximize")
    study.optimize(lambda t: objective(t, tune_timesteps), n_trials=trials)

    print("\n🏆 Best Hyperparameters:")
    for key, value in study.best_params.items():
        print(f"  {key}: {value}")

    print(f"\n🏋️ Running final training for {final_timesteps} steps...")
    best = study.best_params
    
    # Reconstruct best net_arch
    net_arch = [best['layer_size']] * best['n_layers']
    policy_kwargs = dict(net_arch=dict(pi=net_arch, vf=net_arch))
    
    env = make_vec_env(lambda: FarkleEnv(illegal_action_penalty=best['illegal_action_penalty']), n_envs=8)
    model = PPO(
        "MlpPolicy", env, verbose=1,
        learning_rate=best['learning_rate'],
        ent_coef=best['ent_coef'],
        clip_range=best['clip_range'],
        n_steps=best['n_steps'],
        batch_size=best['batch_size'],
        policy_kwargs=policy_kwargs,
        tensorboard_log="./tensorboard/"
    )
    
    metrics_callback = FarkleMetricsCallback()
    model.learn(total_timesteps=final_timesteps, callback=metrics_callback, tb_log_name="PPO_Optimized")
    
    os.makedirs("checkpoints", exist_ok=True)
    model.save("checkpoints/farkle_ppo_optimized")
    print(f"\n✅ Optimized model saved to checkpoints/farkle_ppo_optimized")

def run_train(timesteps=500000, output="farkle_ppo_manual", penalty=100.0):
    print(f"🏋️ Starting Manual Training for {timesteps} steps (Penalty: {penalty})...")
    env = make_vec_env(lambda: FarkleEnv(illegal_action_penalty=penalty), n_envs=8)
    model = PPO(
        "MlpPolicy", env, verbose=1,
        learning_rate=3e-4,
        tensorboard_log="./tensorboard/"
    )
    
    metrics_callback = FarkleMetricsCallback()
    model.learn(total_timesteps=timesteps, callback=metrics_callback, tb_log_name="PPO_Manual")
    
    os.makedirs("checkpoints", exist_ok=True)
    model.save(f"checkpoints/{output}")
    print(f"✅ Model saved to checkpoints/{output}")

# --- API ---
# In a real scenario, this would import from api.py, but we'll consolidate for the CLI demo
def run_api(port=8000, model_path="checkpoints/farkle_ppo_optimized"):
    # This is a placeholder to show consolidation
    # For now, we'll direct the user to use api.py but in the future we can move the FastAPI app here.
    print(f"📡 Starting API on port {port} using model {model_path}...")
    # os.system(f"uvicorn api:app --host 0.0.0.0 --port {port}")
    # Import the app dynamicly to avoid circular imports / missing files during dev
    try:
        from api import app
        uvicorn.run(app, host="0.0.0.0", port=port)
    except ImportError:
        print("❌ Error: api.py not found or could not be imported.")

# --- CLI ---

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Farkle Agent CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Tune
    tune_parser = subparsers.add_parser("tune", help="Run hyperparameter optimization")
    tune_parser.add_argument("--trials", type=int, default=8)
    tune_parser.add_argument("--timesteps", type=int, default=500000)
    tune_parser.add_argument("--tune-timesteps", type=int, default=200000)

    # Train
    train_parser = subparsers.add_parser("train", help="Run standard training")
    train_parser.add_argument("--timesteps", type=int, default=500000)
    train_parser.add_argument("--output", type=str, default="farkle_ppo_manual")
    train_parser.add_argument("--penalty", type=float, default=100.0)

    # API
    api_parser = subparsers.add_parser("api", help="Start the agent API")
    api_parser.add_argument("--port", type=int, default=8000)
    api_parser.add_argument("--model", type=str, default="checkpoints/farkle_ppo_optimized")

    args = parser.parse_args()

    if args.command == "tune":
        run_tune(trials=args.trials, final_timesteps=args.timesteps, tune_timesteps=args.tune_timesteps)
    elif args.command == "train":
        run_train(timesteps=args.timesteps, output=args.output, penalty=args.penalty)
    elif args.command == "api":
        run_api(port=args.port, model_path=args.model)
    else:
        parser.print_help()
