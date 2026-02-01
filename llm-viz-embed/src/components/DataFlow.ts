import { IProgramState } from "../Program";
import { IBlkDef } from "../GptModelLayout";
import { IRenderState } from "../render/modelRender";
import { addQuad, addVert, addPrimitiveRestart } from "../render/triRender";
import { Mat4f } from "../utils/matrix";
import { Vec3, Vec4 } from "../utils/vector";

// Stub function - data flow visualization disabled in vanilla version
export function drawDataFlow(state: IProgramState, blk: IBlkDef, destIdx: Vec3, pinIdx?: Vec3) {
    // Data flow overlay is disabled in vanilla embed version
}

// Stub function - returns null in vanilla version
export function getBlockValueAtIdx(state: IProgramState, blk: IBlkDef, idx: Vec3): number | null {
    return null;
}

export function drawRoundedRect(state: IRenderState, tl: Vec3, br: Vec3, color: Vec4, mtx: Mat4f, radius: number) {
    if (radius === 0) {
        addQuad(state.triRender, tl, br, color, mtx);
        return;
    }

    radius = Math.min(radius, (br.x - tl.x) / 2, (br.y - tl.y) / 2);

    let n = new Vec3(0, 0, 1);
    let innerQuadTl = tl.add(new Vec3(radius, radius));
    let innerQuadBr = br.sub(new Vec3(radius, radius));

    // inner quad
    addQuad(state.triRender, innerQuadTl, innerQuadBr, color, mtx);

    // bottom right starting point
    addVert(state.triRender, new Vec3(innerQuadBr.x, br.y), color, n, mtx);
    addVert(state.triRender, new Vec3(innerQuadBr.x, innerQuadBr.y), color, n, mtx);

    for (let cIdx = 0; cIdx < 4; cIdx++) {
        let pivot = new Vec3(
            cIdx < 2 ? innerQuadTl.x : innerQuadBr.x,
            (cIdx + 1) % 4 < 2 ? innerQuadBr.y : innerQuadTl.y,
        );

        let startTheta = ((cIdx + 1) % 4) * Math.PI / 2;

        // pivot around each of the 4 corners
        let nRadiusVerts = 6;
        for (let i = 0; i < nRadiusVerts + 1; i++) {
            let theta = startTheta + Math.PI / 2 * i / nRadiusVerts;
            let v = new Vec3(Math.cos(theta) * radius, Math.sin(theta) * radius).add(pivot);
            addVert(state.triRender, v, color, n, mtx);
            addVert(state.triRender, pivot, color, n, mtx);
        }
    }

    addPrimitiveRestart(state.triRender);
}
