import { APP_ICON_CONTENT_TYPE, APP_ICON_SIZE, generateAppIcon } from "@/lib/app-icon";

export const size = APP_ICON_SIZE;
export const contentType = APP_ICON_CONTENT_TYPE;

// Dourado do módulo Financeiro — mesmo tom de --primary em .theme-financeiro (ver globals.css).
export default function Icon() {
  return generateAppIcon("#D97706");
}
