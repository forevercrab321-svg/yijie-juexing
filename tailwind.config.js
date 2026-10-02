/**
 * Tailwind 配置。原先写在 index.html 里交给 Play CDN 运行时编译，现改为构建时编译。
 *
 * 为什么迁：Play CDN 官方明确不可用于生产——它在浏览器里现场编译样式，
 * 首屏会先闪一下无样式的页面，而且整站的观感取决于一个第三方 CDN 能不能连上。
 *
 * 调色板原样照搬，不改任何颜色值。重定义色板而非逐个改类名的理由见下方注释。
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  /*
    重定义调色板，而不是逐个改组件的类名。
    全站有几十处 bg-slate-900 / text-cyan-400 / border-indigo-500，
    改类名既慢又容易漏；把色板本身换掉，一次生效且不会有漏网的。

    原则（取自旷野之息的 UI）：
      · 结构色只有一套暖石板，不用纯黑——纯黑会让画面发死
      · 点缀色只有金，其余全部收敛过去
      · 功能色只保留两个：铜绿(生机/成功)、暖橙(注意/紧急)

    代价是语义漂移：代码里写 cyan，渲染出来是铜绿。
    这是刻意的取舍——先拿到统一的视觉，语义等美术定稿后再统一重命名。
  */
  theme: {
          extend: {
            colors: {
              // 石板：全站结构色
              slate: {
                50:  '#f7f2e8', 100: '#ede4d3', 200: '#d4c9b4', 300: '#b8ab94',
                400: '#9c907a', 500: '#7d735f', 600: '#574c3e', 700: '#3d352b',
                800: '#2e2820', 900: '#24201b', 950: '#1c1815',
              },
              // 金：唯一的主点缀
              amber: {
                50:  '#fbf6e9', 100: '#f4ebd4', 200: '#e8cf94', 300: '#d9bc79',
                400: '#c9a961', 500: '#b8964e', 600: '#9a7c3e', 700: '#7a6131',
                800: '#5c4926', 900: '#3f321a', 950: '#241c0f',
              },
              yellow: {
                300: '#e8cf94', 400: '#c9a961', 500: '#b8964e', 600: '#9a7c3e',
              },
              // 铜绿：生机 / 成功。emerald 与 cyan 收敛到同一系，避免画面出现两种绿
              emerald: {
                100: '#d9e8e0', 200: '#b4d2c4', 300: '#8fbca8', 400: '#6d9b87',
                500: '#578270', 600: '#44685a', 700: '#354f45', 800: '#28372f', 900: '#1c2621',
              },
              cyan: {
                100: '#dae7e9', 200: '#b6d0d4', 300: '#93b8bf', 400: '#7ba2ab',
                500: '#628691', 600: '#4d6b74', 700: '#3b5158', 800: '#2b3a3f', 900: '#1e282c',
              },
              // 靛蓝与紫：全部并入石板+金，不再作为独立色相出现
              indigo: {
                100: '#e4dcc9', 200: '#cfc3a8', 300: '#b3a586', 400: '#95886b',
                500: '#786c53', 600: '#5c5240', 700: '#443c2e', 800: '#302a20', 900: '#221d16',
              },
              purple: {
                200: '#dcc9a8', 300: '#c2ab85', 400: '#a68e69', 500: '#8a7452',
                600: '#6b5940', 700: '#4e4030', 800: '#352b20', 900: '#241d15',
              },
              violet: { 400: '#a68e69', 500: '#8a7452', 600: '#6b5940' },
              // 暖橙：注意 / 紧急。取代刺目的正红
              red: {
                100: '#f2ddce', 200: '#e5bfa4', 300: '#d79c74', 400: '#c87a45',
                500: '#ad6236', 600: '#8c4d29', 700: '#6b3b20', 800: '#4a2a17', 900: '#2e1b0f',
                950: '#1d1109',
              },
              sky: { 400: '#7ba2ab', 500: '#628691', 600: '#4d6b74' },

              /*
                ══ 可爱风格（docs/studio/style-cute.md）══════════════════════
                新组件只用 cute-* 与 quest-* 这两个命名空间。上面那些 slate / amber / red / sky / cyan… 是被重映射成
                大地色的旧色板（代码写 sky，渲染出来是灰青），新代码一旦用了它们，就会把旧方向的颜色带回来。
                旧重映射在迁移期间原样保留，发布阶段与旧组件一起清理。

                hex 与 index.html :root 的 --cute-* / --quest-* 一一对应。三档用法：
                  50 浅底 · 400 明亮色（只做图形，不承载文字）· 600 深色（承载文字，白字压在上面 ≥ 4.5:1）
              */
              cute: {
                bg: '#EEF7FA',
                'bg-2': '#F4FAEE',
                panel: '#FFFFFF',
                'panel-2': '#F3F7FA',
                'panel-3': '#E9F0F5',
                line: '#DCE6EE',
                'line-strong': '#C5D3DE',
                'line-input': '#7B8BA0',
                ink: '#1F2D44',
                'ink-2': '#4B5B73',
                'ink-3': '#5F6E84',
                disabled: '#EDF1F5',
                'disabled-ink': '#7D8A9C',
                teal: { 50: '#E6F8F5', 400: '#2CC5B0', 600: '#127C6F', 700: '#0F7468', 800: '#0B5C52' },
                sky: { 50: '#E8F4FE', 400: '#3BA4F5', 600: '#1268B4' },
                sun: { 50: '#FFF6DC', 400: '#FFC83D', 600: '#8C6100', ink: '#4A3300', lip: '#D99A00' },
                coral: { 50: '#FFECEA', 400: '#FF5F5A', 500: '#E5484D', 600: '#C4302E', 800: '#9A2321' },
                success: { 50: '#E6F7EF', 400: '#2DBE7E', 600: '#1A7A50' },
                warn: { 50: '#FFF4DC', 400: '#FFB020', 600: '#8F5A00' },
                danger: { 50: '#FFECEA', 400: '#FF5F5A', 600: '#C4302E' },
              },
              // 委托类型色：界面与 3D 标记同一组 hex
              quest: {
                transport: { 50: '#E8F4FE', 400: '#3BA4F5', 600: '#1268B4' }, // 物资运输
                hunt: { 50: '#FFF0E5', 400: '#FF8C42', 600: '#B24A0C' },      // 魔物讨伐
                build: { 50: '#EEF8EA', 400: '#68C34A', 600: '#3D7A28' },     // 迷宫建设
                envoy: { 50: '#FDEBF3', 400: '#F26DAA', 600: '#BE2E70' },     // 异界交涉
                rescue: { 50: '#FFECEA', 400: '#FF5F5A', 600: '#C4302E' },    // 紧急救援
              },
            },
            fontFamily: {
              sans: ['Noto Serif SC', 'Inter', 'serif'],
              serif: ['Noto Serif SC', 'serif'],
              mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
              // 可爱风格：西文与数字先落到 Nunito，汉字逐字回退到中文字体
              cute: ['Nunito', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
              // 标题专用（≥ 20px）：汉字走站酷快乐体
              'cute-display': ['Nunito', 'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
            },
            fontSize: {
              // 行高与字重一起给：可爱风格的字偏粗，行高放松一点才不挤
              'cute-cap': ['12px', { lineHeight: '16px', fontWeight: '800' }],
              'cute-sm': ['14px', { lineHeight: '20px', fontWeight: '700' }],
              'cute-body': ['16px', { lineHeight: '24px', fontWeight: '600' }],
              'cute-lg': ['18px', { lineHeight: '24px', fontWeight: '800' }],
              'cute-xl': ['22px', { lineHeight: '28px', fontWeight: '800' }],
              'cute-2xl': ['28px', { lineHeight: '34px', fontWeight: '900' }],
              'cute-num': ['32px', { lineHeight: '36px', fontWeight: '900' }],
              'cute-display': ['40px', { lineHeight: '46px', fontWeight: '900' }],
            },
            borderRadius: {
              'cute-xs': '8px',
              'cute-sm': '12px',
              'cute-md': '16px',
              'cute-btn': '20px',
              'cute-card': '20px',
              'cute-lg': '24px',
              'cute-xl': '28px',
            },
            boxShadow: {
              'cute-1': '0 1px 2px rgba(31, 45, 68, 0.08), 0 2px 6px rgba(31, 45, 68, 0.06)',
              'cute-2': '0 2px 4px rgba(31, 45, 68, 0.06), 0 8px 20px rgba(31, 45, 68, 0.10)',
              'cute-3': '0 6px 12px rgba(31, 45, 68, 0.08), 0 18px 44px rgba(31, 45, 68, 0.16)',
              'cute-float': '0 3px 0 rgba(31, 45, 68, 0.06), 0 10px 28px rgba(31, 45, 68, 0.20)',
              'cute-focus': '0 0 0 3px #FFFFFF, 0 0 0 5.5px #1268B4',
            },
            transitionTimingFunction: {
              DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
              soft: 'cubic-bezier(0.16, 1, 0.3, 1)',
              'cute-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              'cute-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
              'cute-in': 'cubic-bezier(0.55, 0, 0.75, 0.2)',
            },
            transitionDuration: {
              'cute-tap': '90ms',
              'cute-fast': '160ms',
              'cute-base': '240ms',
              'cute-pop': '380ms',
              'cute-sheet': '440ms',
            },
            // 关键帧本体在 index.css（cute-pop-in 等），这里只做简写，减少动效时由 index.css 统一关掉
            animation: {
              'cute-pop': 'cute-pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
              'cute-sheet': 'cute-sheet-up 440ms cubic-bezier(0.22, 1, 0.36, 1) both',
              'cute-bounce': 'cute-bounce 900ms cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
              'cute-float': 'cute-float 2.4s ease-in-out infinite',
              'cute-wiggle': 'cute-wiggle 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
            },
          },
        },
  /*
    index.css 的 .cute-* 原语按用量裁剪：哪个组件用到了才进 CSS（全部保留会多 18 KB 未压缩，超出 80 KB 的 CSS 预算）。
    例外是色调与图钉形状这两族：它们几乎一定按委托类型拼出来（`cute-tone-${tone}`），Tailwind 扫描源码看不到
    完整类名，会当作没用到而裁掉，颜色和形状就悄无声息地丢了。所以这两族逐个列名保留（列名而不用正则，
    正则模式只对照内置工具类，会在每次构建时误报「没匹配到任何类」）。
  */
  safelist: [
    ...['teal', 'sky', 'sun', 'coral', 'success', 'warn', 'danger', 'neutral', 'transport', 'hunt', 'build', 'envoy', 'rescue'].map((t) => `cute-tone-${t}`),
    ...['scallop', 'shield', 'hex', 'bubble', 'cross'].map((s) => `cute-pin-${s}`),
  ],
  plugins: [],
};
