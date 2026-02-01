import { ICameraPos } from "../Camera";
import { IBlkLabel } from "../GptModelLayout";

export interface ICameraLerp {
    camInitial: ICameraPos;
    camFinal: ICameraPos;
    duration: number;
    t: number;
}

export interface IMovementInfo {
    action: MovementAction | null;
    actionHover: MovementAction | null;

    depth: number;
    target: number[]; // index maps to depth, which maps to the INavLevel tree

    cameraLerp: ICameraLerp | null;
}

export enum MovementAction {
    Up,
    Down,
    Left,
    Right,
    Focus,
    In,
    Out,
    Expand,
}

export interface INavLevel {
    name?: string;
    label?: IBlkLabel;
    children?: INavLevel[];
}

// Stub function for vanilla implementation
export function manageMovement(/* ... */): void {
    // Movement controls are disabled in vanilla version
    // This is just a stub to satisfy imports
}
