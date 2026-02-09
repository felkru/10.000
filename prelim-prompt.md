@custom-agent-api.json create a basic model that's trained by playing against another player and hook it up to a FastAPI API (please make sure to start by autogenerating boilerplate based on the spec). Please use online RL and basic hyperparameter optimization.

then please create an .sh training script in the project root (the 10.000 folder) that first spins up 2 servers, then spins up the ui to allow me to observe the agents playing against one another. it's meant to do self-play.

store regular checkpoints of the models and replace the weights and hyperparameters of the model that won less often with the one's of the model that did.

at the moment i want to observe the AI to check the self-play progress and then later implement a headless mode.

it's possible that the openapi spec isn't

I'm very unsure whether this is a good plan for getting self-play to work. please read through the codebase in detail and critique my plan first before creating an implementation plan. i'm looking for the fastest way to use deep RL to have an agent that's human level in this game.
