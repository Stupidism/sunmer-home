// 身体感受入口的情绪数据
// 从身体感受映射到情绪

export interface BodySensation {
  id: string;
  name: string;
  icon: string;
  location: string;
  description: string;
  relatedEmotions: {
    name: string;
    icon: string;
    intensity: number; // 1-10
  }[];
  recommendedTools: string[];
}

export const bodySensations: BodySensation[] = [
  {
    id: 'chest-tight',
    name: '胸口闷',
    icon: '💔',
    location: '胸口',
    description: '像有东西压着，呼吸不畅',
    relatedEmotions: [
      { name: '委屈', icon: '💧', intensity: 7 },
      { name: '悲伤', icon: '😢', intensity: 6 },
      { name: '压抑', icon: '😔', intensity: 8 },
      { name: '心酸', icon: '💔', intensity: 6 },
      { name: '失望', icon: '😞', intensity: 5 },
    ],
    recommendedTools: ['rain', 'inner-child', 'body-scan'],
  },
  {
    id: 'shoulders-tight',
    name: '肩膀紧',
    icon: '🏋️',
    location: '肩膀',
    description: '僵硬、酸痛，像扛着什么',
    relatedEmotions: [
      { name: '压力', icon: '😰', intensity: 8 },
      { name: '责任', icon: '📋', intensity: 6 },
      { name: '疲惫', icon: '😩', intensity: 7 },
      { name: '紧张', icon: '😬', intensity: 6 },
    ],
    recommendedTools: ['body-scan', 'mindfulness', 'gratitude'],
  },
  {
    id: 'throat-blocked',
    name: '喉咙堵',
    icon: '🤐',
    location: '喉咙',
    description: '想说什么但说不出口',
    relatedEmotions: [
      { name: '委屈', icon: '💧', intensity: 8 },
      { name: '想哭', icon: '😭', intensity: 7 },
      { name: '压抑', icon: '😔', intensity: 9 },
      { name: '无助', icon: '😶', intensity: 6 },
    ],
    recommendedTools: ['inner-child', 'ifs', 'journaling'],
  },
  {
    id: 'stomach-uneasy',
    name: '胃不舒服',
    icon: '🤢',
    location: '胃部',
    description: '揪着、翻腾、没胃口',
    relatedEmotions: [
      { name: '担心', icon: '😟', intensity: 7 },
      { name: '害怕', icon: '😨', intensity: 6 },
      { name: '焦虑', icon: '😰', intensity: 8 },
      { name: '厌恶', icon: '🤮', intensity: 5 },
    ],
    recommendedTools: ['rain', 'breathing', 'mindfulness'],
  },
  {
    id: 'heart-racing',
    name: '心跳快',
    icon: '💓',
    location: '心脏',
    description: '砰砰跳，静不下来',
    relatedEmotions: [
      { name: '焦虑', icon: '😰', intensity: 9 },
      { name: '恐惧', icon: '😱', intensity: 8 },
      { name: '紧张', icon: '😬', intensity: 7 },
      { name: '惊慌', icon: '😵', intensity: 8 },
    ],
    recommendedTools: ['breathing', 'body-scan', 'grounding'],
  },
  {
    id: 'cold-hands',
    name: '手脚冰凉',
    icon: '🧊',
    location: '四肢',
    description: '血液循环不好，发冷',
    relatedEmotions: [
      { name: '恐惧', icon: '😱', intensity: 7 },
      { name: '惊吓', icon: '😰', intensity: 6 },
      { name: '不安', icon: '😟', intensity: 5 },
    ],
    recommendedTools: ['breathing', 'body-scan', 'warmth'],
  },
  {
    id: 'whole-weak',
    name: '全身无力',
    icon: '😮‍💨',
    location: '全身',
    description: '像被抽空了，动不了',
    relatedEmotions: [
      { name: '绝望', icon: '😵', intensity: 9 },
      { name: '无力', icon: '😔', intensity: 8 },
      { name: '疲惫', icon: '😩', intensity: 9 },
      { name: '空虚', icon: '🕳️', intensity: 7 },
    ],
    recommendedTools: ['self-compassion', 'gratitude', 'rest'],
  },
  {
    id: 'jaw-clenched',
    name: '牙关紧咬',
    icon: '😤',
    location: '下巴',
    description: '不自觉咬紧，腮帮酸',
    relatedEmotions: [
      { name: '愤怒', icon: '😠', intensity: 8 },
      { name: '隐忍', icon: '🤐', intensity: 7 },
      { name: '不满', icon: '😒', intensity: 6 },
    ],
    recommendedTools: ['anger-release', 'ifs', 'journaling'],
  },
];

// 工具数据
export interface Tool {
  id: string;
  name: string;
  duration: string;
  description: string;
  forEmotions: string[];
  icon: string;
  color: string;
}

export const tools: Tool[] = [
  {
    id: 'rain',
    name: 'RAIN四步法',
    duration: '8分钟',
    description: '识别、允许、探究、滋养——处理强烈情绪的经典方法',
    forEmotions: ['委屈', '愤怒', '焦虑', '悲伤'],
    icon: '🌧️',
    color: 'from-blue-400 to-cyan-500',
  },
  {
    id: 'inner-child',
    name: '与内在小孩对话',
    duration: '5分钟',
    description: '那个受伤的小孩需要被听见',
    forEmotions: ['委屈', '悲伤', '无助', '想哭'],
    icon: '👶',
    color: 'from-rose-400 to-pink-500',
  },
  {
    id: 'body-scan',
    name: '身体扫描',
    duration: '3分钟',
    description: '让身体先放松下来',
    forEmotions: ['紧张', '焦虑', '疲惫', '压力'],
    icon: '🧘',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'breathing',
    name: '深呼吸练习',
    duration: '2分钟',
    description: '简单的呼吸，大大的平静',
    forEmotions: ['焦虑', '恐惧', '惊慌', '紧张'],
    icon: '🫁',
    color: 'from-sky-400 to-blue-500',
  },
  {
    id: 'ifs',
    name: '内在家庭系统',
    duration: '10分钟',
    description: '与内心的不同部分对话',
    forEmotions: ['压抑', '愤怒', '不满', '隐忍'],
    icon: '🎭',
    color: 'from-violet-400 to-purple-500',
  },
  {
    id: 'journaling',
    name: '情绪日记',
    duration: '5分钟',
    description: '写下来，让情绪有出口',
    forEmotions: ['委屈', '悲伤', '愤怒', '失望'],
    icon: '📝',
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: 'gratitude',
    name: '感恩时刻',
    duration: '3分钟',
    description: '找到生活中的一点点甜',
    forEmotions: ['疲惫', '空虚', '无力', '绝望'],
    icon: '✨',
    color: 'from-yellow-400 to-amber-500',
  },
  {
    id: 'self-compassion',
    name: '自我关怀',
    duration: '4分钟',
    description: '对自己说温柔的话',
    forEmotions: ['绝望', '无力', '羞耻', '内疚'],
    icon: '💝',
    color: 'from-rose-400 to-pink-500',
  },
];

// 今日微目标
export interface DailyGoal {
  id: string;
  text: string;
  completed: boolean;
}

export const defaultDailyGoals: DailyGoal[] = [
  { id: '1', text: '做一次腹式呼吸', completed: false },
  { id: '2', text: '和宝宝单独相处5分钟', completed: false },
  { id: '3', text: '记录一个情绪', completed: false },
  { id: '4', text: '对自己说一句温柔的话', completed: false },
];
