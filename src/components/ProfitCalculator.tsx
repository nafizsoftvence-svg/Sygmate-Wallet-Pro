import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calculator, TrendingUp, Coins, Target, HelpCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ProfitCalculatorProps {
  pendingCount: number;
  pendingSum: number;
  currentCommissionRate: number;
}

export const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({
  pendingCount,
  pendingSum,
  currentCommissionRate,
}) => {
  // Inputs
  const [simulatedQueueSize, setSimulatedQueueSize] = useState<number>(pendingCount);
  const [simulatedRate, setSimulatedRate] = useState<number>(currentCommissionRate);
  const [dailyGoal, setDailyGoal] = useState<number>(50); // Default $50 goal

  // Sync inputs with props when they change externally
  useEffect(() => {
    setSimulatedQueueSize(pendingCount);
  }, [pendingCount]);

  useEffect(() => {
    setSimulatedRate(currentCommissionRate);
  }, [currentCommissionRate]);

  // Calculations
  const livePotentialProfit = pendingCount * currentCommissionRate;
  const simulatedPotentialProfit = simulatedQueueSize * simulatedRate;
  
  // Goal progress
  const liveProgressPercent = Math.min(100, (livePotentialProfit / dailyGoal) * 100);
  const simulatedProgressPercent = Math.min(100, (simulatedPotentialProfit / dailyGoal) * 100);
  
  const withdrawalsNeededForGoal = Math.max(0, Math.ceil((dailyGoal - livePotentialProfit) / currentCommissionRate));

  return (
    <div id="agent-profit-calculator" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-slate-800 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="text-indigo-600 shrink-0" size={20} />
            Profit Calculator
          </h3>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">Live Commission Projections</p>
        </div>
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
          <Coins size={18} />
        </div>
      </div>

      {/* Main Stats Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left relative overflow-hidden group">
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Live Queue Profit</span>
          <span className="text-xl font-black text-slate-900 font-mono block">
            ${livePotentialProfit.toFixed(2)}
          </span>
          <span className="text-[9px] font-semibold text-slate-500 mt-1 block">
            {pendingCount} pending txs
          </span>
          <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-all duration-300" />
        </div>

        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-left relative overflow-hidden group">
          <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest block mb-1">Simulated Profit</span>
          <span className="text-xl font-black text-indigo-600 font-mono block">
            ${simulatedPotentialProfit.toFixed(2)}
          </span>
          <span className="text-[9px] font-semibold text-indigo-600/80 mt-1 block">
            {simulatedQueueSize} txs @ ${simulatedRate.toFixed(2)}
          </span>
          <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-600/10 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-all duration-300" />
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-4 pt-1 border-t border-slate-100">
        {/* Queue Size Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Simulate Queue Size</span>
            <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg font-mono">
              {simulatedQueueSize} Pending Txs
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={simulatedQueueSize}
            onChange={(e) => setSimulatedQueueSize(parseInt(e.target.value) || 0)}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold">
            <span>0 txs</span>
            <button 
              onClick={() => setSimulatedQueueSize(pendingCount)} 
              className="text-indigo-600 hover:underline transition-all"
            >
              Reset to Live ({pendingCount})
            </button>
            <span>50 txs</span>
          </div>
        </div>

        {/* Rate Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Simulate Commission Rate</span>
            <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-mono">
              ${simulatedRate.toFixed(2)} / tx
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="5.00"
            step="0.10"
            value={simulatedRate}
            onChange={(e) => setSimulatedRate(parseFloat(e.target.value) || 0.5)}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold">
            <span>$0.50</span>
            <button 
              onClick={() => setSimulatedRate(currentCommissionRate)} 
              className="text-emerald-600 hover:underline transition-all"
            >
              Reset to Active (${currentCommissionRate.toFixed(2)})
            </button>
            <span>$5.00</span>
          </div>
        </div>
      </div>

      {/* Goal Tracker section */}
      <div className="p-4.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Target className="text-amber-500 shrink-0" size={14} />
            Daily Earnings Goal
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold font-sans">$</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-14 p-1 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative">
            <div 
              style={{ width: `${liveProgressPercent}%` }} 
              className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-500"
              title={`Live: ${liveProgressPercent.toFixed(0)}%`}
            />
            {simulatedPotentialProfit > livePotentialProfit && (
              <div 
                style={{ 
                  left: `${liveProgressPercent}%`, 
                  width: `${Math.max(0, simulatedProgressPercent - liveProgressPercent)}%` 
                }} 
                className="absolute top-0 bottom-0 bg-indigo-400 opacity-60 transition-all duration-500"
                title={`Projected: ${simulatedProgressPercent.toFixed(0)}%`}
              />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
            <span>Progress: {liveProgressPercent.toFixed(0)}%</span>
            {simulatedPotentialProfit > livePotentialProfit && (
              <span className="text-indigo-600">Simulated: {simulatedProgressPercent.toFixed(0)}%</span>
            )}
            <span>Goal: ${dailyGoal}</span>
          </div>
        </div>

        {/* Goal helper message */}
        <div className="pt-1 text-[10px] leading-relaxed text-slate-500 font-semibold font-sans text-left">
          {livePotentialProfit >= dailyGoal ? (
            <div className="flex items-center gap-1.5 text-emerald-600 font-extrabold">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Congratulations! Your live queue commissions have met your daily goal!</span>
            </div>
          ) : (
            <div className="flex items-start gap-1">
              <span className="inline-block mt-0.5">💡</span>
              <span>
                To reach your goal, you need to approve and complete{' '}
                <strong className="text-indigo-600 font-extrabold font-mono text-xs shrink-0">{withdrawalsNeededForGoal}</strong>{' '}
                more pending withdrawals of current rate (${currentCommissionRate.toFixed(2)}/tx).
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
