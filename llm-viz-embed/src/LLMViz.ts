import { IDataAndModel, initModel, IModelState } from './GptModel';
import { IRenderState, IRenderView, initRender, renderModel } from './render/modelRender';
import { fetchFontAtlasData, IFontAtlasData } from './render/fontRender';
import { Random } from './utils/random';
import { ITensorSet, TensorF32 } from './utils/tensor';
import { initProgramState, IProgramState, runProgram } from './Program';
import { Vec3 } from './utils/vector';
import { loadNativeBindings } from './NativeBindings';
import { constructModel, createGpuModelForWasm } from './GptModelWasm';

function getAssetBase() {
  let base = (window as any).LLM_VIZ_ASSET_BASE as string | undefined;
  if (!base) {
    base = '/llm-viz';
  }
  return base.replace(/\/$/, '');
}

function makeAssetUrl(path: string) {
  let base = getAssetBase();
  let cleanPath = path.replace(/^\//, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
}

async function fetchTensorData(url: string): Promise<ITensorSet> {
  const resp = await fetch(url);
  const data = await resp.json();
  for (const k in data) {
    if (data[k].shape) {
      data[k] = TensorF32.fromJson(data[k]);
    }
  }
  return data;
}

export class LLMViz {
  private canvas: HTMLCanvasElement;
  private progState: IProgramState | null = null;
  private renderState: IRenderState | null = null;
  private modelState: IModelState | null = null;
  private random: Random;
  private animationId: number | null = null;
  private stopped = false;
  private canvasSizeDirty = true;
  private isDirty = false;
  private isWaitingForSync = false;
  private prevTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.random = new Random(4);
  }

  async init() {
    try {
      // Load all required data
      const [data, model, native, fontAtlasData] = await Promise.all([
        fetchTensorData(makeAssetUrl('gpt-nano-sort-t0-partials.json')),
        fetchTensorData(makeAssetUrl('gpt-nano-sort-model.json')),
        loadNativeBindings(getAssetBase()),
        fetchFontAtlasData(getAssetBase())
      ]);

      const dataAndModel: IDataAndModel = { data, model, native };

      // Initialize program state
      this.progState = initProgramState(this.canvas, fontAtlasData);
      this.progState.markDirty = this.markDirty;
      this.progState.walkthrough.markDirty = this.markDirty;
      this.renderState = this.progState.render;

      // Initialize GPU model
      if (dataAndModel && this.renderState) {
        this.progState.gptGpuModel = initModel(this.renderState, dataAndModel, 1);
        this.progState.native = dataAndModel.native;
        this.progState.wasmGptModel = constructModel(
          dataAndModel.model,
          dataAndModel.model.config,
          dataAndModel.native
        );
        this.progState.jsGptModel = createGpuModelForWasm(
          this.renderState.gl,
          dataAndModel.model.config
        );
      }

      // Set initial canvas size
      this.handleResize();

      console.log('LLM Visualization initialized successfully');
    } catch (error) {
      console.error('Error initializing LLM visualization:', error);
      throw error;
    }
  }

  start() {
    if (!this.progState || !this.renderState) {
      console.error('Cannot start: visualization not initialized');
      return;
    }

    this.stopped = false;
    this.prevTime = performance.now();
    this.markDirty();
  }

  stop() {
    this.stopped = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private markDirty = () => {
    if (this.stopped || !this.progState) {
      return;
    }

    this.isDirty = true;
    if (!this.animationId) {
      this.prevTime = performance.now();
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

  private loop = (time: number) => {
    if (!(this.isDirty || this.isWaitingForSync) || this.stopped) {
      this.animationId = null;
      return;
    }

    const wasDirty = this.isDirty;
    this.isDirty = false;
    this.isWaitingForSync = false;

    let dt = time - this.prevTime;
    this.prevTime = time;
    if (dt < 8) dt = 16; // Handle timing edge cases

    // Check sync objects
    this.checkSyncObjects();
    const prevSyncCount = this.renderState?.syncObjects.length ?? 0;

    if (wasDirty || this.isDirty) {
      this.render(time, dt);
    }

    const newSyncCount = this.renderState?.syncObjects.length ?? 0;
    if (newSyncCount !== prevSyncCount) {
      this.isWaitingForSync = true;
    }

    this.animationId = requestAnimationFrame(this.loop);
  };

  private checkSyncObjects() {
    if (!this.renderState) {
      return;
    }

    const gl = this.renderState.gl;
    const objs = this.renderState.syncObjects;
    let anyToRemove = false;

    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      if (obj.isReady) {
        anyToRemove = true;
        continue;
      }
      const syncStatus = gl.clientWaitSync(obj.sync, 0, 0);
      if (syncStatus === gl.TIMEOUT_EXPIRED) {
        this.isWaitingForSync = true;
      } else {
        obj.isReady = true;
        obj.elapsedMs = performance.now() - obj.startTime;
        gl.deleteSync(obj.sync);
        anyToRemove = true;
      }
    }
    if (anyToRemove) {
      this.renderState.syncObjects = objs.filter(o => !o.isReady);
      this.markDirty();
    }
  }

  private render(time: number, dt: number) {
    if (!this.renderState || !this.progState) {
      return;
    }

    if (this.canvasSizeDirty) {
      const bcr = this.canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio;
      this.canvas.width = bcr.width * scale;
      this.canvas.height = bcr.height * scale;
      this.progState.render.size = new Vec3(bcr.width, bcr.height);
      this.canvasSizeDirty = false;
    }

    const view: IRenderView = { time, dt, markDirty: this.markDirty };
    runProgram(view, this.progState);
    this.progState.htmlSubs.notify();
  }

  handleResize() {
    this.canvasSizeDirty = true;
    this.markDirty();
  }
}
