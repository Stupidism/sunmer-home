import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, ChevronRight } from 'lucide-react';
import { emotionBranches, getRecommendedTools, tools } from '@/data/emotionTree';

interface EmotionTreePageProps {
  onBack: () => void;
  onSelectTool: (toolId: string) => void;
}

// 情绪树叶组件
function EmotionLeaf({ 
  leaf, 
  branchColor,
  onClick 
}: { 
  leaf: typeof emotionBranches[0]['leaves'][0];
  branchColor: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center p-3 rounded-2xl bg-white shadow-soft hover:shadow-soft-lg transition-shadow"
    >
      <span className="text-3xl mb-1">{leaf.icon}</span>
      <span className="text-sm font-medium text-gray-700">{leaf.name}</span>
      <div className="flex gap-0.5 mt-1">
        {Array.from({ length: Math.ceil(leaf.intensity / 2) }).map((_, i) => (
          <div 
            key={i} 
            className={`w-1 h-1 rounded-full bg-gradient-to-r ${branchColor}`}
          />
        ))}
      </div>
    </motion.button>
  );
}

// 工具卡片
function ToolCard({ 
  tool, 
  onClick,
  index
}: { 
  tool: typeof tools[0];
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="w-full p-4 rounded-2xl bg-white shadow-soft hover:shadow-soft-lg transition-shadow text-left"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>
          {tool.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800">{tool.name}</h4>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {tool.duration}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </motion.button>
  );
}

// 工具引导页
function ToolGuide({ 
  tool, 
  onBack,
  onComplete
}: { 
  tool: typeof tools[0];
  onBack: () => void;
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const startPractice = () => {
    setIsRunning(true);
  };

  const completePractice = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* 工具介绍 */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-4xl shadow-lg mx-auto mb-4`}>
            {tool.icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{tool.name}</h2>
          <p className="text-gray-500 mt-2">{tool.description}</p>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            {tool.duration}
          </div>
        </div>

        {!isRunning ? (
          /* 准备开始 */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-soft p-6">
              <h3 className="font-semibold text-gray-800 mb-4">步骤</h3>
              <div className="space-y-3">
                {tool.steps?.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-gray-600 text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startPractice}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white font-medium text-lg shadow-lg"
            >
              开始练习
            </button>
          </div>
        ) : (
          /* 练习中 */
          <div className="text-center">
            {tool.type === 'breathing' && (
              <div className="mb-8">
                <motion.div
                  animate={{ 
                    scale: [1, 1.5, 1],
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-sky-300 to-blue-400 mx-auto flex items-center justify-center"
                >
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-white text-lg font-medium"
                  >
                    吸气
                  </motion.div>
                </motion.div>
                <p className="text-gray-500 mt-4">跟随圆球的节奏呼吸</p>
              </div>
            )}

            {tool.type === 'meditation' && (
              <div className="mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 rounded-full border-4 border-emerald-200 border-t-emerald-500 mx-auto"
                />
                <p className="text-gray-500 mt-4">保持觉察，让念头来去</p>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-soft p-6 mb-6">
              <p className="text-gray-600">
                {tool.steps?.[currentStep] || '保持专注...'}
              </p>
            </div>

            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600"
                >
                  上一步
                </button>
              )}
              {currentStep < (tool.steps?.length || 0) - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex-1 py-3 rounded-xl bg-rose-500 text-white"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={completePractice}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white"
                >
                  完成练习
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 主页面
export function EmotionTreePage({ onBack, onSelectTool }: EmotionTreePageProps) {
  const [selectedBranch, setSelectedBranch] = useState<typeof emotionBranches[0] | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<typeof tools[0] | null>(null);

  // 选择情绪后显示工具推荐
  if (selectedEmotion && !selectedTool) {
    const recommendedTools = getRecommendedTools(selectedEmotion);

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <button 
              onClick={() => setSelectedEmotion(null)} 
              className="flex items-center gap-2 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回</span>
            </button>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <p className="text-gray-500">你感到</p>
            <h2 className="text-3xl font-bold text-gray-800 mt-1">{selectedEmotion}</h2>
            <p className="text-gray-400 text-sm mt-2">这是可以用的工具：</p>
          </div>

          <div className="space-y-3">
            {recommendedTools.map((tool, index) => (
              <ToolCard 
                key={tool.id} 
                tool={tool} 
                index={index}
                onClick={() => setSelectedTool(tool)}
              />
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-2xl">
            <p className="text-amber-700 text-sm text-center">
              💡 记住：情绪会来，也会走。你不需要立刻解决它，只需要陪它一会儿。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 显示工具引导
  if (selectedTool) {
    return (
      <ToolGuide
        tool={selectedTool}
        onBack={() => setSelectedTool(null)}
        onComplete={() => {
          onSelectTool(selectedTool.id);
          setSelectedTool(null);
          setSelectedEmotion(null);
        }}
      />
    );
  }

  // 情绪树主界面
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100/50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="w-5 h-5" />
            <span>返回首页</span>
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">我现在感觉……</h2>
          <p className="text-gray-500 mt-2">选择一个最贴近的情绪</p>
        </div>

        {/* 情绪树 */}
        <div className="space-y-4">
          {emotionBranches.map((branch, index) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-3xl overflow-hidden ${branch.bgColor}`}
            >
              {/* 分支标题 */}
              <button
                onClick={() => setSelectedBranch(
                  selectedBranch?.id === branch.id ? null : branch
                )}
                className="w-full p-4 flex items-center gap-4"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${branch.color} flex items-center justify-center text-3xl shadow-lg`}>
                  {branch.icon}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-800">{branch.name}</h3>
                  <p className="text-sm text-gray-500">{branch.description}</p>
                </div>
                <motion.div
                  animate={{ rotate: selectedBranch?.id === branch.id ? 90 : 0 }}
                  className="text-gray-400"
                >
                  <ChevronRight className="w-6 h-6" />
                </motion.div>
              </button>

              {/* 展开的叶子 */}
              <AnimatePresence>
                {selectedBranch?.id === branch.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4"
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {branch.leaves.map((leaf) => (
                        <EmotionLeaf
                          key={leaf.id}
                          leaf={leaf}
                          branchColor={branch.color}
                          onClick={() => setSelectedEmotion(leaf.name)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* 提示 */}
        <div className="mt-6 p-4 bg-white rounded-2xl shadow-soft">
          <p className="text-gray-600 text-sm text-center">
            🌿 每一种情绪都是信使，它们在告诉你一些事情。
            <br />
            不需要评判，只需要看见。
          </p>
        </div>
      </div>
    </div>
  );
}
