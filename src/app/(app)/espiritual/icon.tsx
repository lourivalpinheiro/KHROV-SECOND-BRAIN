import { APP_ICON_CONTENT_TYPE, APP_ICON_SIZE, generateAppIcon } from "@/lib/app-icon";

export const size = APP_ICON_SIZE;
export const contentType = APP_ICON_CONTENT_TYPE;

// Roxo do módulo Espiritual — mesmo tom de --primary em .theme-espiritual (ver globals.css).
export default function Icon() {
  return generateAppIcon("#7C3AED");
}
