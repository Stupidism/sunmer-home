import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Calendar, ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LifeEvent } from '@/data/lifeLine';
import { getYearRange, sortEventsByDate } from '@/data/lifeLine';

interface LifeLineVisualizerProps {
  events: LifeEvent[];
  onEventClick: (event: LifeEvent) => void;
  onAddEvent: (type: 'positive' | 'negative') => void;
}

export function LifeLineVisualizer({ events, onEventClick, onAddEvent }: LifeLineVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<LifeEvent | null>(null);

  const sortedEvents = sortEventsByDate(events);
  const { min: minYear, max: maxYear } = getYearRange(events);
  
  // 确保至少显示30年的范围
  const displayMinYear = Math.min(minYear, new Date().getFullYear() - 30);
  const displayMaxYear = Math.max(maxYear, new Date().getFullYear());
  const yearRange = displayMaxYear - displayMinYear + 1;

  // 计算每个年份的位置
  const getPositionForYear = (year: number) => {
    return ((year - displayMinYear) / yearRange) * 100;
  };

  // 滚动到最新事件
  useEffect(() => {
    if (containerRef.current && events.length > 0) {
      const latestEvent = sortedEvents[sortedEvents.length - 1];
      const year = new Date(latestEvent.date).getFullYear();
      const position = getPositionForYear(year);
      const scrollWidth = containerRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      const targetScroll = (position / 100) * scrollWidth - containerWidth / 2;
      containerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  }, [events.length]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 300;
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative">
      {/* 说明文字 */}
      <div className="flex justify-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-400" />
          <span className="text-gray-600">上方：被伤害的时刻</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-gray-600">下方：活下来/爱过/努力过</span>
        </div>
      </div>

      {/* 滚动控制 */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => handleScroll('left')}
          className="p-2 rounded-full bg-white shadow-md text-gray-400 hover:text-rose-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-sm text-gray-500">
          {displayMinYear} - {displayMaxYear}
        </div>
        <button
          onClick={() => handleScroll('right')}
          className="p-2 rounded-full bg-white shadow-md text-gray-400 hover:text-rose-500 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 生命线容器 */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto overflow-y-hidden custom-scrollbar"
        style={{ height: '500px', minWidth: '100%' }}
      >
        <div className="relative" style={{ width: `${Math.max(yearRange * 80, 800)}px`, height: '100%' }}>
          {/* 年份刻度 */}
          {Array.from({ length: yearRange }, (_, i) => displayMinYear + i).map((year) => (
            <div
              key={year}
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${getPositionForYear(year)}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-4 bg-gray-300" />
              <span className="text-xs text-gray-400 mt-1">{year}</span>
            </div>
          ))}

          {/* 主生命线 */}
          <div
            className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-rose-300 via-amber-300 to-emerald-300 rounded-full"
            style={{ transform: 'translateY(-50%)' }}
 />

          {/* 添加按钮 - 线上方 */}
          <button
            onClick={() => onAddEvent('positive')}
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 text-rose-600 text-sm hover:bg-rose-200 transition-colors"
          >
            <Heart className="w-4 h-4" />
            添加被伤害的时刻
          </button>

          {/* 添加按钮 - 线下方 */}
          <button
            onClick={() => onAddEvent('negative')}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-600 text-sm hover:bg-emerald-200 transition-colors"
          >
            <Shield className="w-4 h-4" />
            添加活下来的时刻
          </button>

          {/* 事件节点 */}
          {sortedEvents.map((event, index) => {
            const year = new Date(event.date).getFullYear();
            const position = getPositionForYear(year);
            const isAbove = event.type === 'positive';
            
            // 计算垂直偏移，避免重叠
            const verticalOffset = (index % 3) * 60;
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="absolute cursor-pointer group"
                style={{
                  left: `${position}%`,
                  top: isAbove ? `${20 + verticalOffset}px` : 'auto',
                  bottom: isAbove ? 'auto' : `${20 + verticalOffset}px`,
                  transform: 'translateX(-50%)',
                }}
                onClick={() => setSelectedEvent(event)}
              >
                {/* 连接线 */}
                <div
                  className={`absolute left-1/2 w-px ${
                    isAbove 
                      ? 'top-full h-8 bg-rose-300' 
                      : 'bottom-full h-8 bg-emerald-300'
                  }`}
                  style={{ transform: 'translateX(-50%)' }}
                />
                
                {/* 事件卡片 */}
                <div
                  className={`relative p-3 rounded-xl shadow-soft min-w-[140px] max-w-[180px] transition-all group-hover:shadow-lg group-hover:scale-105 ${
                    isAbove 
                      ? 'bg-rose-50 border-2 border-rose-200' 
                      : 'bg-emerald-50 border-2 border-emerald-200'
                  }`}
                >
                  {/* 日期 */}
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    <Calendar className="w-3 h-3" />
                    {event.date}
                  </div>
                  
                  {/* 标题 */}
                  <p className={`font-medium text-sm line-clamp-2 ${
                    isAbove ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {event.title}
                  </p>
                  
                  {/* 图片指示 */}
                  {event.images.length > 0 && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${
                      isAbove ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      <ImageIcon className="w-3 h-3" />
                      {event.images.length} 张图片
                    </div>
                  )}
                  
                  {/* 悬停提示 */}
                  <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity`}>
                    点击查看详情
                  </div>
                </div>
                
                {/* 节点圆点 */}
                <div
                  className={`absolute left-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md ${
                    isAbove 
                      ? 'top-full mt-6 bg-rose-400' 
                      : 'bottom-full mb-6 bg-emerald-400'
                  }`}
                  style={{ transform: 'translateX(-50%)' }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 事件详情弹窗 */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-soft-lg max-w-md w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div className={`p-4 flex items-center justify-between ${
                selectedEvent.type === 'positive' 
                  ? 'bg-rose-50' 
                  : 'bg-emerald-50'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedEvent.type === 'positive' ? (
                    <Heart className="w-5 h-5 text-rose-500" />
                  ) : (
                    <Shield className="w-5 h-5 text-emerald-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    selectedEvent.type === 'positive' 
                      ? 'text-rose-600' 
                      : 'text-emerald-600'
                  }`}>
                    {selectedEvent.type === 'positive' ? '被伤害的时刻' : '活下来的时刻'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 rounded-full hover:bg-white/50 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* 内容 */}
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4" />
                  {selectedEvent.date}
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  {selectedEvent.title}
                </h3>
                
                <p className="text-gray-600 leading-relaxed mb-4">
                  {selectedEvent.description}
                </p>
                
                {/* 图片 */}
                {selectedEvent.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">相关图片</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedEvent.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`图片 ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-xl"
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 操作按钮 */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      onEventClick(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 py-3 rounded-xl gradient-rose text-white font-medium"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
