import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { activityConfig, durationOptions, getRandomEncouragement, type ActivityType } from '@/data/mindfulnessTracker';

interface MindfulnessTrackerPageProps {
  onBack: () => void;
}

// 计时器组件
function Timer({ 
  type, 
  duration, 
  onComplete, 
  onCancel 
}: { 
  type: ActivityType;
  duration: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isRunning, setIsRunning] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setShowComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  if (showComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="text-6xl mb-4">✨</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {getRandomEncouragement(type, duration)}
        </h3>
        <p className="text-gray-500 mb-6">
          你刚刚完成了 {duration} 分钟的{activityConfig[type].name}
        </p>
        <button
          onClick={onComplete}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-medium"
        >
          记录本次
        </button>
      </motion.div>
    );
  }

  return (
    <div className="text-center py-8">
      {/* 进度圆环 */}
      <div className="relative w-48 h-48 mx-auto mb-8">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="96"
            cy="96"
            r="88"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-800">
            {formatTime(timeLeft)}
          </span>
          <span className="text-sm text-gray-400 mt-1">
            {isRunning ? '进行中' : '已暂停'}
          </span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg"
        >
          {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </button>
        <button
          onClick={onCancel}
          className="w-12 h-12 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* 提示语 */}
      <p className="mt-8 text-gray-500 text-sm">
        {type === 'breathing' && '跟随你的呼吸，吸气...呼气...'}
        {type === 'mindfulness' && '保持觉察，让念头来去'}
        {type === 'exercise' && '感受身体的力量'}
      </p>
    </div>
  );
}

// 日历组件
function ActivityCalendar({ records }: { records: { date: Date; type: ActivityType }[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getDayActivities = (day: number) => {
    const date = new Date(year, month, day);
    return records.filter(r => 
      r.date.toDateString() === date.toDateString()
    );
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <div className="bg-white rounded-3xl shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-medium">
          {year}年{month + 1}月
        </h3>
        <button onClick={nextMonth}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          
          const activities = getDayActivities(day);
          const hasMindfulness = activities.some(a => a.type === 'mindfulness');
          const hasExercise = activities.some(a => a.type === 'exercise');
          const hasBreathing = activities.some(a => a.type === 'breathing');
          
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

          return (
            <div
              key={day}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm ${
                isToday ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              <span className={isToday ? 'font-bold text-emerald-600' : 'text-gray-700'}>
                {day}
              </span>
              <div className="flex gap-0.5 mt-0.5">
                {hasMindfulness && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {hasExercise && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                {hasBreathing && <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>正念</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span>运动</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span>呼吸</span>
        </div>
      </div>
    </div>
  );
}

export function MindfulnessTrackerPage({ onBack }: MindfulnessTrackerPageProps) {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [records, setRecords] = useState<{ date: Date; type: ActivityType }[]>([]);
  const [view, setView] = useState<'select' | 'timer' | 'stats'>('select');

  const startTimer = () => {
    if (selectedType && selectedDuration) {
      setView('timer');
    }
  };

  const handleComplete = () => {
    if (selectedType) {
      setRecords([...records, { date: new Date(), type: selectedType }]);
    }
    setSelectedType(null);
    setSelectedDuration(null);
    setView('stats');
  };

  const handleCancel = () => {
    setSelectedType(null);
    setSelectedDuration(null);
    setView('select');
  };

  // 统计数据
  const stats = {
    total: records.length,
    mindfulness: records.filter(r => r.type === 'mindfulness').length,
    exercise: records.filter(r => r.type === 'exercise').length,
    breathing: records.filter(r => r.type === 'breathing').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100/50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <div className="flex-1 text-center font-semibold text-gray-800">
            🧘 正念与运动
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {view === 'timer' && selectedType && selectedDuration ? (
            <motion.div
              key="timer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Timer
                type={selectedType}
                duration={selectedDuration}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            </motion.div>
          ) : view === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {selectedType ? getRandomEncouragement(selectedType, selectedDuration || 5) : '做得好！'}
              </h3>
              <button
                onClick={() => setView('select')}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-medium"
              >
                继续
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* 类型选择 */}
              <div>
                <h3 className="font-medium text-gray-800 mb-3">选择类型</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(activityConfig) as ActivityType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`p-4 rounded-2xl text-center transition-all ${
                        selectedType === type
                          ? `bg-gradient-to-br ${activityConfig[type].color} text-white shadow-lg`
                          : 'bg-white shadow-soft'
                      }`}
                    >
                      <div className="text-3xl mb-2">{activityConfig[type].icon}</div>
                      <p className={`text-sm font-medium ${
                        selectedType === type ? 'text-white' : 'text-gray-700'
                      }`}>
                        {activityConfig[type].name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 时长选择 */}
              {selectedType && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h3 className="font-medium text-gray-800 mb-3">选择时长</h3>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((duration) => (
                      <button
                        key={duration}
                        onClick={() => setSelectedDuration(duration)}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${
                          selectedDuration === duration
                            ? `bg-gradient-to-r ${activityConfig[selectedType].color} text-white`
                            : 'bg-white shadow-soft text-gray-700'
                        }`}
                      >
                        {duration} 分钟
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 开始按钮 */}
              {selectedType && selectedDuration && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={startTimer}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-r ${activityConfig[selectedType].color} text-white font-medium text-lg shadow-lg`}
                >
                  开始 {activityConfig[selectedType].name}
                </motion.button>
              )}

              {/* 统计 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-white shadow-soft text-center">
                  <p className="text-xl font-bold text-emerald-500">{stats.total}</p>
                  <p className="text-xs text-gray-400">总次数</p>
                </div>
                <div className="p-3 rounded-2xl bg-white shadow-soft text-center">
                  <p className="text-xl font-bold text-emerald-500">{stats.mindfulness}</p>
                  <p className="text-xs text-gray-400">正念</p>
                </div>
                <div className="p-3 rounded-2xl bg-white shadow-soft text-center">
                  <p className="text-xl font-bold text-blue-500">{stats.exercise}</p>
                  <p className="text-xs text-gray-400">运动</p>
                </div>
                <div className="p-3 rounded-2xl bg-white shadow-soft text-center">
                  <p className="text-xl font-bold text-sky-500">{stats.breathing}</p>
                  <p className="text-xs text-gray-400">呼吸</p>
                </div>
              </div>

              {/* 日历 */}
              <ActivityCalendar records={records} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
