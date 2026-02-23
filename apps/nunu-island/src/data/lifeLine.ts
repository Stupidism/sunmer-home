export interface LifeEvent {
  id: string;
  date: string; // YYYY-MM-DD 格式
  title: string;
  description: string;
  type: 'positive' | 'negative'; // positive = 线上方（被伤害），negative = 线下方（活下来了/爱过/努力过）
  images: string[]; // 图片URL数组
  createdAt: string;
}

export const LIFE_EVENTS_STORAGE_KEY = 'life-events';

// 获取保存的生命事件
export const getLifeEvents = (): LifeEvent[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LIFE_EVENTS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

// 保存生命事件
export const saveLifeEvents = (events: LifeEvent[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LIFE_EVENTS_STORAGE_KEY, JSON.stringify(events));
};

// 添加生命事件
export const addLifeEvent = (event: Omit<LifeEvent, 'id' | 'createdAt'>): LifeEvent => {
  const events = getLifeEvents();
  const newEvent: LifeEvent = {
    ...event,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  saveLifeEvents([...events, newEvent]);
  return newEvent;
};

// 更新生命事件
export const updateLifeEvent = (id: string, updates: Partial<LifeEvent>): LifeEvent | null => {
  const events = getLifeEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return null;
  
  const updatedEvent = { ...events[index], ...updates };
  events[index] = updatedEvent;
  saveLifeEvents(events);
  return updatedEvent;
};

// 删除生命事件
export const deleteLifeEvent = (id: string): boolean => {
  const events = getLifeEvents();
  const filtered = events.filter((e) => e.id !== id);
  if (filtered.length === events.length) return false;
  saveLifeEvents(filtered);
  return true;
};

// 按日期排序
export const sortEventsByDate = (events: LifeEvent[]): LifeEvent[] => {
  return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// 获取年份范围
export const getYearRange = (events: LifeEvent[]): { min: number; max: number } => {
  if (events.length === 0) {
    const currentYear = new Date().getFullYear();
    return { min: currentYear - 30, max: currentYear };
  }
  const years = events.map((e) => new Date(e.date).getFullYear());
  return { min: Math.min(...years), max: Math.max(...years) };
};

// 示例数据
export const sampleLifeEvents: LifeEvent[] = [
  {
    id: 'sample-1',
    date: '1995-03-15',
    title: '出生',
    description: '来到这个世界',
    type: 'negative',
    images: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    date: '2003-09-01',
    title: '奶奶拒绝',
    description: '被奶奶说"女孩子读书没用"',
    type: 'positive',
    images: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    date: '2010-06-15',
    title: '考上重点高中',
    description: '凭自己的努力考上市一中',
    type: 'negative',
    images: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    date: '2024-02-20',
    title: '今天我对宝宝笑了',
    description: '即使很累，还是对宝宝露出了笑容',
    type: 'negative',
    images: [],
    createdAt: new Date().toISOString(),
  },
];
