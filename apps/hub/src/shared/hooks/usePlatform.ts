import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PlatformInfo {
  isNative: boolean;
  isDesktop: boolean;
  isMobileWeb: boolean;
  platform: 'android' | 'ios' | 'web';
  /** False until the real viewport width has been measured on the client. */
  resolved: boolean;
}

const DESKTOP_MIN_WIDTH = 1024;

function resolvePlatform(): PlatformInfo['platform'] {
  const value = Capacitor.getPlatform();
  if (value === 'android') return 'android';
  if (value === 'ios') return 'ios';
  return 'web';
}

function readPlatformInfo(width: number, resolved: boolean): PlatformInfo {
  const isNative = Capacitor.isNativePlatform();
  const platform = resolvePlatform();
  const isDesktop = !isNative && width > DESKTOP_MIN_WIDTH;
  const isMobileWeb = !isNative && width <= DESKTOP_MIN_WIDTH;

  return {
    isNative,
    isDesktop,
    isMobileWeb,
    platform,
    resolved,
  };
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>(() => {
    // During SSR the width is unknown. Report `resolved: false` so callers can
    // hold their layout instead of committing to a desktop-first branch that
    // flashes the wrong screen on phones.
    if (typeof window === 'undefined') {
      return readPlatformInfo(0, false);
    }
    return readPlatformInfo(window.innerWidth, true);
  });

  useEffect(() => {
    const update = () => setInfo(readPlatformInfo(window.innerWidth, true));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return info;
}
