import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Shield, Sparkles, TrendingUp } from 'lucide-react';
import { LifeLineVisualizer } from '@/components/LifeLineVisualizer';
import { LifeEventDialog } from '@/components/LifeEventDialog';
import type { LifeEvent } from '@/data/lifeLine';
import { 
  getLifeEvents, 
  addLifeEvent, 
  updateLifeEvent, 
  deleteLifeEvent,
  sortEventsByDate 
} from '@/data/lifeLine';

interface LifeLinePageProps {
  onBack: () => void;
}

export function LifeLinePage({ onBack }: LifeLinePageProps) {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'positive' | 'negative'>('negative');
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);

  // 加载事件
  useEffect(() => {
    const loadedEvents = getLifeEvents();
    setEvents(loadedEvents);
  }, []);

  // 统计数据
  const positiveEvents = events.filter((e) => e.type === 'positive');
  const negativeEvents = events.filter((e) => e.type === 'negative');
  const sortedEvents = sortEventsByDate(events);
  const earliestEvent = sortedEvents[0];
  const latestEvent = sortedEvents[sortedEvents.length - 1];

  const handleAddEvent = (type: 'positive' | 'negative') => {
    setDialogType(type);
    setEditingEvent(null);
    setIsDialogOpen(true);
  };

  const handleEditEvent = (event: LifeEvent) => {
    setDialogType(event.type);
    setEditingEvent(event);
    setIsDialogOpen(true);
  };

  const handleSaveEvent = (eventData: Omit<LifeEvent, 'id' | 'createdAt'>) => {
    if (editingEvent) {
      const updated = updateLifeEvent(editingEvent.id, eventData);
      if (updated) {
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      }
    } else {
      const newEvent = addLifeEvent(eventData);
      setEvents((prev) => [...prev, newEvent]);
    }
  };

  const handleDeleteEvent = (id: string) => {
    if (deleteLifeEvent(id)) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-rose-100/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <span className="text-lg font-semibold text-gray-800">生命线</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100/60 text-purple-600 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              <span>看见你的完整人生</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
              你的生命<span className="text-gradient">时间轴</span>
            </h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              线上方是被伤害的时刻，线下方是你活下来的证明。每一个点，都是你生命的一部分。
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-2">
                <Heart className="w-5 h-5 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-500">{positiveEvents.length}</p>
              <p className="text-xs text-gray-500">被伤害的时刻</p>
            </div>
            <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-500">{negativeEvents.length}</p>
              <p className="text-xs text-gray-500">活下来的时刻</p>
            </div>
            <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-purple-500">{events.length}</p>
              <p className="text-xs text-gray-500">总记录数</p>
            </div>
          </motion.div>

          {/* Timeline Info */}
          {events.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-soft p-4 mb-6"
            >
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                  <span className="text-gray-400">最早：</span>
                  <span className="font-medium text-gray-700">
                    {earliestEvent?.date} · {earliestEvent?.title}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">最新：</span>
                  <span className="font-medium text-gray-700">
                    {latestEvent?.date} · {latestEvent?.title}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Life Line Visualizer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl shadow-soft-lg p-6"
          >
            {events.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-10 h-10 text-purple-300" />
                </div>
                <p className="text-gray-500 mb-2">还没有记录</p>
                <p className="text-gray-400 text-sm mb-6">点击下方按钮，开始绘制你的生命线</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleAddEvent('positive')}
                    className="px-6 py-3 rounded-xl bg-rose-100 text-rose-600 font-medium hover:bg-rose-200 transition-colors"
                  >
                    添加被伤害的时刻
                  </button>
                  <button
                    onClick={() => handleAddEvent('negative')}
                    className="px-6 py-3 rounded-xl bg-emerald-100 text-emerald-600 font-medium hover:bg-emerald-200 transition-colors"
                  >
                    添加活下来的时刻
                  </button>
                </div>
              </div>
            ) : (
              <LifeLineVisualizer
                events={events}
                onEventClick={handleEditEvent}
                onAddEvent={handleAddEvent}
              />
            )}
          </motion.div>

          {/* Encouragement */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6">
              <p className="text-gray-600 leading-relaxed mb-2">
                "每一个被伤害的时刻，都对应着一个你活下来的时刻。"
              </p>
              <p className="text-gray-500 text-sm">
                你比你想象的更坚强 💪
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Add/Edit Dialog */}
      <LifeEventDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        initialType={dialogType}
        editingEvent={editingEvent}
      />
    </div>
  );
}
