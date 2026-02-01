// Vanilla version of layout - no React dependency

import { Vec3 } from "./vector";

export interface ILayout {
    width: number;
    height: number;
    isDesktop: boolean;
    isPhone: boolean;
}

export function getScreenLayout(): ILayout {
    let mediaQuery = window.matchMedia('screen and (max-width: 800px)');
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        isDesktop: !mediaQuery.matches,
        isPhone: mediaQuery.matches,
    };
}

// Default layout for initialization
export function createDefaultLayout(): ILayout {
    if (typeof window !== 'undefined') {
        return getScreenLayout();
    }
    return {
        width: 1920,
        height: 1080,
        isDesktop: true,
        isPhone: false,
    };
}
