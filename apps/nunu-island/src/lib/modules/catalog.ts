export type ModuleItem = {
  href: string
  title: string
  desc: string
  bucket: 'morning' | 'daytime' | 'evening' | 'anytime'
}

export const moduleCatalog: ModuleItem[] = [
  { href: '/modules/scenario-guide', title: '场景指引', desc: '按时间场景进入工具。', bucket: 'morning' },
  { href: '/modules/articles', title: '温暖文章', desc: '稳定情绪与自我支持。', bucket: 'morning' },
  { href: '/modules/emotion-tree', title: '情绪词汇树', desc: '先识别，再进入处理路径。', bucket: 'daytime' },
  { href: '/modules/intensity-axis', title: '情绪强度数轴', desc: '用强度定位调节策略。', bucket: 'daytime' },
  { href: '/modules/mindfulness', title: '正念', desc: '快速回到当下。', bucket: 'anytime' },
  { href: '/modules/template-selector', title: '选择记录模板', desc: '进入深度记录模板。', bucket: 'evening' },
  { href: '/modules/beliefs', title: '我的信念', desc: '查看并练习信念重塑。', bucket: 'evening' },
  { href: '/modules/lifeline', title: '生命线', desc: '回看关键经历和意义。', bucket: 'evening' },
]
