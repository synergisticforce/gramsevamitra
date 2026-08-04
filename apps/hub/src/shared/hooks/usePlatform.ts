import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PlatformInfo {
  isNative: boolean;
  isDesktop: boolean;
  isMobileWeb: boolean;
  platform: 'android' | 'ios' | 'web';
}

const DESKTOP_MIN_WIDTH = 1024;

function resolvePlatform(): PlatformInfo['platform'] {
  const value = Capacitor.getPlatform();
  if (value === 'android') return 'android';
  if (value === 'ios') return 'ios';
  return 'web';
}

function readPlatformInfo(width: number): PlatformInfo {
  const isNative = Capacitor.isNativePlatform();
  const platform = resolvePlatform();
  const isDesktop = !isNative && width > DESKTOP_MIN_WIDTH;
  const isMobileWeb = !isNative && width <= DESKTOP_MIN_WIDTH;

  return {
    isNative,
    isDesktop,
    isMobileWeb,
    platform,
  };
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>(() => {
    const width = typeof window === 'undefined' ? DESKTOP_MIN_WIDTH + 1 : window.innerWidth;
    return readPlatformInfo(width);
  });

  useEffect(() => {
    const update = () => setInfo(readPlatformInfo(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return info;
}
