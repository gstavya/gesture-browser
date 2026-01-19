// Wait for ONNX Runtime to be available before loading assistant.js
(function() {
  function initAssistant() {
    if (typeof ort !== 'undefined') {
      console.log('ONNX Runtime (ort) is available');
      // Load assistant.js
      const script = document.createElement('script');
      script.src = 'assistant.js';
      document.body.appendChild(script);
    } else {
      console.error('ONNX Runtime not loaded, retrying...');
      setTimeout(initAssistant, 100);
    }
  }
  
  // Try to initialize after a short delay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssistant);
  } else {
    setTimeout(initAssistant, 100);
  }
})();



