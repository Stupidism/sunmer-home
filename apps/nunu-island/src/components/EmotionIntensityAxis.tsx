import { motion } from 'framer-motion';
import { emotionIntensities } from '@/data/emotions';

export function EmotionIntensityAxis() {
  return (
    <div className="bg-white rounded-3xl shadow-soft-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800">情绪强度数轴</h3>
        <p className="text-sm text-gray-400">同一个情绪，从轻度到重度</p>
      </div>

      {/* Axis */}
      <div className="space-y-6">
        {emotionIntensities.map((item, index) => (
          <motion.div
            key={item.emotion}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Emotion Label */}
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${item.color}`}>
                {item.emotion}
              </span>
            </div>

            {/* Intensity Bar */}
            <div className="relative h-12 bg-gray-100 rounded-xl overflow-hidden">
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-20`}
              />

              {/* Intensity Markers */}
              <div className="absolute inset-0 flex">
                {/* Mild */}
                <div className="flex-1 flex items-center justify-center border-r border-white/50 relative group">
                  <span className="text-sm text-gray-600 font-medium">{item.mild}</span>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-300" />
                  
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    轻度
                  </div>
                </div>

                {/* Moderate */}
                <div className="flex-1 flex items-center justify-center border-r border-white/50 relative group">
                  <span className="text-sm text-gray-700 font-medium">{item.moderate}</span>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-400" />
                  
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    中度
                  </div>
                </div>

                {/* Severe */}
                <div className="flex-1 flex items-center justify-center relative group">
                  <span className={`text-sm font-medium bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                    {item.severe}
                  </span>
                  <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-r ${item.color}`} />
                  
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    重度
                  </div>
                </div>
              </div>

              {/* Intensity Arrow */}
              <div className="absolute bottom-1 left-4 right-4 flex items-center justify-between text-xs text-gray-400">
                <span>轻</span>
                <div className="flex-1 mx-2 h-px bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500" />
                <span>重</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <span>轻度</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span>中度</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-400 to-rose-500" />
          <span>重度</span>
        </div>
      </div>

      {/* Tip */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-700">
          💡 识别情绪的强度，能帮助你选择更合适的应对方式。轻度焦虑可以用深呼吸，重度焦虑可能需要更多支持。
        </p>
      </div>
    </div>
  );
}
