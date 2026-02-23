import type { Template } from '@/types';

export const gratitudeTemplate: Template = {
  id: 'gratitude-journal',
  title: '深度感恩日记',
  description: '通过四层深度书写，捕捉生活中的美好瞬间，让感恩成为滋养自己的力量',
  icon: '🙏',
  color: 'from-emerald-300 to-teal-400',
  bgColor: 'bg-emerald-50',
  layers: [
    {
      id: 'part1',
      title: '第一部分：今日之光',
      subtitle: '记录一个具体的美好瞬间，不要泛泛而谈，捕捉有画面的时刻',
      color: 'from-amber-300 to-orange-400',
      questions: [
        {
          id: 'time',
          text: '这个瞬间发生在什么时间？',
          type: 'text',
          placeholder: '例如：下午3点20分',
        },
        {
          id: 'scene',
          text: '当时是什么场景？',
          subtitle: '选择或描述当时的场景',
          type: 'single',
          options: [
            { id: 'wake-up', text: '宝宝刚睡醒时', emoji: '😴' },
            { id: 'feeding', text: '喂奶时', emoji: '🍼' },
            { id: 'holding', text: '抱着他走动时', emoji: '🤱' },
            { id: 'family', text: '和家人相处时', emoji: '👨‍👩‍👧' },
            { id: 'alone', text: '自己独处时', emoji: '🧘' },
            { id: 'other', text: '其他场景', emoji: '✨' },
          ],
        },
        {
          id: 'what-happened',
          text: '发生了什么？',
          subtitle: '用你的眼睛拍下一张照片，描述具体画面',
          type: 'textarea',
          placeholder: '例如：他睁开眼睛，看到我，没有哭，盯着我看了一会儿，然后嘴角慢慢弯起来，给了我一个睡醒后的第一个笑。那个笑很慢，像是认出了我。',
        },
        {
          id: 'sensory-experience',
          text: '这个瞬间里，我看到了/听到了/感受到了什么？',
          subtitle: '调动你的感官，描述细节',
          type: 'textarea',
          placeholder: '例如：阳光从窗户照进来，他的小脸亮亮的，我的心突然就软了。',
        },
      ],
    },
    {
      id: 'part2',
      title: '第二部分：为什么它值得感恩？',
      subtitle: '挖掘背后的意义，不是停留在"这件事很好"',
      color: 'from-rose-300 to-pink-400',
      questions: [
        {
          id: 'need-met',
          text: '这个瞬间满足了我什么需要？',
          subtitle: '可以选择多个',
          type: 'multiple',
          options: [
            { id: 'seen', text: '被看见', emoji: '👁️' },
            { id: 'needed', text: '被需要', emoji: '🤗' },
            { id: 'loved', text: '被爱', emoji: '❤️' },
            { id: 'peace', text: '平静', emoji: '😌' },
            { id: 'connection', text: '联结', emoji: '🔗' },
            { id: 'order', text: '秩序感', emoji: '📋' },
            { id: 'safe', text: '安全感', emoji: '🛡️' },
            { id: 'valued', text: '被重视', emoji: '💎' },
          ],
        },
        {
          id: 'without-it',
          text: '如果没有这个瞬间，我今天会有什么不同？',
          type: 'textarea',
          placeholder: '例如：如果没有这个笑，我今天可能会一直陷在"他为什么不吃我的奶"的焦虑里。',
        },
        {
          id: 'memory-trigger',
          text: '这个瞬间让我想起了什么？',
          subtitle: '可以是一个人的好、一个美好的回忆、或者一个本以为自己失去了的感觉',
          type: 'textarea',
          placeholder: '例如：它让我想起小时候，虽然很少被看见，但偶尔也有这样的瞬间——被某个温暖的光照亮。现在，我是那个可以给别人光的人。',
        },
        {
          id: 'life-support',
          text: '这个瞬间告诉我，生活中还有什么在默默支撑着我？',
          type: 'textarea',
          placeholder: '例如：阳光、宝宝的成长、丈夫的关心、这个家...',
        },
      ],
    },
    {
      id: 'part3',
      title: '第三部分：我的回应',
      subtitle: '感恩不是终点，是起点。让这份温暖延续',
      color: 'from-violet-300 to-purple-400',
      questions: [
        {
          id: 'express-gratitude',
          text: '我可以对谁表达感谢？',
          subtitle: '具体想说什么',
          type: 'textarea',
          placeholder: '例如：对宝宝说"谢谢你今天对妈妈笑"；对丈夫说"今天你过来亲我们的时候，我很温暖"',
        },
        {
          id: 'remember-feeling',
          text: '我可以为自己做一件什么事，来记住这种感觉？',
          type: 'textarea',
          placeholder: '例如：把这一刻写下来、拍一张照片、给自己泡一杯茶慢慢回味',
        },
        {
          id: 'hard-day-reminder',
          text: '如果明天很难，我可以怎么用今天这个瞬间来提醒自己？',
          type: 'textarea',
          placeholder: '例如：以后他再拒奶的时候，翻出来看看——他笑过，他认得我。',
        },
      ],
    },
    {
      id: 'part4',
      title: '第四部分：暗中之光',
      subtitle: '在困难中找到可感恩的线索。即使今天很难，也可以找到一丝值得感恩的东西',
      color: 'from-blue-300 to-cyan-400',
      questions: [
        {
          id: 'difficulty-today',
          text: '今天有什么不容易的事？',
          subtitle: '如果有的话，简单描述一下',
          type: 'textarea',
          placeholder: '例如：宝宝拒奶、公公挑剔、自己很累...（如果没有，可以直接跳过）',
        },
        {
          id: 'gratitude-in-difficulty',
          text: '在这个不容易里，有没有什么是我可以感谢的？',
          subtitle: '可以选择或填写',
          type: 'multiple',
          options: [
            { id: 'body', text: '感谢自己的身体还在坚持', emoji: '💪' },
            { id: 'baby-way', text: '感谢宝宝用他的方式表达需要', emoji: '👶' },
            { id: 'not-give-up', text: '感谢自己即使难受，也没有放弃', emoji: '🌟' },
            { id: 'moment-peace', text: '感谢某个瞬间（哪怕只有几秒）的平静', emoji: '🕊️' },
            { id: 'support', text: '感谢身边有人支持', emoji: '🤝' },
            { id: 'other', text: '其他', emoji: '✏️' },
          ],
        },
        {
          id: 'gratitude-detail',
          text: '具体想感谢什么？',
          type: 'textarea',
          placeholder: '例如：丈夫主动去沟通了，他没有让我一个人面对。',
        },
        {
          id: 'self-compassion',
          text: '如果今天完全不想感恩，也没关系',
          subtitle: '选择一句对自己说的话',
          type: 'single',
          options: [
            { id: 'just-exist', text: '今天不需要感恩，只需要存在', emoji: '🌿' },
            { id: 'allowed-sad', text: '我允许自己今天不开心', emoji: '💙' },
            { id: 'tomorrow', text: '明天又是新的一天', emoji: '🌅' },
            { id: 'i-am-enough', text: '即使不感恩，我也足够好', emoji: '✨' },
            { id: 'custom', text: '自定义', emoji: '✏️' },
          ],
        },
      ],
    },
  ],
  questionCount: 16,
};

// 示例内容
export const gratitudeExample = {
  part1: {
    time: '下午3点20分',
    scene: 'wake-up',
    whatHappened: '他睁开眼睛，看到我，没有哭，盯着我看了一会儿，然后嘴角慢慢弯起来，给了我一个睡醒后的第一个笑。那个笑很慢，像是认出了我。',
    sensoryExperience: '阳光从窗户照进来，他的小脸亮亮的，我的心突然就软了。',
  },
  part2: {
    needMet: ['needed', 'seen', 'loved'],
    withoutIt: '如果没有这个笑，我今天可能会一直陷在"他为什么不吃我的奶"的焦虑里。',
    memoryTrigger: '它让我想起小时候，虽然很少被看见，但偶尔也有这样的瞬间——被某个温暖的光照亮。现在，我是那个可以给别人光的人。',
    lifeSupport: '阳光、宝宝的成长、丈夫的关心、这个家...',
  },
  part3: {
    expressGratitude: '我轻轻对他说："谢谢你认出妈妈。"然后抱着他多待了一会儿。',
    rememberFeeling: '我想把这一刻记下来，以后他再拒奶的时候，翻出来看看——他笑过，他认得我。',
    hardDayReminder: '我给自己泡了一杯热茶，慢慢喝，回味那个笑。',
  },
  part4: {
    difficultyToday: '下午公公又挑剔阿姨了，我听着不舒服。',
    gratitudeInDifficulty: ['support', 'not-give-up'],
    gratitudeDetail: '丈夫主动去沟通了，他没有让我一个人面对。即使不舒服，我没有被情绪吞没，我还记得宝宝的笑。',
    selfCompassion: 'just-exist',
  },
};
