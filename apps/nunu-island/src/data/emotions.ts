// 情绪词汇库 - 按类别索引

export interface EmotionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  emotions: {
    name: string;
    scenario: string;
  }[];
}

export interface EmotionIntensity {
  emotion: string;
  mild: string;
  moderate: string;
  severe: string;
  color: string;
}

export interface BodySensation {
  sensation: string;
  emotion: string;
}

// 情绪分类数据
export const emotionCategories: EmotionCategory[] = [
  {
    id: 'self-worth',
    name: '自我价值',
    icon: '💎',
    color: 'from-rose-400 to-pink-500',
    bgColor: 'bg-rose-50',
    emotions: [
      { name: '羞耻', scenario: '"我不够好""我是个坏妈妈"' },
      { name: '内疚', scenario: '"都是我的错""我本该做得更好"' },
      { name: '自卑', scenario: '"我不如别人""我什么都做不好"' },
      { name: '挫败', scenario: '"我怎么都做不到""又失败了"' },
      { name: '无力感', scenario: '"我改变不了什么""算了吧"' },
      { name: '自我怀疑', scenario: '"我真的对吗""我是不是想多了"' },
      { name: '被否定感', scenario: '"他们不认可我""我又被批评了"' },
    ],
  },
  {
    id: 'relationship',
    name: '关系',
    icon: '👥',
    color: 'from-blue-400 to-cyan-500',
    bgColor: 'bg-blue-50',
    emotions: [
      { name: '被忽视', scenario: '"没人注意到我""我的需求不重要"' },
      { name: '被排斥', scenario: '"他们才是一家人""我是外人"' },
      { name: '被利用', scenario: '"他只是在需要我的时候才找我"' },
      { name: '被背叛', scenario: '"我以为他站在我这边"' },
      { name: '委屈', scenario: '"我明明没做错什么""凭什么是我"' },
      { name: '心寒', scenario: '"一次次失望，不想再期待了"' },
      { name: '失望', scenario: '"我以为他会不同"' },
      { name: '嫉妒', scenario: '"为什么阿姨能做到，我不行"' },
      { name: '羡慕', scenario: '"真希望我也能那样轻松"' },
    ],
  },
  {
    id: 'motherhood',
    name: '宝宝相关',
    icon: '👶',
    color: 'from-emerald-400 to-teal-500',
    bgColor: 'bg-emerald-50',
    emotions: [
      { name: '焦虑', scenario: '"他是不是不舒服""我做得对吗"' },
      { name: '担忧', scenario: '"以后会不会和我亲"' },
      { name: '失落', scenario: '"他不要我抱"' },
      { name: '甜蜜', scenario: '他对我笑的时候' },
      { name: '柔软', scenario: '他睡着时看着他的小脸' },
      { name: '满足', scenario: '他在我怀里安静下来' },
      { name: '心疼', scenario: '他哭的时候' },
      { name: '困惑', scenario: '"他到底想要什么"' },
    ],
  },
  {
    id: 'body',
    name: '身体感觉',
    icon: '🫀',
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    emotions: [
      { name: '胸口闷', scenario: '委屈、悲伤、压抑' },
      { name: '肩膀紧', scenario: '压力大、承担责任' },
      { name: '心跳快', scenario: '焦虑、恐惧、紧张' },
      { name: '胃不舒服', scenario: '担心、害怕、厌恶' },
      { name: '喉咙堵', scenario: '想哭但不能哭' },
      { name: '手脚冰凉', scenario: '恐惧、惊吓' },
      { name: '全身无力', scenario: '疲惫、绝望、无力感' },
      { name: '牙关紧咬', scenario: '愤怒、隐忍' },
    ],
  },
];

// 情绪强度数据
export const emotionIntensities: EmotionIntensity[] = [
  {
    emotion: '愤怒',
    mild: '不悦、烦躁',
    moderate: '生气、恼火',
    severe: '暴怒、憎恨',
    color: 'from-red-400 to-rose-500',
  },
  {
    emotion: '悲伤',
    mild: '低落、伤感',
    moderate: '难过、哀愁',
    severe: '绝望、悲痛',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    emotion: '焦虑',
    mild: '不安、担心',
    moderate: '焦虑、恐慌',
    severe: '惊恐、崩溃',
    color: 'from-amber-400 to-orange-500',
  },
  {
    emotion: '喜悦',
    mild: '愉悦、舒心',
    moderate: '高兴、欣喜',
    severe: '狂喜、心花怒放',
    color: 'from-yellow-400 to-amber-500',
  },
];

// 按字母排序的情绪词汇索引
export const emotionIndex = emotionCategories.flatMap((cat) =>
  cat.emotions.map((e) => ({
    name: e.name,
    category: cat.name,
    scenario: e.scenario,
    color: cat.color,
  }))
).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
