// 占位首页：验证设计 Token 注入与基础布局骨架可用（ARCH §3 layouts / DESIGN-SYSTEM）
export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--rs-bg)', color: 'var(--rs-text)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rs-s3)',
          padding: 'var(--rs-s4) var(--rs-s5)',
          borderBottom: '1px solid var(--rs-border)',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--rs-r-pill)',
            background: 'var(--rs-brand-gradient)',
          }}
        />
        <strong style={{ fontSize: 'var(--rs-fs-lg)' }}>RunSun 控制台</strong>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--rs-fs-sm)', color: 'var(--rs-text-secondary)' }}>
          基础开发环境 · 占位页
        </span>
      </header>
      <main style={{ padding: 'var(--rs-s5)' }}>
        <section
          style={{
            background: 'var(--rs-surface)',
            border: '1px solid var(--rs-border)',
            borderRadius: 'var(--rs-r-lg)',
            padding: 'var(--rs-s5)',
          }}
        >
          <h1 style={{ fontSize: 'var(--rs-fs-2xl)', margin: 0 }}>开发环境已就绪</h1>
          <p style={{ color: 'var(--rs-text-secondary)', maxWidth: 720 }}>
            前端骨架（React 19 + TS5 + Vite6 + pnpm）已按设计文档初始化；MSW 拦截
            <code> /api/*</code>，真实后端网关通过 <code>VITE_API_BASE_URL</code> 切换。
          </p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 'var(--rs-s3)',
              padding: 'var(--rs-s2) var(--rs-s4)',
              borderRadius: 'var(--rs-r-pill)',
              background: 'var(--rs-brand-soft)',
              color: 'var(--rs-brand-strong)',
              fontSize: 'var(--rs-fs-sm)',
            }}
          >
            品牌色校验 ✓
          </span>
        </section>
      </main>
    </div>
  );
}
