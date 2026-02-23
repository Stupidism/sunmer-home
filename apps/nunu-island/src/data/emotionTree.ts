// 情绪树数据 - 按情绪分类组织

export interface EmotionLeaf {
  id: string;
  name: string;
  icon: string;
  color: string;
  intensity: number; // 1-10
  description: string;
}

export interface EmotionBranch {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  leaves: EmotionLeaf[];
  recommendedTools: string[];
}

export const emotionBranches: EmotionBranch[] = [
  {
    id: 'anxiety',
    name: '焦虑',
    icon: '😰',
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    description: '心里不安，静不下来',
    leaves: [
      { id: 'worry', name: '担心', icon: '😟', color: 'text-amber-500', intensity: 5, description: '心里悬着，放不下' },
      { id: 'panic', name: '恐慌', icon: '😱', color: 'text-orange-500', intensity: 8, description: '心跳加速，害怕发生' },
      { id: 'nervous', name: '紧张', icon: '😬', color: 'text-amber-600', intensity: 6, description: '身体紧绷，无法放松' },
      { id: 'uneasy', name: '不安', icon: '😰', color: 'text-amber-400', intensity: 4, description: '隐隐的不舒服' },
    ],
    recommendedTools: ['breathing-478', 'body-scan', 'rain', 'grounding'],
  },
  {
    id: 'sadness',
    name: '委屈/悲伤',
    icon: '😢',
    color: 'from-blue-400 to-indigo-500',
    bgColor: 'bg-blue-50',
    description: '心里酸酸的，想哭',
    leaves: [
      { id: 'wronged', name: '委屈', icon: '💧', color: 'text-blue-500', intensity: 6, description: '明明不是我的错' },
      { id: 'sad', name: '悲伤', icon: '😭', color: 'text-indigo-500', intensity: 7, description: '心里空空的，难过' },
      { id: 'ignored', name: '被忽视', icon: '👤', color: 'text-blue-400', intensity: 5, description: '没人看见我' },
      { id: 'disappointed', name: '失望', icon: '😞', color: 'text-blue-600', intensity: 5, description: '期待落空了' },
    ],
    recommendedTools: ['inner-child', 'self-compassion', 'ifs', 'journaling'],
  },
  {
    id: 'anger',
    name: '愤怒',
    icon: '😠',
    color: 'from-red-400 to-rose-500',
    bgColor: 'bg-red-50',
    description: '心里有火，想爆发',
    leaves: [
      { id: 'irritated', name: '烦躁', icon: '😤', color: 'text-red-400', intensity: 4, description: '小事也能惹毛我' },
      { id: 'angry', name: '生气', icon: '😠', color: 'text-red-500', intensity: 6, description: '被冒犯了，很不爽' },
      { id: 'furious', name: '暴怒', icon: '🤬', color: 'text-rose-600', intensity: 9, description: '控制不住，想砸东西' },
      { id: 'resentful', name: '怨恨', icon: '😒', color: 'text-red-600', intensity: 7, description: '一直记着，放不下' },
    ],
    recommendedTools: ['anger-release', 'breathing', 'rain', 'ifs'],
  },
  {
    id: 'self-blame',
    name: '自责',
    icon: '💔',
    color: 'from-violet-400 to-purple-500',
    bgColor: 'bg-violet-50',
    description: '怪自己，觉得自己不好',
    leaves: [
      { id: 'guilty', name: '内疚', icon: '😔', color: 'text-violet-500', intensity: 6, description: '都是我的错' },
      { id: 'ashamed', name: '羞耻', icon: '🫣', color: 'text-purple-600', intensity: 8, description: '我不够好' },
      { id: 'self-doubt', name: '自我怀疑', icon: '❓', color: 'text-violet-400', intensity: 5, description: '我做对了吗' },
      { id: 'inadequate', name: '无力感', icon: '😮‍💨', color: 'text-purple-500', intensity: 7, description: '我做不到' },
    ],
    recommendedTools: ['self-attribution', 'self-compassion', 'beliefs', 'ifs'],
  },
  {
    id: 'fear',
    name: '恐惧',
    icon: '😨',
    color: 'from-slate-400 to-gray-500',
    bgColor: 'bg-slate-50',
    description: '害怕，想逃跑',
    leaves: [
      { id: 'scared', name: '害怕', icon: '😨', color: 'text-slate-500', intensity: 6, description: '有危险的感觉' },
      { id: 'terrified', name: '惊恐', icon: '😱', color: 'text-gray-600', intensity: 9, description: '全身发抖，无法思考' },
      { id: 'insecure', name: '不安全感', icon: '🛡️', color: 'text-slate-400', intensity: 5, description: '觉得不安全' },
    ],
    recommendedTools: ['grounding', 'breathing', 'safety-anchor', 'body-scan'],
  },
  {
    id: 'positive',
    name: '平静/喜悦',
    icon: '✨',
    color: 'from-emerald-400 to-teal-500',
    bgColor: 'bg-emerald-50',
    description: '感觉还不错',
    leaves: [
      { id: 'calm', name: '平静', icon: '😌', color: 'text-emerald-500', intensity: 4, description: '心里安静' },
      { id: 'content', name: '满足', icon: '😊', color: 'text-teal-500', intensity: 5, description: '这样就好' },
      { id: 'grateful', name: '感恩', icon: '🙏', color: 'text-emerald-600', intensity: 6, description: '感谢拥有的' },
      { id: 'joyful', name: '喜悦', icon: '😄', color: 'text-teal-600', intensity: 7, description: '心里暖暖的' },
    ],
    recommendedTools: ['gratitude', 'love-ability', 'savoring', 'vision-board'],
  },
];

// 工具库
export interface Tool {
  id: string;
  name: string;
  icon: string;
  duration: string;
  description: string;
  forEmotions: string[];
  color: string;
  type: 'breathing' | 'meditation' | 'worksheet' | 'dialogue' | 'exercise';
  steps?: string[];
}

export const tools: Tool[] = [
  {
    id: 'breathing-478',
    name: '4-7-8呼吸法',
    icon: '🫁',
    duration: '3分钟',
    description: '快速平复身体焦虑',
    forEmotions: ['焦虑', '恐慌', '紧张', '愤怒'],
    color: 'from-sky-400 to-blue-500',
    type: 'breathing',
    steps: [
      '吸气4秒...',
      '屏住7秒...',
      '呼气8秒...',
      '重复3-5次',
    ],
  },
  {
    id: 'body-scan',
    name: '身体扫描',
    icon: '🧘',
    duration: '5分钟',
    description: '让身体先放松下来',
    forEmotions: ['焦虑', '紧张', '疲惫', '恐惧'],
    color: 'from-emerald-400 to-teal-500',
    type: 'meditation',
    steps: [
      '从头顶开始，感受每一部位',
      '不评判，只是觉察',
      '如果有紧绷，允许它存在',
      '慢慢向下，直到脚趾',
    ],
  },
  {
    id: 'rain',
    name: 'RAIN四步法',
    icon: '🌧️',
    duration: '8分钟',
    description: '识别、允许、探究、滋养',
    forEmotions: ['愤怒', '委屈', '焦虑', '悲伤'],
    color: 'from-blue-400 to-cyan-500',
    type: 'meditation',
    steps: [
      'R - 识别：知道这是什么情绪',
      'A - 允许：让它在这里',
      'I - 探究：它在身体的哪里？',
      'N - 滋养：温柔地对待自己',
    ],
  },
  {
    id: 'inner-child',
    name: '与内在小孩对话',
    icon: '👶',
    duration: '10分钟',
    description: '那个受伤的小孩需要被听见',
    forEmotions: ['委屈', '悲伤', '羞耻', '恐惧'],
    color: 'from-rose-400 to-pink-500',
    type: 'dialogue',
    steps: [
      '想象那个受伤的小孩',
      '问TA：你怎么了？',
      '听TA说，不评判',
      '告诉TA：我在这里陪着你',
    ],
  },
  {
    id: 'ifs',
    name: '内在家庭系统',
    icon: '🎭',
    duration: '15分钟',
    description: '与内心的不同部分对话',
    forEmotions: ['愤怒', '自责', '冲突', '混乱'],
    color: 'from-violet-400 to-purple-500',
    type: 'dialogue',
    steps: [
      '识别是哪个部分在说话',
      '问它：你想保护我什么？',
      '感谢它的保护',
      '邀请它放松一点',
    ],
  },
  {
    id: 'self-compassion',
    name: '自我关怀',
    icon: '💝',
    duration: '5分钟',
    description: '对自己说温柔的话',
    forEmotions: ['自责', '羞耻', '内疚', '无力'],
    color: 'from-rose-300 to-pink-400',
    type: 'meditation',
    steps: [
      '把手放在心口',
      '对自己说：这真的很难',
      '对自己说：你不是一个人',
      '对自己说：愿我对自己温柔',
    ],
  },
  {
    id: 'anger-release',
    name: '愤怒释放',
    icon: '🔥',
    duration: '5分钟',
    description: '安全地表达愤怒',
    forEmotions: ['愤怒', '怨恨', '烦躁'],
    color: 'from-red-400 to-orange-500',
    type: 'exercise',
    steps: [
      '找一个安全的地方',
      '用力握拳，然后放松',
      '深呼吸，想象怒火随呼气排出',
      '对自己说：我有权利生气',
    ],
  },
  {
    id: 'grounding',
    name: ' grounding 着陆',
    icon: '🌳',
    duration: '2分钟',
    description: '回到当下，回到身体',
    forEmotions: ['恐慌', '惊恐', '解离', '恐惧'],
    color: 'from-emerald-500 to-green-600',
    type: 'exercise',
    steps: [
      '5-4-3-2-1：说出你看到的5样东西',
      '说出你听到的4种声音',
      '说出你能触摸的3样东西',
      '说出你闻到的2种气味',
      '说出你尝到的1种味道',
    ],
  },
  {
    id: 'journaling',
    name: '情绪日记',
    icon: '📝',
    duration: '10分钟',
    description: '写下来，让情绪有出口',
    forEmotions: ['委屈', '悲伤', '愤怒', '混乱'],
    color: 'from-amber-400 to-orange-500',
    type: 'worksheet',
    steps: [
      '我现在感觉...',
      '这是因为...',
      '我需要的是...',
      '我可以做的是...',
    ],
  },
  {
    id: 'gratitude',
    name: '感恩时刻',
    icon: '✨',
    duration: '3分钟',
    description: '找到生活中的一点点甜',
    forEmotions: ['疲惫', '空虚', '平静', '喜悦'],
    color: 'from-yellow-400 to-amber-500',
    type: 'meditation',
    steps: [
      '想一件今天让你感恩的小事',
      '感受那份感恩在身体哪里',
      '让那份温暖停留一会儿',
    ],
  },
  {
    id: 'safety-anchor',
    name: '安全锚',
    icon: '⚓',
    duration: '3分钟',
    description: '找到一个让你感到安全的东西或画面',
    forEmotions: ['恐惧', '不安全感', '惊恐'],
    color: 'from-blue-500 to-indigo-600',
    type: 'meditation',
    steps: [
      '想一个让你感到安全的地方/人/物',
      '想象你在那里',
      '感受那种安全感',
      '知道你可以随时回到这里',
    ],
  },
  {
    id: 'savoring',
    name: '品味美好',
    icon: '🌸',
    duration: '2分钟',
    description: '延长美好的感觉',
    forEmotions: ['喜悦', '感恩', '平静', '满足'],
    color: 'from-pink-400 to-rose-500',
    type: 'meditation',
    steps: [
      '想一个今天的美好瞬间',
      '像品酒一样品味它',
      '让那份美好多停留20秒',
    ],
  },
];

// 根据情绪获取推荐工具
export function getRecommendedTools(emotionName: string): Tool[] {
  const emotion = emotionBranches
    .flatMap(b => b.leaves)
    .find(l => l.name === emotionName);
  
  if (!emotion) return tools.slice(0, 3);
  
  const branch = emotionBranches.find(b => 
    b.leaves.some(l => l.name === emotionName)
  );
  
  if (!branch) return tools.slice(0, 3);
  
  return tools.filter(t => 
    branch.recommendedTools.includes(t.id)
  ).slice(0, 3);
}
