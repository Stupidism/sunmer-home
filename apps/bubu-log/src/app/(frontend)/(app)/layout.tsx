import { ModalContainer } from '@/components/modals/ModalContainer'
import { AgentationWrapper } from '@/components/AgentationWrapper'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {/* Mobile-first: 手机上限制最大宽度，平板及以上自适应全屏 */}
      <div className="phone-container mx-auto max-w-md md:max-w-none min-h-screen bg-background shadow-xl md:shadow-none relative">
        {children}
      </div>
      {/* 全局弹窗容器 - 仅主 App 路由使用 */}
      <ModalContainer />
      {/* 开发环境视觉反馈工具 */}
      <AgentationWrapper />
    </>
  )
}
