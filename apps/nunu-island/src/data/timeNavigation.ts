// 时间导航数据 - 按早晨/白天/晚上/随时组织

export interface TimeSlot {
  id: 'morning' | 'daytime' | 'evening' | 'anytime';
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  description: string;
  tools: string[];
}

export const timeSlots: TimeSlot[] = [
  {
    id: 'morning',
    icon: '🌅',
    title: '早晨',
    subtitle: '温暖开启新一天',
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    description: '用温暖和愿景开启今天',
    tools: ['warm-articles', 'vision-board', 'daily-intention'],
  },
  {
    id: 'daytime',
    icon: '☀️',
    title: '白天',
    subtitle: '巩固信念，预防焦虑',
    color: 'from-yellow-400 to-amber-500',
    bgColor: 'bg-yellow-50',
    description: '在忙碌中找回平静',
    tools: ['beliefs', 'quick-mindfulness', 'affirmations'],
  },
  {
    id: 'evening',
    icon: '🌙',
    title: '晚上',
    subtitle: '回顾一天，感恩收尾',
    color: 'from-indigo-400 to-purple-500',
    bgColor: 'bg-indigo-50',
    description: '温柔地结束这一天',
    tools: ['gratitude', 'love-ability', 'self-attribution'],
  },
  {
    id: 'anytime',
    icon: '🧘',
    title: '随时',
    subtitle: '正念与运动',
    color: 'from-emerald-400 to-teal-500',
    bgColor: 'bg-emerald-50',
    description: '任何时候都可以照顾自己',
    tools: ['mindfulness-timer', 'exercise', 'breathing'],
  },
];

// 每日温暖语录
export const dailyQuotes = [
  { text: '你不需要完美，你只需要真实。', author: '' },
  { text: '每一个被伤害的时刻，都对应着一个你活下来的时刻。', author: '' },
  { text: '你的需求和他人的需求同等重要。', author: '' },
  { text: '宝宝爱的是真实的你，不是完美的你。', author: '' },
  { text: '你可以慢慢来，不必立刻解决所有问题。', author: '' },
  { text: '你已经做得很好了。', author: '' },
  { text: '照顾好自己的情绪，不是自私，是必要。', author: '' },
  { text: '你的感受是真实的，值得被看见。', author: '' },
  { text: '今天，请对自己温柔一点。', author: '' },
  { text: '你值得被好好对待，尤其是被你自己。', author: '' },
];

// 愿景板数据
export interface VisionItem {
  id: string;
  type: 'image' | 'text';
  content: string;
  caption?: string;
}

export const defaultVisionBoard: VisionItem[] = [
  {
    id: '1',
    type: 'text',
    content: '我是足够好的妈妈',
    caption: '新信念 #1',
  },
  {
    id: '2',
    type: 'text',
    content: '我的需求和他人的需求同等重要',
    caption: '新信念 #2',
  },
  {
    id: '3',
    type: 'text',
    content: '我可以慢慢来',
    caption: '新信念 #3',
  },
  {
    id: '4',
    type: 'text',
    content: '每一个被伤害的时刻，都对应着一个我活下来的时刻',
    caption: '生命线',
  },
];

// 今日微目标默认列表
export interface DailyMicroGoal {
  id: string;
  text: string;
  completed: boolean;
  category: 'self-care' | 'baby' | 'mindfulness' | 'custom';
}

export const defaultMicroGoals: DailyMicroGoal[] = [
  { id: '1', text: '做一次腹式呼吸', completed: false, category: 'mindfulness' },
  { id: '2', text: '和宝宝单独待5分钟', completed: false, category: 'baby' },
  { id: '3', text: '对自己说一句温柔的话', completed: false, category: 'self-care' },
  { id: '4', text: '记录一个情绪', completed: false, category: 'mindfulness' },
];

// 获取今日随机语录
export function getDailyQuote(): typeof dailyQuotes[0] {
  const today = new Date();
  const index = today.getDate() % dailyQuotes.length;
  return dailyQuotes[index];
}
