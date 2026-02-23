import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles, Heart } from 'lucide-react';
import { mindfulnessScenarios, mindfulnessHabits } from '@/data/mindfulness';

interface MindfulnessPageProps {
  onBack: () => void;
}

export function MindfulnessPage({ onBack }: MindfulnessPageProps) {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-rose-100/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/60 transition-colors text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-800">正念指南</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100/60 text-emerald-600 text-sm font-medium mb-4">
            <Heart className="w-4 h-4" />
            <span>回到当下，温柔对待自己</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
            生活中的正念时刻
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            正念不是逃避，而是带着觉察与当下相处。选择你需要的场景，找到属于你的平静。
          </p>
        </motion.div>

        {/* Scenarios Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              🧘
            </span>
            场景正念指南
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {mindfulnessScenarios.map((scenario, index) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-white rounded-2xl shadow-soft overflow-hidden"
              >
                <button
                  onClick={() => setExpandedScenario(
                    expandedScenario === scenario.id ? null : scenario.id
                  )}
                  className="w-full p-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${scenario.color} flex items-center justify-center text-2xl shadow-lg`}>
                      {scenario.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{scenario.title}</h3>
                      <p className="text-sm text-gray-500">{scenario.situation}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedScenario === scenario.id ? 'rotate-180' : ''
                    }`}
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
                      <div className="p-5 space-y-6">
                        {/* Cycle */}
                        <div className="p-4 bg-rose-50 rounded-xl">
                          <p className="text-sm font-medium text-rose-700 mb-1">恶性循环</p>
                          <p className="text-sm text-rose-600">{scenario.cycle}</p>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                          {scenario.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="relative pl-6">
                              <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{stepIndex + 1}</span>
                              </div>
                              <div className="pb-2">
                                <p className="font-medium text-gray-800 mb-2">{step.phase}</p>
                                <ul className="space-y-1">
                                  {step.actions.map((action, actionIndex) => (
                                    <li key={actionIndex} className="text-sm text-gray-600 flex items-start gap-2">
                                      <span className="text-emerald-500 mt-0.5">•</span>
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Questions */}
                        {scenario.questions && scenario.questions.length > 0 && (
                          <div className="p-4 bg-amber-50 rounded-xl">
                            <p className="text-sm font-medium text-amber-700 mb-2">觉察提问</p>
                            <ul className="space-y-1">
                              {scenario.questions.map((question, qIndex) => (
                                <li key={qIndex} className="text-sm text-amber-600 flex items-start gap-2">
                                  <span className="text-amber-400">?</span>
                                  {question}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Habits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              ✨
            </span>
            正念微习惯
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mindfulnessHabits.map((habit, index) => (
              <motion.div
                key={habit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index + 0.4 }}
                className="bg-white rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-lg transition-shadow"
                onClick={() => setExpandedHabit(
                  expandedHabit === habit.title ? null : habit.title
                )}
              >
                <h3 className="font-semibold text-gray-800 mb-2">{habit.title}</h3>
                <p className="text-sm text-gray-500">{habit.description}</p>

                <AnimatePresence>
                  {expandedHabit === habit.title && habit.examples.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-gray-100"
                    >
                      <ul className="space-y-1">
                        {habit.examples.map((example, exIndex) => (
                          <li key={exIndex} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-emerald-500">•</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl"
        >
          <p className="text-center text-emerald-700">
            <span className="font-medium">记住：</span>
            正念不是要达到某种状态，而是<span className="font-medium">觉察</span>当下正在发生什么。
            哪怕只有<span className="font-medium">1秒钟</span>的觉察，也是正念。
          </p>
        </motion.div>
      </div>
    </div>
  );
}
