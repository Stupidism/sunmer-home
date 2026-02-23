import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Sun, Moon } from 'lucide-react';
import type { Belief } from '@/types';

interface BeliefCarouselProps {
  beliefs: Belief[];
  onSelectBelief: (beliefId: string) => void;
  onRecordSuccess: () => void;
}

export function BeliefCarousel({ beliefs, onSelectBelief, onRecordSuccess }: BeliefCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const currentBelief = beliefs[currentIndex];

  // 自动轮播
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % beliefs.length);
    }, 8000); // 8秒切换一次

    return () => clearInterval(interval);
  }, [isAutoPlaying, beliefs.length]);

  const goToPrevious = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + beliefs.length) % beliefs.length);
  }, [beliefs.length]);

  const goToNext = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % beliefs.length);
  }, [beliefs.length]);

  return (
    <div className="bg-white rounded-3xl shadow-soft-lg overflow-hidden">
      {/* Header */}
      <div className="gradient-rose p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">我的新信念</span>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-white/70" />
          <span className="text-white/80 text-sm">早晨读一遍</span>
        </div>
      </div>

      {/* Carousel Content */}
      <div className="relative p-6 min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBelief.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Belief Number */}
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${currentBelief.color} flex items-center justify-center text-white text-sm font-bold`}>
                {currentBelief.order}
              </span>
              <span className="text-gray-400 text-sm">/ {beliefs.length}</span>
            </div>

            {/* Old Belief */}
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-1">旧信念</p>
              <p className="text-gray-500 line-through">{currentBelief.oldBelief}</p>
            </div>

            {/* New Belief */}
            <div className={`p-4 rounded-xl bg-gradient-to-r ${currentBelief.color}`}>
              <p className="text-xs text-white/80 mb-1">新信念</p>
              <p className="text-white font-medium text-lg leading-relaxed">
                {currentBelief.newBelief}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onSelectBelief(currentBelief.id)}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                查看形成方法
              </button>
              <button
                onClick={onRecordSuccess}
                className="flex-1 py-3 px-4 rounded-xl gradient-rose text-white text-sm font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Moon className="w-4 h-4" />
                记录成功时刻
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={goToNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 pb-4">
        {beliefs.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setIsAutoPlaying(false);
              setCurrentIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-6 bg-gradient-to-r from-rose-400 to-pink-500'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
