import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, RefreshCw, Trophy, User, Cpu, ChevronRight, X, Sparkles } from 'lucide-react';
import { FarkleEngine } from './farkle-engine';
import ReactMarkdown from 'react-markdown';
import rulesMd from './FarkleRules.md?raw';
import { GreedyAgent } from './agents/greedy';
import { GeminiAgent } from './agents/gemini';
import { CustomAgent } from './agents/custom';
import Cookies from 'js-cookie';

// --- AGENTS CONFIG ---
const agents = {
    greedy: new GreedyAgent(),
    gemini: new GeminiAgent(),
    custom: new CustomAgent()
};

// --- COMPONENTS ---

const Die = ({ value, state, onClick }) => {
  const dots = {
    1: [[50, 50]],
    2: [[20, 20], [80, 80]],
    3: [[20, 20], [50, 50], [80, 80]],
    4: [[20, 20], [20, 80], [80, 20], [80, 80]],
    5: [[20, 20], [20, 80], [50, 50], [80, 20], [80, 80]],
    6: [[20, 20], [20, 80], [20, 50], [80, 20], [80, 80], [80, 50]]
  };

  // Visual mapping of states
  // rolled: White/Gray (interactive)
  // kept: Yellow/Gold (interactive, selected)
  // banked: Green/Darker (locked, scored)
  
  const baseClasses = "w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center shadow-xl cursor-pointer transition-all duration-300 transform";
  
  let stateClasses = "bg-white hover:-translate-y-1";
  if (state === 'kept') stateClasses = "ring-4 ring-yellow-400 translate-y-2 bg-gradient-to-br from-white to-gray-200";
  if (state === 'banked') stateClasses = "opacity-60 cursor-not-allowed bg-green-200 ring-2 ring-green-600";

  return (
    <div 
      onClick={onClick}
      className={`${baseClasses} ${stateClasses}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1">
        {dots[value]?.map((dot, i) => (
          <circle key={i} cx={dot[0]} cy={dot[1]} r="10" fill="#1e293b" />
        ))}
      </svg>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-yellow-500">{title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="text-slate-300 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const AgentSelector = ({ selected, onSelect, disabled }) => {
    const options = [
        { id: 'human', icon: User, label: 'Human', color: 'text-blue-400' },
        { id: 'greedy', icon: Cpu, label: 'Greedy', color: 'text-green-400' },
        { id: 'gemini', icon: Sparkles, label: 'Gemini', color: 'text-purple-400' },
        { id: 'custom', icon: RefreshCw, label: 'Custom', color: 'text-orange-400' }
    ];

    return (
        <div className="flex bg-slate-900/50 rounded-lg p-1 mt-2">
            {options.map(opt => {
                const isActive = selected === opt.id;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.id}
                        onClick={() => !disabled && onSelect(opt.id)}
                        disabled={disabled}
                        className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all text-xs font-bold uppercase tracking-wider
                            ${isActive ? 'bg-slate-700 shadow-md text-white' : 'text-slate-500 hover:text-slate-300'}
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                        title={opt.label}
                    >
                        <Icon size={16} className={`mb-1 ${isActive ? opt.color : ''}`} />
                        <span>{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default function ZehntausendGame() {
  const engineRef = useRef(new FarkleEngine());
  const [gameState, setGameState] = useState(engineRef.current.getSnapshot());
  const [showRules, setShowRules] = useState(false);
  const [playerAgents, setPlayerAgents] = useState(['human', 'greedy']); // Default P1: Human, P2: Greedy
  const [isProcessingTurn, setIsProcessingTurn] = useState(false); // Lock UI processing
  const [aiStatusMessage, setAiStatusMessage] = useState(null); // For AI feedback (retries, thinking)
  const [showUriModal, setShowUriModal] = useState(false);
  const [currentUriPlayerIndex, setCurrentUriPlayerIndex] = useState(null);
  const [tempUri, setTempUri] = useState('');

  // Sync function
  const refresh = () => setGameState(engineRef.current.getSnapshot());

  const handleRoll = () => {
    engineRef.current.roll();
    refresh();
  };

  const handleKeep = (id) => {
    engineRef.current.toggleKeep(id);
    refresh();
  };

  const handleBank = () => {
    engineRef.current.bank();
    refresh();
  };
  
  const handleRestart = () => {
      engineRef.current = new FarkleEngine();
      setIsProcessingTurn(false);
      setAiStatusMessage(null);
      refresh();
  };

  const setAgentType = (playerIndex, type) => {
      const newAgents = [...playerAgents];
      newAgents[playerIndex] = type;
      setPlayerAgents(newAgents);
      
      // Update engine player type for display
      engineRef.current.players[playerIndex].type = type === 'human' ? 'human' : 'computer';
      const agentNames = {
          human: `Player ${playerIndex + 1}`,
          greedy: 'Greedy Bot',
          gemini: 'Gemini AI',
          custom: 'Custom API'
      };
      engineRef.current.players[playerIndex].name = agentNames[type];

      if (type === 'custom') {
          const savedUri = Cookies.get(`custom_agent_uri_p${playerIndex}`) || '';
          setTempUri(savedUri);
          setCurrentUriPlayerIndex(playerIndex);
          setShowUriModal(true);
      }

      refresh();
  };

  const saveCustomUri = () => {
      if (currentUriPlayerIndex !== null) {
          Cookies.set(`custom_agent_uri_p${currentUriPlayerIndex}`, tempUri, { expires: 365 });
          setShowUriModal(false);
          setCurrentUriPlayerIndex(null);
      }
  };

  const gameStarted = gameState.players.some(p => p.score > 0) || gameState.currentKeepScore > 0 || gameState.turnScore > 0;
  
  // LOGIC: Turn Execution Loop
  useEffect(() => {
    const currentPlayerType = playerAgents[gameState.currentPlayerIndex];
    if (currentPlayerType !== 'human' && gameState.status !== 'win' && !isProcessingTurn) {
        
        const runAgentTurn = async () => {
            setIsProcessingTurn(true);
            setAiStatusMessage(null); // Reset status at start of turn
            const agent = agents[currentPlayerType];
            
            try {
                // Determine if we need to roll first (start of turn)
                // Actually agent.getNextMove handles "what do I do now?"
                // BUT: Our engine requires explicit actions.
                // Standard flow: 
                // 1. If status is 'rolling' (and new turn or after roll), Agent decides:
                //    - Select Dice (Keep)
                //    - Bank OR Roll Again
                
                // If it's a fresh turn with no dice rolled yet? 'rolling' status, all dice 'rolled' state?
                
                // Let's assume Agent is stateless and we loop until turn passes.
                
                // Loop 1 step:
                if (engineRef.current.message.includes("Farkle")) {
                    // Auto-pass logic handled elsewhere? No, let's handle everything here for consistency?
                    // Previous logic had auto-pass useEffect. Let's keep that for Human, but AI needs to handle it?
                    // Or unified?
                }
                
                // Call Agent
                const move = await agent.getNextMove(engineRef.current, (msg) => setAiStatusMessage(msg));
                
                // UI Delay: "Seeing the move"
                await new Promise(r => setTimeout(r, 1000));
                
                // Execute Keeps
                if (move.keepDiceIds && move.keepDiceIds.length > 0) {
                     move.keepDiceIds.forEach(id => {
                        // Only toggle if not already kept (to avoid toggle off)
                        const d = engineRef.current.dice.find(x => x.id === id);
                        if (d && d.state !== 'kept') {
                            engineRef.current.toggleKeep(id);
                        }
                     });
                     refresh();
                }
                 
                // Explain? (Could add to UI message)
                if (move.explanation) {
                    // console.log("AI Explanation:", move.explanation);
                }

                // UI Delay: "Before Action (Roll/Bank)"
                await new Promise(r => setTimeout(r, 2000));
                
                if (move.action === 'ROLL') {
                     // Check if we CAN roll (Rule enforcement)
                     if (engineRef.current.currentKeepScore > 0 || engineRef.current.dice.every(d => d.state !== 'rolled')) {
                         engineRef.current.roll();
                         refresh();
                     } else {
                         // Force bank if AI tried to roll illegally? Or just bank.
                         engineRef.current.bank();
                         refresh();
                     }
                } else if (move.action === 'BANK') {
                     engineRef.current.bank();
                     refresh();
                }
                
            } catch (err) {
                console.error("Agent Error:", err);
                setAiStatusMessage("Agent Error: " + (err.message || "Unknown error"));
                // Do NOT revert to human, just show error.
            } finally {
                setIsProcessingTurn(false);
                setAiStatusMessage(null);
            }
        };

        runAgentTurn();
    }
  }, [gameState.currentPlayerIndex, gameState.status, gameState.dice, playerAgents]); 
  // Dependency: dice/status change triggers next step of AI turn.
  // Warning: ensure getNextMove doesn't infinite loop if state doesn't change.
  // Greedy agent has Delay. Gemini has net latency.

  // Legacy Auto-pass for Farkle (Simplified for all?)
  useEffect(() => {
    if (gameState.status === 'farkle') {
        const timer = setTimeout(() => {
            engineRef.current.passTurn();
            setIsProcessingTurn(false);
            setAiStatusMessage(null);
            refresh();
        }, 4000);
        return () => clearTimeout(timer);
    }
  }, [gameState.status]);

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = playerAgents[gameState.currentPlayerIndex] === 'human';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-yellow-500 selection:text-black">
      {/* HEADER */}
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-2">
            <Trophy className="text-yellow-500" />
            <h1 className="text-xl font-bold tracking-wider">Farkle - 10.000</h1>
        </div>
        <button 
          onClick={() => setShowRules(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-all text-sm font-medium"
        >
          <HelpCircle size={18} />
          <span>Rules</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* SCOREBOARD */}
        <div className="grid grid-cols-2 gap-4 md:gap-8">
            {gameState.players.map((p, idx) => (
                <div key={p.id} className={`p-6 rounded-2xl border-2 transition-all duration-500 relative flex flex-col
                    ${gameState.currentPlayerIndex === idx ? 'border-yellow-500 bg-slate-800 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-transparent bg-slate-800/50'}
                `}>
                    <div className="flex items-center space-x-3 mb-2 opacity-80">
                         {/* Icon based on CURRENT selection, not p.type which maps to 'computer' generic */}
                         {playerAgents[idx] === 'human' && <User className="text-blue-400" />}
                         {playerAgents[idx] === 'greedy' && <Cpu className="text-green-400" />}
                         {playerAgents[idx] === 'gemini' && <Sparkles className="text-purple-400" />}
                         {playerAgents[idx] === 'custom' && <RefreshCw className="text-orange-400" />}
                         
                        <span className="uppercase tracking-widest text-xs font-bold">{p.name}</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black font-mono mb-4">{p.score.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mb-2">Target: 10,000</div>
                    
                    {/* AGENT SELECTION TAB */}
                    <div className="mt-auto">
                        <AgentSelector 
                            selected={playerAgents[idx]} 
                            onSelect={(type) => setAgentType(idx, type)} 
                            disabled={gameStarted}
                        />
                    </div>
                </div>
            ))}
        </div>

        {/* GAME AREA */}
        <div className="bg-[#0f3b25] rounded-3xl p-6 md:p-12 shadow-inner border-[12px] border-[#2f2418] relative overflow-hidden">
            {/* Felt texture overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center space-y-10">
                
                {/* STATUS BAR */}
                <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-center min-h-[3rem] flex items-center justify-center">
                    <span className="text-yellow-100 font-medium tracking-wide animate-pulse-slow">{gameState.message}</span>
                </div>

                {/* DICE CONTAINER */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 min-h-[6rem]">
                    {gameState.dice.map((d) => (
                        <Die 
                            key={d.id} 
                            value={d.value} 
                            state={d.state}
                            onClick={() => isHumanTurn && handleKeep(d.id)} 
                        />
                    ))}
                </div>

                {/* CONTROLS */}
                {gameState.status !== 'win' ? (
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
                        {isHumanTurn ? (
                            <>
                                <button 
                                    onClick={handleRoll}
                                    disabled={gameState.status === 'farkle' || (gameState.currentKeepScore === 0 && gameState.dice.some(d => d.state === 'rolled'))}
                                    className={`flex-1 font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 
                                        ${gameState.dice.every(d => d.state !== 'rolled') 
                                            ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white animate-pulse' 
                                            : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
                                >
                                    <RefreshCw />
                                    <span>
                                        {gameState.dice.every(d => d.state !== 'rolled') 
                                            ? "HOT HAND! Roll 6!" 
                                            : "Roll Remaining"}
                                    </span>
                                </button>
                                
                                <button 
                                    onClick={handleBank}
                                    disabled={gameState.currentKeepScore === 0 && gameState.turnScore === 0}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {/* Show total accumulated pot (Turn + Kept) */}
                                    <span className="text-2xl font-mono">{gameState.turnScore + gameState.currentKeepScore}</span>
                                    <span className="text-xs uppercase opacity-75">Bank</span>
                                    <ChevronRight />
                                </button>
                            </>
                        ) : (
                           <div className="text-white/50 text-sm animate-pulse flex items-center space-x-2">
                                {playerAgents[gameState.currentPlayerIndex] === 'gemini' && <Sparkles size={16} className="text-purple-400" />}
                                {playerAgents[gameState.currentPlayerIndex] === 'custom' && <RefreshCw size={16} className="text-orange-400 animate-spin-slow" />}
                               <span>
                                   {aiStatusMessage ? aiStatusMessage : (playerAgents[gameState.currentPlayerIndex] === 'gemini' ? "Gemini is thinking..." : (playerAgents[gameState.currentPlayerIndex] === 'custom' ? "Calling API..." : "Computer is thinking..."))}
                               </span>
                           </div>
                        )}
                        

                    </div>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="text-3xl font-bold text-yellow-400 mb-4">
                            VICTORY!
                        </div>
                        <button 
                            onClick={handleRestart}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-12 py-4 rounded-xl shadow-xl transform transition hover:scale-105"
                        >
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* RULES MODAL */}
      <Modal isOpen={showRules} onClose={() => setShowRules(false)} title="Strict Farkle Rules">
        <div className="text-sm md:text-base rule-content space-y-4">
            <ReactMarkdown
                components={{
                    h3: ({node, ...props}) => <h3 className="font-bold text-white mt-4 text-lg" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 text-slate-400" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 text-slate-400" {...props} />,
                    li: ({node, children, ...props}) => {
                        // Custom logic to color "Keys": check if children starts with strong?
                        return <li {...props}>{children}</li>
                    },
                    strong: ({node, ...props}) => <strong className="text-yellow-500" {...props} />,
                    p: ({node, ...props}) => <p className="text-slate-300" {...props} />
                }}
            >
                {rulesMd}
            </ReactMarkdown>
        </div>
      </Modal>

      {/* CUSTOM AGENT URI MODAL */}
      <Modal 
        isOpen={showUriModal} 
        onClose={() => setShowUriModal(false)} 
        title="Custom Agent Configuration"
      >
        <div className="space-y-4">
          <p className="text-sm">
            Enter the full URI of your custom agent's endpoint. 
            The engine will send a POST request with the current game state as JSON.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Endpoint URI</label>
            <input 
              type="text" 
              value={tempUri}
              onChange={(e) => setTempUri(e.target.value)}
              placeholder="https://your-api.com/move"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-xs font-bold uppercase text-yellow-500 mb-2">Instructions</h4>
            <ul className="text-xs space-y-2 text-slate-400 list-disc pl-4">
              <li>Your API must adhere to the <strong>OpenAPI 3.1 specification</strong>.</li>
              <li>Expected input: <code>GameState</code> JSON.</li>
              <li>Expected output: <code>AgentMove</code> JSON (e.g. <code>{"{ \"action\": \"ROLL\", \"keepDiceIds\": [0, 2] }"}</code>).</li>
              <li>Detailed documentation is available in <code>README.md</code> and <code>web-ui/docs/custom-agent-api.json</code>.</li>
            </ul>
          </div>
          <button 
            onClick={saveCustomUri}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
          >
            Save Configuration
          </button>
        </div>
      </Modal>

    </div>
  );
}