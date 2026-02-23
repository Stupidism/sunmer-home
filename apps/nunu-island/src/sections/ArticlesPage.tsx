import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Heart, Sparkles } from 'lucide-react';
import type { Article } from '@/types';

interface ArticlesPageProps {
  articles: Article[];
  onBack: () => void;
  onSelectArticle: (articleId: string) => void;
}

export function ArticlesPage({ articles, onBack, onSelectArticle }: ArticlesPageProps) {
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
            <BookOpen className="w-5 h-5 text-rose-400" />
            <span className="text-lg font-semibold text-gray-800">温暖文章</span>
          </div>
          <div className="w-16" />
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/60 text-amber-600 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>给你力量，陪你成长</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 leading-tight">
              温暖<span className="text-gradient">文章</span>
            </h1>
            <p className="text-gray-600 text-lg leading-relaxed max-w-xl mx-auto">
              在这里，你会发现关于自我成长、情感疗愈、亲子关系的温暖文字。每一篇都是为你而写。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 gap-6">
            {articles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
              >
                <button
                  onClick={() => onSelectArticle(article.id)}
                  className="w-full text-left group"
                >
                  <div className="relative bg-white rounded-3xl shadow-soft hover-lift overflow-hidden">
                    {/* Cover Image */}
                    <div className="relative h-48 sm:h-64 overflow-hidden">
                      <img
                        src={article.coverImage}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      
                      {/* Tags */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {article.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-xs font-medium text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 group-hover:text-rose-600 transition-colors">
                        {article.title}
                      </h3>
                      {article.subtitle && (
                        <p className="text-gray-500 mb-4">{article.subtitle}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Heart className="w-4 h-4" />
                          <span>给你温暖与力量</span>
                        </div>
                        <span className="text-rose-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          阅读全文 →
                        </span>
                      </div>
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
          每一篇文章，都是送给你的礼物 💕
        </p>
      </footer>
    </div>
  );
}
