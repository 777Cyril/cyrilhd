import { IFontOpts } from "../render/fontRender";

export function lineHeight(fontOpts: IFontOpts) {
    return fontOpts.size * 1.2;
}
