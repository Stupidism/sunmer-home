import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Lightbulb, Wand2, CheckCircle, Plus, Image, Video, Music, X } from 'lucide-react';
import type { Belief } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface BeliefDetailPageProps {
  belief: Belief;
  onBack: () => void;
}

// 本地存储方法媒体内容
const getMethodMedia = (methodId: string): { type: 'image' | 'video' | 'audio'; url: string; caption?: string }[] => {
  const stored = localStorage.getItem(`belief-method-media-${methodId}`);
  return stored ? JSON.parse(stored) : [];
};

const saveMethodMedia = (methodId: string, media: { type: 'image' | 'video' | 'audio'; url: string; caption?: string }[]) => {
  localStorage.setItem(`belief-method-media-${methodId}`, JSON.stringify(media));
};

export function BeliefDetailPage({ belief, onBack }: BeliefDetailPageProps) {
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const [isAddMediaDialogOpen, setIsAddMediaDialogOpen] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [methodMedias, setMethodMedias] = useState<Record<string, { type: 'image' | 'video' | 'audio'; url: string; caption?: string }[]>>({});

  // 加载媒体内容
  const loadMethodMedia = (methodId: string) => {
    if (!methodMedias[methodId]) {
      const media = getMethodMedia(methodId);
      setMethodMedias((prev) => ({ ...prev, [methodId]: media }));
    }
  };

  const handleAddMedia = () => {
    if (!selectedMethodId || !mediaUrl) return;

    const newMedia = {
      type: mediaType,
      url: mediaUrl,
      caption: mediaCaption || undefined,
    };

    const currentMedia = getMethodMedia(selectedMethodId);
    const updatedMedia = [...currentMedia, newMedia];
    saveMethodMedia(selectedMethodId, updatedMedia);

    setMethodMedias((prev) => ({ ...prev, [selectedMethodId]: updatedMedia }));
    setIsAddMediaDialogOpen(false);
    setMediaUrl('');
    setMediaCaption('');
  };

  const handleDeleteMedia = (methodId: string, index: number) => {
    const currentMedia = getMethodMedia(methodId);
    const updatedMedia = currentMedia.filter((_, i) => i !== index);
    saveMethodMedia(methodId, updatedMedia);
    setMethodMedias((prev) => ({ ...prev, [methodId]: updatedMedia }));
  };

  const openAddMediaDialog = (methodId: string) => {
    setSelectedMethodId(methodId);
    setIsAddMediaDialogOpen(true);
  };

  return (
    <div className="min-h-screen gradient-warm">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-rose-100/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${belief.color} flex items-center justify-center text-white text-sm font-bold`}>
              {belief.order}
            </span>
            <span className="text-lg font-semibold text-gray-800">新信念</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Belief Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl bg-gradient-to-r ${belief.color} text-white`}
          >
            <p className="text-white/70 text-sm mb-2">新信念</p>
            <p className="text-xl font-bold leading-relaxed">{belief.newBelief}</p>
          </motion.div>

          {/* Old Belief */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gray-100"
          >
            <p className="text-gray-400 text-sm mb-1">旧信念</p>
            <p className="text-gray-500 line-through">{belief.oldBelief}</p>
          </motion.div>

          {/* Theory Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-soft p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-rose-500" />
              <h3 className="font-semibold text-gray-800">理论依据</h3>
            </div>
            <ul className="space-y-3">
              {belief.theory.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-gray-600 text-sm leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Methods Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-gray-800">NLP 重塑技术</h3>
            </div>

            {belief.methods.map((method, index) => (
              <motion.div
                key={method.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-white rounded-2xl shadow-soft overflow-hidden"
              >
                <button
                  onClick={() => {
                    loadMethodMedia(method.id);
                    setExpandedMethod(expandedMethod === method.id ? null : method.id);
                  }}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 text-sm font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{method.title}</p>
                      <p className="text-sm text-gray-400">{method.description}</p>
                    </div>
                  </div>
                  <span className={`text-gray-400 transition-transform ${expandedMethod === method.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                <AnimatePresence>
                  {expandedMethod === method.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100"
                    >
                      <div className="p-4 space-y-4">
                        {/* Steps */}
                        <div className="space-y-2">
                          {method.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex items-start gap-3">
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <p className="text-gray-600 text-sm leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>

                        {/* Media Section */}
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700">相关资料</p>
                            <button
                              onClick={() => openAddMediaDialog(method.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-sm hover:bg-rose-100 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              添加
                            </button>
                          </div>

                          {/* Media List */}
                          <div className="space-y-2">
                            {(methodMedias[method.id] || []).map((media, mediaIndex) => (
                              <div key={mediaIndex} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                {media.type === 'image' && <Image className="w-5 h-5 text-blue-500" />}
                                {media.type === 'video' && <Video className="w-5 h-5 text-red-500" />}
                                {media.type === 'audio' && <Music className="w-5 h-5 text-green-500" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 truncate">{media.caption || media.url}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteMedia(method.id, mediaIndex)}
                                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {(methodMedias[method.id] || []).length === 0 && (
                              <p className="text-sm text-gray-400 text-center py-4">
                                点击"添加"按钮添加图片、视频或音频
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>

          {/* Daily Application */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-soft p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-gray-800">日常应用</h3>
            </div>
            <ul className="space-y-3">
              {belief.dailyApplication.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-gray-600 text-sm leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </main>

      {/* Add Media Dialog */}
      <Dialog open={isAddMediaDialogOpen} onOpenChange={setIsAddMediaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加资料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMediaType('image')}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  mediaType === 'image' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Image className="w-4 h-4" />
                图片
              </button>
              <button
                onClick={() => setMediaType('video')}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  mediaType === 'video' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Video className="w-4 h-4" />
                视频
              </button>
              <button
                onClick={() => setMediaType('audio')}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  mediaType === 'audio' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Music className="w-4 h-4" />
                音频
              </button>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">链接地址</label>
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="输入图片/视频/音频链接"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">描述（可选）</label>
              <Textarea
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="添加描述文字"
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsAddMediaDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1 gradient-rose text-white"
                onClick={handleAddMedia}
                disabled={!mediaUrl}
              >
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
