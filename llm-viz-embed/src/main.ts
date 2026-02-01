import { LLMViz } from './LLMViz';

// Export globally for easy embedding
(window as any).LLMViz = LLMViz;

// Auto-init if canvas exists on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViz);
} else {
  initViz();
}

function initViz() {
  const canvas = document.getElementById('llm-viz') as HTMLCanvasElement;
  if (canvas) {
    const viz = new LLMViz(canvas);
    viz.init().then(() => viz.start()).catch(err => {
      console.error('Failed to initialize LLM visualization:', err);
    });

    // Handle window resize
    window.addEventListener('resize', () => viz.handleResize());
  }
}
