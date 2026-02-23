import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, BookOpen, History, Sparkles, FileText, Sparkle, TrendingUp, Lightbulb, ChevronDown, Leaf } from 'lucide-react';
import { babyRelationshipTemplate, otherTemplates } from '@/data/babyRelationshipTemplate';
import { BeliefCarousel } from '@/components/BeliefCarousel';
import { EmotionTree } from '@/components/EmotionTree';
import { EmotionIntensityAxis } from '@/components/EmotionIntensityAxis';
import type { Belief } from '@/types';

interface HomePageProps {
  beliefs: Belief[];
  onSelectTemplate: (templateId: string) => void;
  onViewHistory: () => void;
  onViewArticles: () => void;
  onViewLifeLine: () => void;
  onViewMindfulness: () => void;
  onSelectBelief: (beliefId: string) => void;
  onRecordSuccess: () => void;
  recordCount: number;
}

// 场景指引数据
const scenarioGuides = [
  {
    id: 'scenario-1',
    title: '和宝宝之间发生了让你困惑的事',
    templates: ['baby-relationship', 'ifs'],
  },
  {
    id: 'scenario-2',
    title: '心里涌起一股暖意，哪怕很小',
    templates: ['gratitude-journal'],
  },
  {
    id: 'scenario-3',
    title: '你主动付出了爱，或者创造了美',
    templates: ['love-ability'],
  },
  {
    id: 'scenario-4',
    title: '你又在怪自己，觉得"都是我的错"',
    templates: ['self-attribution', 'ifs'],
  },
  {
    id: 'scenario-5',
    title: '关系冲突时——对某人强烈反感',
    templates: ['ifs'],
  },
];

export function HomePage({
  beliefs,
  onSelectTemplate,
  onViewHistory,
  onViewArticles,
  onViewLifeLine,
  onViewMindfulness,
  onSelectBelief,
  onRecordSuccess,
  recordCount
}: HomePageProps) {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  
  // 按指定顺序排列模板
  const orderedTemplates = [
    ...otherTemplates.filter(t => t.id === 'gratitude-journal'),
    ...otherTemplates.filter(t => t.id === 'love-ability'),
    babyRelationshipTemplate,
    ...otherTemplates.filter(t => t.id === 'self-attribution'),
    ...otherTemplates.filter(t => t.id === 'ifs'),
  ];

  const getTemplateById = (id: string) => {
    return orderedTemplates.find(t => t.id === id);
  };

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-rose-100/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-rose flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-800">情绪记录空间</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewMindfulness}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700 text-sm font-medium"
            >
              <Leaf className="w-4 h-4" />
              <span>正念</span>
            </button>
            <button
              onClick={onViewLifeLine}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 transition-colors text-gray-700 text-sm font-medium"
            >
              <TrendingUp className="w-4 h-4" />
              <span>生命线</span>
            </button>
            <button
              onClick={onViewArticles}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 transition-colors text-gray-700 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>温暖文章</span>
            </button>
            <button
              onClick={onViewHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 transition-colors text-gray-700 text-sm font-medium"
            >
              <History className="w-4 h-4" />
              <span>记录历史</span>
              {recordCount > 0 && (
                <span className="w-5 h-5 rounded-full gradient-rose text-white text-xs flex items-center justify-center">
                  {recordCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100/60 text-rose-600 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>记录情绪，关爱自己</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 leading-tight">
              欢迎来到你的<span className="text-gradient">情绪空间</span>
            </h1>
            <p className="text-gray-600 text-lg leading-relaxed max-w-xl mx-auto">
              选择一个模板，开始记录当下的感受。每一次记录，都是对自己的一次温柔关怀。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Emotion Tree & Intensity Axis Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Emotion Tree */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <EmotionTree />
            </motion.div>

            {/* Emotion Intensity Axis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <EmotionIntensityAxis />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Beliefs Carousel Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-amber-500" />
              我的新信念
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <BeliefCarousel
              beliefs={beliefs}
              onSelectBelief={onSelectBelief}
              onRecordSuccess={onRecordSuccess}
            />
          </motion.div>
        </div>
      </section>

      {/* Scenario Guides Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              不知道选哪个？看看场景指引
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="space-y-3"
          >
            {scenarioGuides.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-white rounded-2xl shadow-soft overflow-hidden"
              >
                <button
                  onClick={() => setExpandedScenario(
                    expandedScenario === scenario.id ? null : scenario.id
                  )}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <span className="text-gray-700 font-medium">{scenario.title}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedScenario === scenario.id ? 'rotate-180' : ''
                    }}`}
                  />
                </button>
                <AnimatePresence>
                  {expandedScenario === scenario.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-sm text-gray-400 mb-3">推荐模板：</p>
                        <div className="flex flex-wrap gap-2">
                          {scenario.templates.map((templateId) => {
                            const template = getTemplateById(templateId);
                            if (!template) return null;
                            return (
                              <button
                                key={templateId}
                                onClick={() => onSelectTemplate(templateId)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-rose-50 transition-colors group"
                              >
                                <span className="text-lg">{template.icon}</span>
                                <span className="text-sm text-gray-700 group-hover:text-rose-600">
                                  {template.title}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Templates Grid */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-rose-500" />
              选择记录模板
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {orderedTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
              >
                <button
                  onClick={() => onSelectTemplate(template.id)}
                  className="w-full text-left group"
                >
                  <div className={`relative p-6 rounded-2xl bg-white shadow-soft hover-lift overflow-hidden`}>
                    {/* 背景装饰 */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${template.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2`} />
                    
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${template.color} flex items-center justify-center text-3xl shadow-lg`}>
                          {template.icon}
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {template.questionCount} 个问题
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-rose-600 transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        {template.description}
                      </p>
                    </div>

                    {/* 悬停指示器 */}
                    <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-rose-500 text-lg">→</span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center">
        <p className="text-gray-400 text-sm">
          每一次记录，都是爱自己的方式 💕
        </p>
      </footer>
    </div>
  );
}
