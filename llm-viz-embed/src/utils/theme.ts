import { Vec4 } from "./vector";

export function isNightMode(): boolean {
    return true;
}

export function getWeightColor(): Vec4 {
    // Always LLMx red
    return new Vec4(0.67, 0.0, 0.0, 1.0);
}

export function getHexColor(defaultHex: string): string {
    // Always #aa0000
    return "#aa0000";
}
