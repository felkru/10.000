# Zehntausend Custom Agent - RL Self-Play

This repository contains the implementation of a Deep Reinforcement Learning agent for the game of Zehntausend (10.000).

## Tech Stack

- **Framework**: [Stable Baselines3 (SB3)](https://stable-baselines3.readthedocs.io/)
- **Deep Learning**: [PyTorch](https://pytorch.org/)
- **API**: [FastAPI](https://fastapi.tiangolo.com/)
- **Simulation**: [Bun](https://bun.sh/) (running the TypeScript game engine)

## References

### Reinforcement Learning

- **SB3 Documentation**: [Stable Baselines3 Docs](https://stable-baselines3.readthedocs.io/)
- **PPO Paper**: [Schulman et al. (2017). "Proximal Policy Optimization Algorithms"](https://arxiv.org/abs/1707.06347)

### Self-Play Strategies

- **AlphaZero**: [Silver et al. (2018). "A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play"](https://arxiv.org/abs/1712.01815)
- **Fictitious Self-Play**: [Heinrich & Silver (2016). "Deep Reinforcement Learning from Self-Play in Imperfect-Information Games"](https://arxiv.org/abs/1603.01121)

## Setup & Training

To start the self-play training loop:

```bash
./train_self_play.sh
```

This script will:

1. Initialize the environment.
2. Spin up the game servers and UI.
3. Start the Champion vs. Challenger training loop.
