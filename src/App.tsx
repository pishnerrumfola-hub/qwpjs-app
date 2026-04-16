import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Candy as CandyIcon, 
  Disc, 
  RotateCcw, 
  Play, 
  Trophy, 
  BookOpen,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Move
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameMode, DivisionType, Candy, Plate } from './types';

// Constants
const CANDY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
  '#F7DC6F', '#BB8FCE', '#82E0AA', '#F1948A', '#85C1E9'
];

export default function App() {
  const [mode, setMode] = useState<GameMode>('simulation');
  const [totalCandiesInput, setTotalCandiesInput] = useState(12);
  const [plateCountInput, setPlateCountInput] = useState(3);
  
  // Use deferred values for simulation initialization to keep sliders smooth
  const deferredTotalCandies = React.useDeferredValue(totalCandiesInput);
  const deferredPlateCount = React.useDeferredValue(plateCountInput);
  
  const [divisionType, setDivisionType] = useState<DivisionType>('byParts');
  
  // Simulation State - Combined to ensure atomic updates
  const [simulationData, setSimulationData] = useState<{
    candies: Candy[];
    plates: Plate[];
  }>({ candies: [], plates: [] });
  
  const [selectedCandyIds, setSelectedCandyIds] = useState<string[]>([]);
  const [highlightType, setHighlightType] = useState<'total' | 'divisor' | 'result' | null>(null);
  const [isAutoDistributing, setIsAutoDistributing] = useState(false);
  
  const plateRefs = useRef<(HTMLDivElement | null)[]>([]);
  const constraintsRef = useRef(null);

  // Initialize Simulation
  const initSimulation = useCallback(() => {
    // Unique session prefix to prevent key collisions during rapid re-renders/animations
    const sessionPrefix = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const newCandies: Candy[] = Array.from({ length: totalCandiesInput }).map((_, i) => ({
      id: `candy-${sessionPrefix}-${i}`,
      color: CANDY_COLORS[i % CANDY_COLORS.length]
    }));
    
    const initialPlates: Plate[] = Array.from({ length: plateCountInput }).map((_, i) => ({
      id: `plate-${sessionPrefix}-${i}`,
      candies: []
    }));

    setSimulationData({
      candies: newCandies,
      plates: initialPlates
    });
    setHighlightType(null);
    setSelectedCandyIds([]);
    plateRefs.current = new Array(deferredPlateCount).fill(null);
  }, [deferredTotalCandies, deferredPlateCount]);

  useEffect(() => {
    initSimulation();
  }, [initSimulation]);

  // Handlers
  const moveCandiesToPlate = useCallback((candyIds: string[], plateIndex: number) => {
    setSimulationData(prev => {
      const movingCandies = prev.candies.filter(c => candyIds.includes(c.id));
      if (movingCandies.length === 0) return prev;

      const newCandies = prev.candies.filter(c => !candyIds.includes(c.id));
      const newPlates = prev.plates.map((p, idx) => 
        idx === plateIndex ? { ...p, candies: [...p.candies, ...movingCandies] } : p
      );

      return {
        candies: newCandies,
        plates: newPlates
      };
    });
    setSelectedCandyIds([]);
  }, []);

  const handleCandyClick = (candyId: string) => {
    if (isAutoDistributing) return;
    setSelectedCandyIds(prev => 
      prev.includes(candyId) 
        ? prev.filter(id => id !== candyId) 
        : [...prev, candyId]
    );
  };

  const handlePlateClick = (plateIndex: number) => {
    if (selectedCandyIds.length > 0) {
      moveCandiesToPlate(selectedCandyIds, plateIndex);
    }
  };

  const handleDrag = useCallback((event: any, info: any) => {
    const { x, y } = info.point;
    
    let foundIndex = -1;
    for (let i = 0; i < plateRefs.current.length; i++) {
      const ref = plateRefs.current[i];
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      const buffer = 10;
      if (x >= rect.left - buffer && x <= rect.right + buffer && 
          y >= rect.top - buffer && y <= rect.bottom + buffer) {
        foundIndex = i;
        break;
      }
    }

    // Directly manipulate DOM classes for performance (avoiding React re-renders during drag)
    plateRefs.current.forEach((ref, i) => {
      if (ref) {
        if (i === foundIndex) {
          ref.classList.add('plate-target-hover');
        } else {
          ref.classList.remove('plate-target-hover');
        }
      }
    });
  }, []);

  const handleDragEnd = useCallback((event: any, info: any, candyId: string) => {
    const { x, y } = info.point;
    
    const droppedPlateIndex = plateRefs.current.findIndex(ref => {
      if (!ref) return false;
      const rect = ref.getBoundingClientRect();
      const buffer = 20;
      return x >= rect.left - buffer && x <= rect.right + buffer && 
             y >= rect.top - buffer && y <= rect.bottom + buffer;
    });

    if (droppedPlateIndex !== -1) {
      // If dragging a selected candy, move all selected candies
      // Otherwise just move the dragged one
      const idsToMove = selectedCandyIds.includes(candyId) 
        ? selectedCandyIds 
        : [candyId];
      moveCandiesToPlate(idsToMove, droppedPlateIndex);
    }
    
    // Clean up all hover classes
    plateRefs.current.forEach(ref => ref?.classList.remove('plate-target-hover'));
  }, [moveCandiesToPlate, selectedCandyIds]);

  const autoDistribute = async () => {
    if (isAutoDistributing || simulationData.candies.length === 0) return;
    setIsAutoDistributing(true);
    
    const candiesToDistribute = [...simulationData.candies];
    
    for (const candy of candiesToDistribute) {
      setSimulationData(prev => {
        const nextPlateIndex = prev.plates.findIndex(p => {
          const minCandies = Math.min(...prev.plates.map(pl => pl.candies.length));
          return p.candies.length === minCandies;
        });
        
        return {
          candies: prev.candies.filter(c => c.id !== candy.id),
          plates: prev.plates.map((p, idx) => 
            idx === nextPlateIndex ? { ...p, candies: [...p.candies, candy] } : p
          )
        };
      });
      await new Promise(r => setTimeout(r, 150));
    }
    
    setIsAutoDistributing(false);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const isFinished = simulationData.candies.length === 0;
  const candiesPerPlate = simulationData.plates.length > 0 ? simulationData.plates[0].candies.length : 0;
  const isEven = simulationData.plates.every(p => p.candies.length === candiesPerPlate);

  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#2D3436] font-sans selection:bg-[#FFEAA7]" ref={constraintsRef}>
      <header className="bg-white border-b border-[#E4E3E0] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#FF7675] p-2 rounded-xl shadow-sm">
            <CandyIcon className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">趣味平均数</h1>
        </div>
        
        <nav className="flex bg-[#F1F2F6] p-1 rounded-xl">
          <button 
            onClick={() => setMode('simulation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'simulation' ? 'bg-white shadow-sm text-[#FF7675]' : 'text-[#636E72] hover:text-[#2D3436]'}`}
          >
            模拟分发
          </button>
          <button 
            onClick={() => setMode('table')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'table' ? 'bg-white shadow-sm text-[#FF7675]' : 'text-[#636E72] hover:text-[#2D3436]'}`}
          >
            口诀求商
          </button>
          <button 
            onClick={() => setMode('challenge')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'challenge' ? 'bg-white shadow-sm text-[#FF7675]' : 'text-[#636E72] hover:text-[#2D3436]'}`}
          >
            进阶挑战
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {mode === 'simulation' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-[#E4E3E0]">
                <div className="flex items-center gap-2 mb-6 text-[#FF7675]">
                  <Settings2 size={20} />
                  <h2 className="font-bold">游戏设置</h2>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[#636E72] mb-2">糖果总数: {totalCandiesInput}</label>
                    <input 
                      type="range" min="1" max="24" 
                      value={totalCandiesInput} 
                      onChange={(e) => setTotalCandiesInput(Number(e.target.value))}
                      className="w-full h-2 bg-[#F1F2F6] rounded-lg appearance-none cursor-pointer accent-[#FF7675]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#636E72] mb-2">盘子数量: {plateCountInput}</label>
                    <input 
                      type="range" min="1" max="6" 
                      value={plateCountInput} 
                      onChange={(e) => setPlateCountInput(Number(e.target.value))}
                      className="w-full h-2 bg-[#F1F2F6] rounded-lg appearance-none cursor-pointer accent-[#4ECDC4]"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-[#636E72] mb-3">分发模式</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => setDivisionType('byParts')}
                        className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-left flex items-center justify-between ${divisionType === 'byParts' ? 'border-[#FF7675] bg-[#FFF5F5] text-[#FF7675]' : 'border-transparent bg-[#F1F2F6] text-[#636E72]'}`}
                      >
                        按份数分 (求每份)
                        {divisionType === 'byParts' && <CheckCircle2 size={16} />}
                      </button>
                      <button 
                        onClick={() => setDivisionType('byEach')}
                        className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-left flex items-center justify-between ${divisionType === 'byEach' ? 'border-[#4ECDC4] bg-[#F0FFFD] text-[#4ECDC4]' : 'border-transparent bg-[#F1F2F6] text-[#636E72]'}`}
                      >
                        按每份数分 (求份数)
                        {divisionType === 'byEach' && <CheckCircle2 size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button 
                      onClick={initSimulation}
                      className="flex-1 bg-[#F1F2F6] text-[#2D3436] py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#E4E3E0] transition-colors"
                    >
                      <RotateCcw size={18} /> 重置
                    </button>
                    <button 
                      disabled={isAutoDistributing || isFinished}
                      onClick={autoDistribute}
                      className="flex-1 bg-[#FF7675] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#EF5350] transition-colors disabled:opacity-50"
                    >
                      <Play size={18} /> 自动分
                    </button>
                  </div>
                </div>
              </section>

              {isFinished && isEven && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F0FFFD] p-6 rounded-3xl border border-[#4ECDC4] text-[#00B894]"
                >
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    <CheckCircle2 size={20} />
                    平均分好了！
                  </div>
                  <p className="text-sm opacity-80">每个盘子里都有 {candiesPerPlate} 个糖果。</p>
                </motion.section>
              )}
              
              <div className="bg-white p-4 rounded-2xl border border-[#E4E3E0] text-xs text-[#636E72] flex items-center gap-2">
                <Move size={14} />
                <span>提示：点击糖果可多选，拖拽其中一颗即可批量移动！</span>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E4E3E0] flex flex-col items-center justify-center min-h-[160px]">
                {!isFinished ? (
                  <div className="text-[#B2BEC3] flex items-center gap-2 italic">
                    <AlertCircle size={20} />
                    <span>分完糖果后，这里会出现算式哦</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-4xl font-black tracking-widest flex items-center gap-4">
                      <button 
                        onClick={() => setHighlightType(highlightType === 'total' ? null : 'total')}
                        className={`px-4 py-2 rounded-2xl transition-all ${highlightType === 'total' ? 'bg-[#FF7675] text-white scale-110 shadow-lg' : 'hover:bg-[#F1F2F6]'}`}
                      >
                        {totalCandiesInput}
                      </button>
                      <span className="text-[#B2BEC3]">÷</span>
                      <button 
                        onClick={() => setHighlightType(highlightType === 'divisor' ? null : 'divisor')}
                        className={`px-4 py-2 rounded-2xl transition-all ${highlightType === 'divisor' ? 'bg-[#4ECDC4] text-white scale-110 shadow-lg' : 'hover:bg-[#F1F2F6]'}`}
                      >
                        {divisionType === 'byParts' ? plateCountInput : candiesPerPlate}
                      </button>
                      <span className="text-[#B2BEC3]">=</span>
                      <button 
                        onClick={() => setHighlightType(highlightType === 'result' ? null : 'result')}
                        className={`px-4 py-2 rounded-2xl transition-all ${highlightType === 'result' ? 'bg-[#FDCB6E] text-white scale-110 shadow-lg' : 'hover:bg-[#F1F2F6]'}`}
                      >
                        {divisionType === 'byParts' ? candiesPerPlate : plateCountInput}
                      </button>
                    </div>
                    <div className="flex gap-8 text-sm font-bold text-[#636E72] uppercase tracking-wider">
                      <span className={highlightType === 'total' ? 'text-[#FF7675]' : ''}>总数</span>
                      <span className={highlightType === 'divisor' ? 'text-[#4ECDC4]' : ''}>
                        {divisionType === 'byParts' ? '盘子数' : '每份数'}
                      </span>
                      <span className={highlightType === 'result' ? 'text-[#FDCB6E]' : ''}>
                        {divisionType === 'byParts' ? '每份数' : '盘子数'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E4E3E0]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-[#636E72] flex items-center gap-2">
                      <CandyIcon size={16} /> 糖果盒 ({simulationData.candies.length})
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedCandyIds(simulationData.candies.map(c => c.id))}
                        className="text-[10px] font-bold text-[#FF7675] hover:underline"
                      >
                        全选
                      </button>
                      <button 
                        onClick={() => setSelectedCandyIds([])}
                        className="text-[10px] font-bold text-[#B2BEC3] hover:underline"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 min-h-[120px] content-start">
                    <AnimatePresence>
                      {simulationData.candies.map((candy) => (
                        <motion.div
                          key={candy.id}
                          layoutId={candy.id}
                          drag
                          dragConstraints={constraintsRef}
                          dragSnapToOrigin
                          onDrag={handleDrag}
                          onDragEnd={(e, info) => handleDragEnd(e, info, candy.id)}
                          onClick={() => handleCandyClick(candy.id)}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          whileTap={{ scale: 0.9, zIndex: 100 }}
                          whileDrag={{ scale: 1.2, zIndex: 100 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm cursor-grab active:cursor-grabbing transition-all relative ${selectedCandyIds.includes(candy.id) ? 'ring-4 ring-[#FDCB6E] scale-110 shadow-lg z-10' : ''} ${highlightType === 'total' ? 'ring-4 ring-[#FF7675] ring-offset-2' : ''}`}
                          style={{ backgroundColor: candy.color }}
                        >
                          <CandyIcon className="text-white w-5 h-5 opacity-80 pointer-events-none" />
                          {selectedCandyIds.length > 1 && selectedCandyIds.includes(candy.id) && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -right-2 bg-[#2D3436] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
                            >
                              {selectedCandyIds.length}
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E4E3E0]">
                  <h3 className="text-sm font-bold text-[#636E72] mb-6 flex items-center gap-2">
                    <Disc size={16} /> 盘子 ({simulationData.plates.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {simulationData.plates.map((plate, idx) => {
                      const isPlateHighlighted = 
                        (highlightType === 'divisor' && divisionType === 'byParts') || 
                        (highlightType === 'result' && divisionType === 'byEach');
                      
                      const isCandyHighlighted = 
                        (highlightType === 'result' && divisionType === 'byParts') || 
                        (highlightType === 'divisor' && divisionType === 'byEach') ||
                        (highlightType === 'total');

                      return (
                        <div 
                          key={plate.id}
                          ref={el => plateRefs.current[idx] = el}
                          onClick={() => handlePlateClick(idx)}
                          className={`relative aspect-square rounded-full bg-[#F1F2F6] border-2 border-dashed border-[#B2BEC3] flex flex-col items-center justify-center p-2 transition-all cursor-pointer hover:bg-[#E4E3E0] ${selectedCandyIds.length > 0 ? 'border-[#FDCB6E] bg-[#FFF9EB] scale-105' : ''} ${isPlateHighlighted ? 'ring-4 ring-[#4ECDC4] ring-offset-2 border-solid border-[#4ECDC4] bg-[#F0FFFD]' : ''}`}
                        >
                          <div className="flex flex-wrap gap-1 justify-center max-w-full">
                            <AnimatePresence>
                              {plate.candies.map((candy) => (
                                <motion.div
                                  key={candy.id}
                                  layoutId={candy.id}
                                  className={`w-4 h-4 rounded-full shadow-xs transition-all ${isCandyHighlighted ? (highlightType === 'total' ? 'ring-2 ring-[#FF7675] ring-offset-1' : 'ring-2 ring-[#FDCB6E] ring-offset-1') : ''}`}
                                  style={{ backgroundColor: candy.color }}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                          <span className="absolute -bottom-2 bg-white px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#E4E3E0] shadow-sm">
                            {plate.candies.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'table' && <MultiplicationTableView />}
        {mode === 'challenge' && <ChallengeView />}
      </main>
    </div>
  );
}

function MultiplicationTableView() {
  const [selectedNum, setSelectedNum] = useState(2);
  const [quizStep, setQuizStep] = useState(0); // 0: Select Num, 1: Quiz
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [quizSequence, setQuizSequence] = useState<number[]>([]);

  const startQuiz = (num: number) => {
    setSelectedNum(num);
    // Shuffle 1-9
    const sequence = Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    setQuizSequence(sequence);
    setQuizStep(1);
    setCurrentQuestionIdx(0);
    setScore(0);
    setUserAnswer('');
    setFeedback(null);
  };

  const checkAnswer = () => {
    const multiplier = quizSequence[currentQuestionIdx];
    const product = selectedNum * multiplier;
    
    if (parseInt(userAnswer) === multiplier) {
      setFeedback('correct');
      setScore(s => s + 10);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 }
      });
      
      setTimeout(() => {
        if (currentQuestionIdx < 8) {
          setCurrentQuestionIdx(prev => prev + 1);
          setUserAnswer('');
          setFeedback(null);
        } else {
          setQuizStep(2); // Finished
        }
      }, 1000);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  if (quizStep === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-[#2D3436]">口诀大挑战</h2>
          <p className="text-[#636E72] text-lg">选择一个数字，开始你的除法口诀闯关吧！</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => startQuiz(num)}
              className="aspect-square rounded-3xl bg-white border-4 border-[#F1F2F6] hover:border-[#FF7675] hover:scale-105 transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <span className="text-3xl font-black text-[#2D3436] group-hover:text-[#FF7675]">{num}</span>
              <span className="text-[10px] font-bold text-[#B2BEC3] uppercase">练习卷</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (quizStep === 2) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500 bg-white p-12 rounded-[3rem] shadow-xl border-4 border-[#00B894]">
        <Trophy className="mx-auto text-[#FDCB6E] w-20 h-20" />
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-[#2D3436]">闯关成功！</h2>
          <p className="text-[#636E72]">你已经掌握了 {selectedNum} 的除法口诀</p>
        </div>
        <div className="text-6xl font-black text-[#00B894]">{score} 分</div>
        <button 
          onClick={() => setQuizStep(0)}
          className="w-full py-4 bg-[#2D3436] text-white rounded-2xl font-bold text-xl hover:bg-black transition-all"
        >
          再练一组
        </button>
      </div>
    );
  }

  const currentMultiplier = quizSequence[currentQuestionIdx];
  const currentProduct = selectedNum * currentMultiplier;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-[#E4E3E0]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF7675] flex items-center justify-center text-white font-black text-xl">
            {selectedNum}
          </div>
          <div>
            <div className="text-xs font-bold text-[#B2BEC3] uppercase">进度</div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 w-4 rounded-full transition-all ${i < currentQuestionIdx ? 'bg-[#00B894]' : i === currentQuestionIdx ? 'bg-[#FF7675] w-8' : 'bg-[#F1F2F6]'}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-[#B2BEC3] uppercase">得分</div>
          <div className="text-2xl font-black text-[#2D3436]">{score}</div>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-[#E4E3E0] text-center space-y-10 relative overflow-hidden">
        <div className="space-y-6">
          <div className="text-sm font-bold text-[#B2BEC3] uppercase tracking-widest">请填出商</div>
          <div className="flex justify-center items-center gap-6">
            <div className="text-6xl font-black text-[#2D3436]">{currentProduct}</div>
            <div className="text-4xl text-[#B2BEC3]">÷</div>
            <div className="text-6xl font-black text-[#2D3436]">{selectedNum}</div>
            <div className="text-4xl text-[#B2BEC3]">=</div>
            <input 
              type="number"
              value={userAnswer}
              autoFocus
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
              className={`w-28 h-28 text-center text-5xl font-black rounded-3xl border-4 transition-all focus:outline-none ${feedback === 'correct' ? 'border-[#00B894] bg-[#F0FFFD] text-[#00B894]' : feedback === 'wrong' ? 'border-[#FF7675] bg-[#FFF5F5] text-[#FF7675] animate-shake' : 'border-[#F1F2F6] focus:border-[#FF7675]'}`}
              placeholder="?"
            />
          </div>
        </div>

        <div className="bg-[#F1F2F6] p-6 rounded-2xl inline-block mx-auto">
          <div className="text-xs font-bold text-[#636E72] uppercase mb-2">口诀提示</div>
          <div className="text-xl font-bold text-[#2D3436]">
            {feedback === 'correct' || feedback === 'wrong' ? (
              <span>{currentMultiplier} {selectedNum} {currentProduct >= 10 ? '' : '得'} {currentProduct}</span>
            ) : (
              <span className="blur-sm select-none">? ? 得 ?</span>
            )}
          </div>
        </div>

        <button 
          onClick={checkAnswer}
          className="w-full py-5 bg-[#2D3436] text-white rounded-2xl font-black text-xl hover:bg-black transition-all"
        >
          确定
        </button>
      </div>
    </div>
  );
}

function ChallengeView() {
  const [level, setLevel] = useState(1);
  const [question, setQuestion] = useState({ a: 12, b: 3, answer: 4, type: 'parts', text: '' });
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);

  const generateQuestion = useCallback(() => {
    let a, b, answer, type, text = '';
    
    if (level === 1) {
      // Level 1: Basic division within 50
      answer = Math.floor(Math.random() * 8) + 2;
      b = Math.floor(Math.random() * 5) + 2;
      a = b * answer;
      type = Math.random() > 0.5 ? 'parts' : 'each';
    } else if (level === 2) {
      // Level 2: Division within 100
      answer = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 8) + 2;
      a = b * answer;
      type = Math.random() > 0.5 ? 'parts' : 'each';
    } else {
      // Level 3: Word problems / Larger numbers
      answer = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      a = b * answer;
      type = 'word';
      const scenarios = [
        `老师有 ${a} 支铅笔，平均分给 ${b} 个小朋友，每个小朋友分几支？`,
        `果园里摘了 ${a} 个苹果，每 ${b} 个装一筐，可以装几筐？`,
        `小明买了 ${a} 本书，打算 ${b} 天看完，平均每天看几本？`,
        `一根绳子长 ${a} 米，每 ${b} 米剪一段，可以剪成几段？`
      ];
      text = scenarios[Math.floor(Math.random() * scenarios.length)];
    }

    setQuestion({ a, b, answer, type, text });
    setUserAnswer('');
    setFeedback(null);
  }, [level]);

  useEffect(() => {
    generateQuestion();
  }, [generateQuestion]);

  const checkAnswer = () => {
    if (parseInt(userAnswer) === question.answer) {
      setFeedback('correct');
      setScore(s => {
        const newScore = s + (level * 10);
        if (newScore >= level * 100 && level < 3) {
          setLevel(l => l + 1);
        }
        return newScore;
      });
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
      setTimeout(generateQuestion, 1500);
    } else {
      setFeedback('wrong');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-[#E4E3E0]">
        <div className="flex gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#FDCB6E] p-2 rounded-xl">
              <Trophy className="text-white" size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#B2BEC3] uppercase">积分</div>
              <div className="text-xl font-black text-[#2D3436]">{score}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#4ECDC4] p-2 rounded-xl">
              <BookOpen className="text-white" size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#B2BEC3] uppercase">难度等级</div>
              <div className="text-xl font-black text-[#2D3436]">Lvl {level}</div>
            </div>
          </div>
        </div>
        <button 
          onClick={generateQuestion}
          className="px-6 py-2 bg-[#F1F2F6] rounded-xl font-bold text-sm hover:bg-[#E4E3E0] transition-colors"
        >
          换一题
        </button>
      </div>

      <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-[#E4E3E0] text-center space-y-8 relative overflow-hidden">
        {/* Level Badge */}
        <div className="absolute top-4 right-4 bg-[#F1F2F6] px-3 py-1 rounded-full text-[10px] font-bold text-[#636E72]">
          {level === 1 ? '初级' : level === 2 ? '中级' : '高级挑战'}
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-[#2D3436] leading-relaxed">
            {question.type === 'word' ? question.text : 
             question.type === 'parts' 
              ? `把 ${question.a} 个糖果平均分成 ${question.b} 份，每份是多少个？`
              : `有 ${question.a} 个糖果，每 ${question.b} 个分一份，可以分几份？`
            }
          </h3>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex justify-center items-center gap-4">
              <div className="text-5xl font-black text-[#FF7675]">{question.a}</div>
              <div className="text-3xl text-[#B2BEC3]">÷</div>
              <div className="text-5xl font-black text-[#4ECDC4]">{question.b}</div>
              <div className="text-3xl text-[#B2BEC3]">=</div>
              <input 
                type="number"
                value={userAnswer}
                autoFocus
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                placeholder="?"
                className={`w-24 h-24 text-center text-5xl font-black rounded-3xl border-4 transition-all focus:outline-none ${feedback === 'correct' ? 'border-[#00B894] bg-[#F0FFFD] text-[#00B894]' : feedback === 'wrong' ? 'border-[#FF7675] bg-[#FFF5F5] text-[#FF7675] animate-shake' : 'border-[#F1F2F6] focus:border-[#FDCB6E]'}`}
              />
            </div>
          </div>
        </div>

        <button 
          onClick={checkAnswer}
          className="w-full py-5 bg-[#2D3436] text-white rounded-2xl font-black text-xl hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
        >
          提交答案
        </button>

        <AnimatePresence>
          {feedback === 'correct' && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-[#00B894] font-bold flex items-center justify-center gap-2">
              <CheckCircle2 /> 太棒了！答对了！
            </motion.div>
          )}
          {feedback === 'wrong' && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-[#FF7675] font-bold flex items-center justify-center gap-2">
              <AlertCircle /> 再想一想，你可以的！
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
