import { ModalContainer } from '@/components/modals/ModalContainer'
import { AgentationWrapper } from '@/components/AgentationWrapper'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {/* Responsive: 手机端自适应，平板/PC端放大到全屏 */}
      <div className="phone-container mx-auto min-h-screen bg-background md:shadow-xl relative max-w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {children}
      </div>
      {/* 全局弹窗容器 - 仅主 App 路由使用 */}
      <ModalContainer />
      {/* 开发环境视觉反馈工具 */}
      <AgentationWrapper />
    </>
  )
}
