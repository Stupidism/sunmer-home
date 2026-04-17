export const APP_NAME = '卜卜日记'
export const ADMIN_APP_NAME = '卜卜日记后台管理'
export const APP_DESCRIPTION = '记录宝宝的睡眠、喂奶、换尿布和日常活动'

export const PRODUCTION_THEME_COLOR = '#FF957E'
export const PREVIEW_THEME_COLOR = '#5A94FF'
export const DARK_THEME_COLOR = '#1A1A2E'
export const APP_BACKGROUND_COLOR = '#FEFBF6'
export const APP_BACKGROUND_GRADIENT_CLASS =
  'bg-gradient-to-b from-[#fefbf6] to-[#fff5e6] dark:from-[#1a1a2e] dark:to-[#16213e]'
export const APP_MAIN_LAYOUT_CLASS = `min-h-screen ${APP_BACKGROUND_GRADIENT_CLASS}`

export const isPreviewEnvironment = process.env.VERCEL_ENV === 'preview'
export const themeColor = isPreviewEnvironment
  ? PREVIEW_THEME_COLOR
  : PRODUCTION_THEME_COLOR

export const webIconSvg = isPreviewEnvironment ? '/web-preview-icon.svg' : '/web-icon.svg'
export const webFavicon = isPreviewEnvironment
  ? '/web-preview-favicon.png'
  : '/web-favicon.png'

export const appIconSvg = isPreviewEnvironment ? '/preview-icon.svg' : '/icon.svg'
export const appIcon192 = isPreviewEnvironment ? '/preview-icon-192.png' : '/icon-192.png'
export const appIcon512 = isPreviewEnvironment ? '/preview-icon-512.png' : '/icon-512.png'
export const appAppleTouchIcon = isPreviewEnvironment
  ? '/preview-apple-touch-icon.png'
  : '/apple-touch-icon.png'

export const adminIconSvg = isPreviewEnvironment
  ? '/admin-preview-icon.svg'
  : '/admin-icon.svg'
export const adminFavicon = isPreviewEnvironment
  ? '/admin-preview-favicon.png'
  : '/admin-favicon.png'
