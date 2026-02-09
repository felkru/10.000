import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, RefreshCw, Trophy, User, Cpu, ChevronRight, X } from 'lucide-react';
import { FarkleEngine } from './farkle-engine';
import ReactMarkdown from 'react-markdown';
import rulesMd from './FarkleRules.md?raw';

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

export default function ZehntausendGame() {
  const engineRef = useRef(new FarkleEngine());
  const [gameState, setGameState] = useState(engineRef.current.getSnapshot());
  const [showRules, setShowRules] = useState(false);

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
      refresh();
  };
  
  // AI Loop Hook
  useEffect(() => {
    if (gameState.currentPlayerIndex === 1 && gameState.status !== 'win') {
        const playTurn = async () => {
            // 1. Wait a bit
            await new Promise(r => setTimeout(r, 1000));
            
            // 2. Roll & Select
            engineRef.current.computerMove();
            refresh();
            
            // 3. Handle Result
            if (engineRef.current.status === 'farkle') {
                // Farkle: wait and pass
                await new Promise(r => setTimeout(r, 2000));
                engineRef.current.passTurn();
                refresh();
            } else {
                // Success: wait and bank
                await new Promise(r => setTimeout(r, 1500));
                engineRef.current.bank();
                refresh();
            }
        };
        playTurn();
    }
    // We only trigger this when the player index changes to 1.
    // We do NOT include gameState.status or dice in dependencies to avoid re-triggering during the async flow.
  }, [gameState.currentPlayerIndex]);

  // Auto-pass on Farkle for Human
  useEffect(() => {
    if (gameState.currentPlayerIndex === 0 && gameState.status === 'farkle') {
        const timer = setTimeout(() => {
            engineRef.current.passTurn(); // Use passTurn directly for Farkle
            refresh();
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayerIndex, gameState.status]);

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = gameState.currentPlayerIndex === 0;

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
                <div key={p.id} className={`p-6 rounded-2xl border-2 transition-all duration-500 
                    ${gameState.currentPlayerIndex === idx ? 'border-yellow-500 bg-slate-800 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-transparent bg-slate-800/50'}
                `}>
                    <div className="flex items-center space-x-3 mb-2 opacity-80">
                        {p.type === 'human' ? <User className="text-blue-400" /> : <Cpu className="text-red-400" />}
                        <span className="uppercase tracking-widest text-xs font-bold">{p.name}</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black font-mono">{p.score.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-1">Target: 10,000</div>
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
                            onClick={() => handleKeep(d.id)} 
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
                                    disabled={gameState.status === 'farkle'}
                                    className={`flex-1 font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 
                                        ${gameState.dice.every(d => d.state !== 'rolled') 
                                            ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white animate-pulse' 
                                            : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
                                >
                                    <RefreshCw />
                                    <span>
                                        {gameState.dice.every(d => d.state !== 'rolled') 
                                            ? "HOT HAND! Roll 6!" 
                                            : (gameState.turnScore > 0 || gameState.currentKeepScore > 0 ? "Roll Remaining" : "Roll Dice")}
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
                           <div className="text-white/50 text-sm animate-pulse">Computer is thinking...</div>
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

    </div>
  );
}