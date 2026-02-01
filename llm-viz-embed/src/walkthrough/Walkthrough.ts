import { ICamera, ICameraPos } from "../Camera";
import { IBlkDef } from "../GptModelLayout";
import { IProgramState } from "../Program";
import { IRenderView } from "../render/modelRender";
import { Dim, Vec3, Vec4 } from "../utils/vector";
import { DimStyle, ICommentary, ICommentaryRes, IPhaseGroup, ITimeInfo, IWalkthroughArgs, phaseTools } from "./WalkthroughTools";

export type Phase = (args: IWalkthroughArgs) => IPhaseGroup;
export type PhaseGroup = IPhaseGroup;

export interface IWalkthrough {
    name: string;
    phases: IPhaseGroup[];
    phaseLength: number;
    phaseIdx: number;
    time: number;
    dt: number;
    running: boolean;
    commentary: ICommentaryRes | null;
    times: ITimeInfo[];
    prevPhaseIdx: number;
    prevTime: number;
    markDirty: () => void;
}

export function initWalkthrough(): IWalkthrough {
    return {
        name: 'Nano-GPT Visualization',
        phases: [],
        phaseLength: 0,
        phaseIdx: 0,
        time: 0,
        dt: 0,
        running: false,
        commentary: null,
        times: [],
        prevPhaseIdx: 0,
        prevTime: 0,
        markDirty: () => {},
    };
}

export function runWalkthrough(state: IProgramState, view: IRenderView) {
    // Walkthrough is disabled in vanilla embed version
    // Just render the model without walkthrough animations
}
