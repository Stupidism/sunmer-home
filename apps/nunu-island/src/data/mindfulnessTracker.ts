// 正念与运动记录数据

export type ActivityType = 'mindfulness' | 'exercise' | 'breathing';

export interface ActivityRecord {
  id: string;
  type: ActivityType;
  duration: number; // 分钟
  date: Date;
  note?: string;
}

export interface ActivityStats {
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  weeklyCount: number;
  monthlyCount: number;
}

// 预设时长选项
export const durationOptions = [3, 5, 10, 15, 20, 30];

// 活动类型配置
export const activityConfig = {
  mindfulness: {
    name: '正念冥想',
    icon: '🧘',
    color: 'from-emerald-400 to-teal-500',
    bgColor: 'bg-emerald-50',
    encouragements: [
      '你今天照顾了自己{duration}分钟',
      '每一次觉察，都是对自己的温柔',
      '正念不是达到某种状态，而是觉察当下',
      '你已经开始了，这很重要',
      '哪怕只有1分钟，也是正念',
    ],
  },
  exercise: {
    name: '产后运动',
    icon: '💪',
    color: 'from-blue-400 to-cyan-500',
    bgColor: 'bg-blue-50',
    encouragements: [
      '你的身体会感谢你的',
      '运动是对自己最好的投资',
      '每一次动起来，都是在爱自己',
      '你的身体很强大',
      '慢慢来，不着急',
    ],
  },
  breathing: {
    name: '呼吸练习',
    icon: '🫁',
    color: 'from-sky-400 to-blue-500',
    bgColor: 'bg-sky-50',
    encouragements: [
      '呼吸是你随时可用的工具',
      '几次深呼吸，世界就不一样了',
      '呼吸是身体和心灵的桥梁',
      '你随时都可以回到呼吸',
      '吸气...呼气...',
    ],
  },
};

// 获取随机鼓励语
export function getRandomEncouragement(type: ActivityType, duration: number): string {
  const encouragements = activityConfig[type].encouragements;
  const randomIndex = Math.floor(Math.random() * encouragements.length);
  return encouragements[randomIndex].replace('{duration}', duration.toString());
}

// 计算统计数据
export function calculateStats(records: ActivityRecord[]): ActivityStats {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const totalSessions = records.length;
  const totalMinutes = records.reduce((sum, r) => sum + r.duration, 0);
  
  // 计算连续天数
  const dates = [...new Set(records.map(r => 
    r.date.toDateString()
  ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = new Date().toDateString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
  
  // 计算当前连续
  if (dates.includes(today) || dates.includes(yesterday)) {
    currentStreak = 1;
    let checkDate = new Date(now);
    if (!dates.includes(today)) {
      checkDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    while (true) {
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      if (dates.includes(checkDate.toDateString())) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // 计算最长连续
  const sortedDates = dates.sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );
  
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  
  // 本周和本月
  const weeklyCount = records.filter(r => r.date >= weekAgo).length;
  const monthlyCount = records.filter(r => r.date >= monthAgo).length;
  
  return {
    totalSessions,
    totalMinutes,
    currentStreak,
    longestStreak,
    weeklyCount,
    monthlyCount,
  };
}

// 获取月份数据（用于日历）
export function getMonthData(year: number, month: number, records: ActivityRecord[]) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthData = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayRecords = records.filter(r => 
      r.date.toDateString() === date.toDateString()
    );
    
    monthData.push({
      day,
      date,
      hasActivity: dayRecords.length > 0,
      activities: dayRecords,
      mindfulness: dayRecords.filter(r => r.type === 'mindfulness').length,
      exercise: dayRecords.filter(r => r.type === 'exercise').length,
      breathing: dayRecords.filter(r => r.type === 'breathing').length,
    });
  }
  
  return monthData;
}
