import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Share2, Bookmark, Play, Pause, Volume2 } from 'lucide-react';
import type { Article } from '@/types';

interface ArticleDetailPageProps {
  article: Article;
  onBack: () => void;
}

export function ArticleDetailPage({ article, onBack }: ArticleDetailPageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 获取可朗读的文本内容（去除 Markdown 标记）
  const getReadableText = useCallback(() => {
    return article.content
      .filter(text => text.trim() && text !== '---')
      .map(text => {
        // 去除粗体标记
        let cleanText = text.replace(/\*\*(.+?)\*\*/g, '$1');
        // 去除列表符号
        cleanText = cleanText.replace(/^·\s*/, '');
        return cleanText;
      })
      .join('。');
  }, [article.content]);

  // 停止朗读
  const stopSpeaking = useCallback(() => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
    }
    setIsPlaying(false);
  }, []);

  // 开始朗读
  const startSpeaking = useCallback(() => {
    if (!window.speechSynthesis) {
      alert('您的浏览器不支持语音播放功能');
      return;
    }

    speechSynthesisRef.current = window.speechSynthesis;
    
    const text = getReadableText();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置中文语音
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9; // 稍微慢一点，更温暖
    utterance.pitch = 1.05; // 稍微高一点，更柔和
    
    // 尝试找到中文女声
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Female'))
      || voices.find(v => v.lang.includes('zh'))
      || voices[0];
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    speechSynthesisRef.current.speak(utterance);
    setIsPlaying(true);
  }, [getReadableText]);

  // 切换播放/暂停
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopSpeaking();
    } else {
      startSpeaking();
    }
  }, [isPlaying, startSpeaking, stopSpeaking]);

  // 组件卸载时停止朗读
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  // 渲染文章内容，支持 Markdown 格式
  const renderContent = (text: string) => {
    // 处理粗体 **text**
    let processed = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 如果文本为空，返回空段落
    if (!text.trim()) {
      return <div className="h-4" />;
    }
    
    // 处理列表项
    if (text.startsWith('· ')) {
      return (
        <li 
          className="ml-6 text-gray-700 leading-relaxed mb-2"
          dangerouslySetInnerHTML={{ __html: processed.replace('· ', '') }}
        />
      );
    }
    
    // 处理标题（以数字开头的行）
    if (/^\*\*\d+\./.test(text)) {
      return (
        <h3 
          className="text-lg font-bold text-gray-800 mt-8 mb-4"
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    }
    
    // 处理分隔线
    if (text === '---') {
      return <hr className="my-8 border-rose-100" />;
    }
    
    // 普通段落
    return (
      <p 
        className="text-gray-700 leading-relaxed mb-4"
        dangerouslySetInnerHTML={{ __html: processed }}
      />
    );
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
            <span className="text-sm font-medium text-gray-600">温暖文章</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors">
              <Bookmark className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-xl hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Cover Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden mb-8 shadow-soft-lg"
          >
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-64 sm:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <div className="flex gap-2 mb-3">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {article.title}
              </h1>
              {article.subtitle && (
                <p className="text-white/80 text-sm sm:text-base">{article.subtitle}</p>
              )}
            </div>

            {/* Play Button Overlay */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              onClick={togglePlay}
              className="absolute top-4 right-4 w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-rose-500" />
              ) : (
                <Play className="w-6 h-6 text-rose-500 ml-1" />
              )}
            </motion.button>
          </motion.div>

          {/* Audio Player Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <button
              onClick={togglePlay}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${
                isPlaying 
                  ? 'bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg' 
                  : 'bg-white shadow-soft text-gray-700 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isPlaying ? 'bg-white/20' : 'bg-rose-100'
                }`}>
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-rose-500" />
                  )}
                </div>
                <div className="text-left">
                  <p className={`font-medium ${isPlaying ? 'text-white' : 'text-gray-800'}`}>
                    {isPlaying ? '正在播放...' : '听文章'}
                  </p>
                  <p className={`text-sm ${isPlaying ? 'text-white/80' : 'text-gray-500'}`}>
                    {isPlaying ? '点击暂停朗读' : '点击播放温暖文章'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPlaying && (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="flex gap-1"
                  >
                    <span className="w-1 h-4 bg-white/60 rounded-full" />
                    <span className="w-1 h-6 bg-white/80 rounded-full" />
                    <span className="w-1 h-3 bg-white/60 rounded-full" />
                  </motion.div>
                )}
              </div>
            </button>
          </motion.div>

          {/* Article Body */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl shadow-soft p-6 sm:p-8"
          >
            <div className="prose prose-rose max-w-none">
              {article.content.map((paragraph, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                >
                  {renderContent(paragraph)}
                </motion.div>
              ))}
            </div>

            {/* Closing */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 pt-8 border-t border-rose-100"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-rose mb-4">
                  <Heart className="w-8 h-8 text-white animate-pulse-soft" />
                </div>
                <p className="text-gray-500 text-sm italic">
                  "你远比自己想象的，更加强大和美丽"
                </p>
              </div>
            </motion.div>
          </motion.article>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-8 flex gap-4"
          >
            <button
              onClick={onBack}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white shadow-soft text-gray-700 font-medium hover:shadow-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回文章列表</span>
            </button>
          </motion.div>

          {/* Footer Quote */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-8 text-center"
          >
            <p className="text-gray-400 text-sm">
              💕 愿这些文字，能温暖你内心的那个小孩
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
