import { authSecretConfigured } from '@/server/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Login — Family Ledger' }

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Private finance</p>
        <h1>家庭账本</h1>
        <p>登录后查看家庭、公司、退款与对账资料。公开页面不包含任何财务数据。</p>
        {!authSecretConfigured ? (
          <p>认证配置未就绪，登录已关闭。</p>
        ) : (
          <LoginForm />
        )}
      </section>
    </main>
  )
}
