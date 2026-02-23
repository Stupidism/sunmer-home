import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, Sun, Moon, Sparkles, TrendingUp, 
  Check, Plus, X, ChevronRight, Wind
} from 'lucide-react';
import { timeSlots, getDailyQuote, defaultMicroGoals, type DailyMicroGoal } from '@/data/timeNavigation';
import { getRecommendedTools } from '@/data/emotionTree';
interface PsychConsoleProps {
  onNavigate: (view: string) => void;
  emotionRecords: { emotion: string; date: Date }[];
  onLogEmotion?: (emotions: string[]) => void;
}

// 今日情绪速记组件
function QuickMoodLogger({ onLog }: { onLog: (emotions: string[]) => void }) {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const quickEmotions = ['平静', '焦虑', '委屈', '疲惫', '喜悦', '烦躁'];

  const toggleEmotion = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
    }
  };

  const handleSave = () => {
    if (selectedEmotions.length > 0) {
      onLog(selectedEmotions);
      setSelectedEmotions([]);
      setIsOpen(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-soft p-5">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">今天感觉……</p>
              <p className="text-sm text-gray-500">快速记录当下情绪</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium text-gray-800">此刻，我感觉：</p>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {quickEmotions.map(emotion => (
              <button
                key={emotion}
                onClick={() => toggleEmotion(emotion)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  selectedEmotions.includes(emotion)
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-rose-100'
                }`}
              >
                {emotion}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={selectedEmotions.length === 0}
            className="w-full py-3 rounded-xl bg-rose-500 text-white font-medium disabled:opacity-50"
          >
            记录一下
          </button>
        </motion.div>
      )}
    </div>
  );
}

// 今日微目标组件
function MicroGoals() {
  const [goals, setGoals] = useState<DailyMicroGoal[]>(defaultMicroGoals);
  const [newGoal, setNewGoal] = useState('');
  const [showInput, setShowInput] = useState(false);

  const toggleGoal = (id: string) => {
    setGoals(goals.map(g => 
      g.id === id ? { ...g, completed: !g.completed } : g
    ));
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals([...goals, {
        id: Date.now().toString(),
        text: newGoal,
        completed: false,
        category: 'custom'
      }]);
      setNewGoal('');
      setShowInput(false);
    }
  };

  const completedCount = goals.filter(g => g.completed).length;

  return (
    <div className="bg-white rounded-3xl shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          <h3 className="font-medium text-gray-800">今日微目标</h3>
        </div>
        <span className="text-sm text-gray-400">{completedCount}/{goals.length}</span>
      </div>

      <div className="space-y-2">
        {goals.map(goal => (
          <button
            key={goal.id}
            onClick={() => toggleGoal(goal.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
              goal.completed ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              goal.completed ? 'bg-emerald-500' : 'border-2 border-gray-300'
            }`}>
              {goal.completed && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-sm ${goal.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {goal.text}
            </span>
          </button>
        ))}
      </div>

      {showInput ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="想完成什么？"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          />
          <button onClick={addGoal} className="px-3 py-2 bg-rose-500 text-white rounded-xl text-sm">
            添加
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm hover:border-rose-300 hover:text-rose-500 transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          添加目标
        </button>
      )}

      {completedCount === goals.length && goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl text-center"
        >
          <p className="text-amber-700 text-sm">
            🎉 你今天照顾了自己 {completedCount} 次
          </p>
        </motion.div>
      )}
    </div>
  );
}

// 时间轴卡片
function TimeSlotCard({ slot, onClick, index }: { 
  slot: typeof timeSlots[0]; 
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="w-full text-left"
    >
      <div className={`p-4 rounded-2xl ${slot.bgColor} hover:shadow-md transition-shadow`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${slot.color} flex items-center justify-center text-2xl shadow-lg`}>
            {slot.icon}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800">{slot.title}</h4>
            <p className="text-sm text-gray-500">{slot.subtitle}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </motion.button>
  );
}

// 情绪树入口
function EmotionTreeEntrance({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      onClick={onClick}
      className="w-full"
    >
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border-2 border-emerald-100 hover:border-emerald-300 transition-colors">
        <div className="flex items-center gap-4">
          <div className="text-5xl">🌳</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-1">我现在感觉……</h3>
            <p className="text-sm text-gray-500">点击展开情绪树，找到适合的工具</p>
          </div>
          <ChevronRight className="w-6 h-6 text-emerald-500" />
        </div>
        
        {/* 情绪预览 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {['焦虑', '委屈', '自责', '愤怒', '疲惫', '平静'].map((emotion, i) => (
            <span 
              key={emotion} 
              className="px-3 py-1 rounded-full bg-white/70 text-gray-600 text-sm"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {emotion}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}

// 智能推荐组件
function SmartRecommendation({ 
  recentEmotions,
  onClick 
}: { 
  recentEmotions: string[];
  onClick: () => void;
}) {
  // 根据最近情绪生成推荐
  const getRecommendation = () => {
    if (recentEmotions.length === 0) {
      return {
        text: '今天想试试【4-7-8呼吸法】吗？',
        subtext: '3分钟快速平复焦虑',
        tool: 'breathing'
      };
    }
    
    const latestEmotion = recentEmotions[recentEmotions.length - 1];
    const tools = getRecommendedTools(latestEmotion);
    
    if (tools.length > 0) {
      const tool = tools[0];
      return {
        text: `最近你常感到${latestEmotion}，要不要试试【${tool.name}】？`,
        subtext: `${tool.duration} - ${tool.description}`,
        tool: tool.id
      };
    }
    
    return {
      text: '今天想试试【身体扫描】吗？',
      subtext: '5分钟让身体放松下来',
      tool: 'body-scan'
    };
  };

  const recommendation = getRecommendation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-violet-500 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-gray-700">{recommendation.text}</p>
          <p className="text-xs text-gray-400 mt-1">{recommendation.subtext}</p>
        </div>
        <button 
          onClick={onClick}
          className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-sm"
        >
          试试
        </button>
      </div>
    </motion.div>
  );
}

// 主组件
export function PsychConsole({ 
  onNavigate,
  emotionRecords,
  onLogEmotion
}: PsychConsoleProps) {
  const dailyQuote = getDailyQuote();
  const recentEmotions = emotionRecords.map(r => r.emotion);

  const handleMoodLog = (emotions: string[]) => {
    // 调用父组件的回调
    onLogEmotion?.(emotions);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/50 to-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-rose-100/50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-800">心理安全岛</span>
          </div>
          <button 
            onClick={() => onNavigate('stats')}
            className="flex items-center gap-1 text-sm text-gray-500"
          >
            <TrendingUp className="w-4 h-4" />
            统计
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 每日语录 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <p className="text-lg text-gray-700 font-medium leading-relaxed">
            "{dailyQuote.text}"
          </p>
        </motion.div>

        {/* 情绪速记 + 微目标 */}
        <div className="grid grid-cols-1 gap-4">
          <QuickMoodLogger onLog={handleMoodLog} />
          <MicroGoals />
        </div>

        {/* 我的时间轴 */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            我的时间轴
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {timeSlots.map((slot, index) => (
              <TimeSlotCard 
                key={slot.id} 
                slot={slot} 
                index={index}
                onClick={() => onNavigate(slot.id)}
              />
            ))}
          </div>
        </div>

        {/* 情绪树入口 */}
        <EmotionTreeEntrance onClick={() => onNavigate('emotion-tree')} />

        {/* 智能推荐 */}
        <SmartRecommendation 
          recentEmotions={recentEmotions}
          onClick={() => onNavigate('mindfulness')}
        />
      </div>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2">
        <div className="max-w-lg mx-auto flex justify-around">
          <button 
            onClick={() => onNavigate('home')}
            className="flex flex-col items-center gap-1 p-2 text-rose-500"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">首页</span>
          </button>
          <button 
            onClick={() => onNavigate('emotion-tree')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-emerald-500"
          >
            <Wind className="w-5 h-5" />
            <span className="text-xs">急救</span>
          </button>
          <button 
            onClick={() => onNavigate('evening')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-indigo-500"
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs">回顾</span>
          </button>
          <button 
            onClick={() => onNavigate('profile')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-xs">我的</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
