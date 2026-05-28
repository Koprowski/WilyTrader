import type { WilyTraderDesktopApi } from '../preload';

declare global {
  interface Window {
    wilyTraderDesktop: WilyTraderDesktopApi;
  }
}

export {};
