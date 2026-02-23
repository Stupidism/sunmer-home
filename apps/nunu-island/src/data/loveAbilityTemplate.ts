import type { Template } from '@/types';

export const loveAbilityTemplate: Template = {
  id: 'love-ability',
  title: '爱的能力日记',
  description: '在产后这个容易被琐事淹没的阶段，为自己点亮一盏灯，去看见爱、记录爱、练习爱',
  icon: '💝',
  color: 'from-rose-400 to-pink-500',
  bgColor: 'bg-rose-50',
  layers: [
    {
      id: 'part1',
      title: '第一部分：今天我主动付出的爱',
      subtitle: '记录一件你今天主动付出爱的事——哪怕很小',
      color: 'from-rose-300 to-pink-400',
      questions: [
        {
          id: 'what-i-did',
          text: '我做了什么？',
          subtitle: '比如：主动抱了抱宝宝、对丈夫说了一句温暖的话、给阿姨一个微笑',
          type: 'textarea',
          placeholder: '例如：今天下午，宝宝刚睡醒，我主动去抱他。虽然我知道他可能待会儿又不吃我的奶，但我还是想让他醒来第一眼看到的是妈妈。',
        },
        {
          id: 'my-feeling',
          text: '做这件事的时候，我心里是什么感觉？',
          type: 'textarea',
          placeholder: '例如：我心里其实有点紧张，怕他又扭头。但抱着他的那一刻，我感觉到他的身体软软的，贴着我，我的心也慢慢软下来。',
        },
        {
          id: 'their-response',
          text: '这份爱，对方收到了吗？我看到了什么回应？',
          subtitle: '哪怕只是宝宝的一个眼神',
          type: 'textarea',
          placeholder: '例如：他没有笑，但他也没有抗拒。他在我怀里安静了一会儿。这对我来说，就是回应。',
        },
        {
          id: 'self-discovery',
          text: '这份付出，让我对自己有什么新的发现？',
          type: 'textarea',
          placeholder: '例如：原来我还可以在"可能被拒绝"的情况下，依然选择靠近。这需要勇气。',
        },
      ],
    },
    {
      id: 'part2',
      title: '第二部分：今天我创造的美',
      subtitle: '记录一件你今天让生活变得更美的事——哪怕很微小',
      color: 'from-amber-300 to-orange-400',
      questions: [
        {
          id: 'what-i-created',
          text: '我创造了什么？',
          subtitle: '比如：把宝宝的哭声想象成歌曲、给家里插了一朵小花、整理了一个小角落',
          type: 'textarea',
          placeholder: '例如：傍晚，我趁宝宝睡着，把窗台上乱放的奶瓶收好，擦了擦桌子，然后把那盆快干死的绿萝浇了水。',
        },
        {
          id: 'creation-state',
          text: '创造的时候，我是什么状态？',
          type: 'textarea',
          placeholder: '例如：我什么也没想，就是机械地做。但做完后，站在那里看了一会儿，心里有一种"我在照顾生活"的感觉。',
        },
        {
          id: 'beauty-received',
          text: '这份美，被我之外的人或世界感受到了吗？',
          type: 'textarea',
          placeholder: '例如：可能只有我自己看到。但够了。它让我觉得，即使在家务里，我也可以创造一点秩序和安宁。',
        },
        {
          id: 'life-difference',
          text: '这份创造，让我觉得生活有什么不同？',
          type: 'textarea',
          placeholder: '例如：看着干净的小角落，觉得家里好像亮了一点。',
        },
      ],
    },
    {
      id: 'part3',
      title: '第三部分：今天我感受到的生命美好',
      subtitle: '记录一件今天让我心头一暖的瞬间——哪怕只有几秒',
      color: 'from-emerald-300 to-teal-400',
      questions: [
        {
          id: 'what-happened',
          text: '发生了什么？',
          subtitle: '比如：宝宝睡醒后对我笑、阳光照在床上、丈夫下班回来亲了亲我',
          type: 'textarea',
          placeholder: '例如：晚上喂完奶，我坐在沙发上休息。丈夫从书房出来，走过来亲了亲我的额头，什么都没说，又回去工作了。就那么一下。',
        },
        {
          id: 'felt-what',
          text: '那一刻，我感受到了什么？',
          subtitle: '情绪、身体感受',
          type: 'textarea',
          placeholder: '例如：我的额头是暖的，心里也暖了一下。我甚至没来得及反应，他就走了。',
        },
        {
          id: 'why-touching',
          text: '这个瞬间，为什么触动了我？',
          type: 'textarea',
          placeholder: '例如：它没有预谋，没有目的，就是一个小小的"我在乎你"。',
        },
        {
          id: 'memory-or-hope',
          text: '它让我想起了什么？或者它让我对未来有什么期待？',
          type: 'textarea',
          placeholder: '例如：它让我想起刚恋爱的时候，他也是这样，偶尔会突然亲我一下。这个瞬间让我觉得：即使生活被孩子填满，我们之间还有这样的小瞬间。',
        },
      ],
    },
    {
      id: 'part4',
      title: '第四部分：今天，我学会了什么关于爱的事？',
      subtitle: '用一句话总结你今天对爱的新理解',
      color: 'from-violet-300 to-purple-400',
      questions: [
        {
          id: 'love-understanding',
          text: '今天，我明白了：',
          subtitle: '选择一句最贴近你今天的感悟',
          type: 'single',
          options: [
            { id: 'presence', text: '爱不是要做大事，是每一次温柔的存在', emoji: '💫' },
            { id: 'flow', text: '即使宝宝今天没吃我的奶，我抱着他的时候，爱也在流动', emoji: '🌊' },
            { id: 'self-love', text: '我可以对自己也付出爱——比如允许自己休息', emoji: '🤗' },
            { id: 'boundary', text: '爱有时候是坚持边界，不是一味付出', emoji: '🛡️' },
            { id: 'small-things', text: '爱藏在小事里，不需要轰轰烈烈', emoji: '✨' },
            { id: 'custom', text: '自定义', emoji: '✏️' },
          ],
        },
        {
          id: 'love-understanding-custom',
          text: '自定义的理解：',
          type: 'textarea',
          placeholder: '写下你今天对爱的新理解...',
        },
      ],
    },
    {
      id: 'part5',
      title: '第五部分：送给自己的一句话',
      subtitle: '写下一句你今天最需要听到的话',
      color: 'from-blue-300 to-cyan-400',
      questions: [
        {
          id: 'self-message',
          text: '我今天最需要听到的话是：',
          subtitle: '选择或自定义',
          type: 'single',
          options: [
            { id: 'good-job', text: '你做得已经很好了', emoji: '👏' },
            { id: 'worthy', text: '你值得被爱，也值得爱自己', emoji: '💎' },
            { id: 'warmer', text: '今天，你让这个世界更温暖了一点', emoji: '🔥' },
            { id: 'practice', text: '即使今天不完美，你也在练习爱', emoji: '📖' },
            { id: 'enough', text: '你已经足够好', emoji: '✨' },
            { id: 'custom', text: '自定义', emoji: '✏️' },
          ],
        },
        {
          id: 'self-message-custom',
          text: '自定义的话：',
          type: 'textarea',
          placeholder: '写下你想对自己说的话...',
        },
      ],
    },
  ],
  questionCount: 18,
};

// 示例内容
export const loveAbilityExample = {
  part1: {
    whatIDid: '今天下午，宝宝刚睡醒，我主动去抱他。虽然我知道他可能待会儿又不吃我的奶，但我还是想让他醒来第一眼看到的是妈妈。',
    myFeeling: '我心里其实有点紧张，怕他又扭头。但抱着他的那一刻，我感觉到他的身体软软的，贴着我，我的心也慢慢软下来。',
    theirResponse: '他没有笑，但他也没有抗拒。他在我怀里安静了一会儿。这对我来说，就是回应。',
    selfDiscovery: '原来我还可以在"可能被拒绝"的情况下，依然选择靠近。这需要勇气。',
  },
  part2: {
    whatICreated: '傍晚，我趁宝宝睡着，把窗台上乱放的奶瓶收好，擦了擦桌子，然后把那盆快干死的绿萝浇了水。',
    creationState: '我什么也没想，就是机械地做。但做完后，站在那里看了一会儿，心里有一种"我在照顾生活"的感觉。',
    beautyReceived: '可能只有我自己看到。但够了。它让我觉得，即使在家务里，我也可以创造一点秩序和安宁。',
    lifeDifference: '看着干净的小角落，觉得家里好像亮了一点。',
  },
  part3: {
    whatHappened: '晚上喂完奶，我坐在沙发上休息。丈夫从书房出来，走过来亲了亲我的额头，什么都没说，又回去工作了。就那么一下。',
    feltWhat: '我的额头是暖的，心里也暖了一下。我甚至没来得及反应，他就走了。',
    whyTouching: '它没有预谋，没有目的，就是一个小小的"我在乎你"。',
    memoryOrHope: '它让我想起刚恋爱的时候，他也是这样，偶尔会突然亲我一下。这个瞬间让我觉得：即使生活被孩子填满，我们之间还有这样的小瞬间。',
  },
  part4: {
    loveUnderstanding: 'presence',
    loveUnderstandingCustom: '爱不只是"做"什么，也是"在"什么。我在宝宝身边，丈夫在我身边，这些"在"本身就是爱。',
  },
  part5: {
    selfMessage: 'warmer',
    selfMessageCustom: '今天，你让这个家暖了一点点。即使只有一点点，那也是你。',
  },
};
