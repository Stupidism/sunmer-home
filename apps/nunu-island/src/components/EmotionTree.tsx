import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { emotionCategories, emotionIndex } from '@/data/emotions';

export function EmotionTree() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIndex, setShowIndex] = useState(false);

  const filteredIndex = searchTerm
    ? emotionIndex.filter(
        (e) =>
          e.name.includes(searchTerm) ||
          e.scenario.includes(searchTerm) ||
          e.category.includes(searchTerm)
      )
    : [];

  return (
    <div className="bg-white rounded-3xl shadow-soft-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800">情绪词汇树</h3>
          <p className="text-sm text-gray-400">点击类别查看情绪词汇</p>
        </div>
        <button
          onClick={() => setShowIndex(!showIndex)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm hover:bg-rose-100 transition-colors"
        >
          <Search className="w-4 h-4" />
          {showIndex ? '关闭索引' : '词汇索引'}
        </button>
      </div>

      {/* Search Index */}
      <AnimatePresence>
        {showIndex && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索情绪词汇..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {searchTerm ? (
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {filteredIndex.length > 0 ? (
                    <div className="space-y-2">
                      {filteredIndex.map((emotion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{emotion.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              {emotion.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{emotion.scenario}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-4">没有找到匹配的情绪词汇</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {emotionIndex.map((emotion, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-600 hover:border-rose-300 hover:text-rose-600 cursor-pointer transition-colors"
                      onClick={() => setSearchTerm(emotion.name)}
                    >
                      {emotion.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tree Visualization */}
      <div className="relative">
        {/* Central Trunk */}
        <div className="flex justify-center mb-8">
          <div className="w-4 h-16 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
        </div>

        {/* Branches */}
        <div className="grid grid-cols-2 gap-4">
          {emotionCategories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative ${index >= 2 ? 'col-span-1' : ''}`}
            >
              {/* Branch Line */}
              <div
                className={`absolute top-0 w-px h-8 bg-gradient-to-b ${category.color}`}
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              />

              {/* Category Card */}
              <button
                onClick={() =>
                  setSelectedCategory(selectedCategory === category.id ? null : category.id)
                }
                className={`w-full mt-8 p-4 rounded-2xl transition-all ${category.bgColor} ${
                  selectedCategory === category.id
                    ? `ring-2 ring-offset-2 ring-rose-400`
                    : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{category.icon}</span>
                  <span className="font-bold text-gray-800">{category.name}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {category.emotions.length} 个
                  </span>
                </div>

                <AnimatePresence>
                  {selectedCategory === category.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 pt-2 border-t border-gray-200/50"
                    >
                      {category.emotions.map((emotion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white/70 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">{emotion.name}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{emotion.scenario}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {selectedCategory !== category.id && (
                  <p className="text-sm text-gray-400 mt-2">
                    {category.emotions.slice(0, 3).map((e) => e.name).join('、')}...
                  </p>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="mt-6 p-4 bg-amber-50 rounded-xl">
        <p className="text-sm text-amber-700">
          💡 精准的情绪词汇能帮你更清楚地看见自己。试着用具体的词代替"不舒服""有点难受"。
        </p>
      </div>
    </div>
  );
}
