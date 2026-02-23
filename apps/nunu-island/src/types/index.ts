// 问题类型
export interface Question {
  id: string;
  text: string;
  subtitle?: string;
  type: 'single' | 'multiple' | 'text' | 'textarea' | 'slider';
  options?: Option[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  labels?: string[];
}

// 选项类型
export interface Option {
  id: string;
  text: string;
  emoji?: string;
  description?: string;
}

// 层次类型
export interface Layer {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  questions: Question[];
}

// 情绪记录模板类型
export interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  layers?: Layer[];
  questions?: Question[];
  questionCount: number;
}

// 答案类型
export interface Answer {
  questionId: string;
  value: string | string[] | number;
}

// 记录类型
export interface Record {
  id: string;
  templateId: string;
  templateTitle: string;
  answers: Answer[];
  createdAt: Date;
  mood?: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  coverImage: string;
  content: string[];
  tags: string[];
  createdAt: string;
}

export interface BeliefMethodMedia {
  type: 'image' | 'video' | 'audio';
  url: string;
  caption?: string;
}

export interface BeliefMethod {
  id: string;
  title: string;
  description: string;
  steps: string[];
  media?: BeliefMethodMedia[];
}

export interface Belief {
  id: string;
  order: number;
  oldBelief: string;
  newBelief: string;
  color: string;
  bgColor: string;
  theory: string[];
  methods: BeliefMethod[];
  dailyApplication: string[];
}

// 导航状态
