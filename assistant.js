// Check if ONNX Runtime is loaded
if (typeof ort === 'undefined') {
  console.error('ONNX Runtime (ort) is not loaded!');
  document.addEventListener('DOMContentLoaded', () => {
    const errorDiv = document.getElementById('errorMessage') || document.body;
    errorDiv.innerHTML = '<div class="error">Error: ONNX Runtime library failed to load. Please check your internet connection and reload.</div>';
  });
}

// Get DOM elements
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const gestureText = document.getElementById('gestureText');
const actionText = document.getElementById('actionText');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const errorMessage = document.getElementById('errorMessage');

let stream = null;
let isRunning = false;
let detectionInterval = null;
let lastGesture = null; // Track last gesture detected in previous frame
let previousFrameGesture = null; // Track gesture from previous frame to detect gaps
let isEyeTrackingActive = false;
let eyeTrackingInterval = null;
let lastExecutedAction = null; // Track last executed action (action string)
let lastExecutedGesture = null; // Track last executed gesture number
let lastActionTimestamp = 0; // Track when last action was executed
const ACTION_COOLDOWN_MS = 2000; // 2 second cooldown between same actions

// Gesture mappings
const GESTURE_ACTIONS = {
  3: { name: 'Gesture 3', action: 'eye_click' },
  4: { name: 'Gesture 4', action: 'open_yc' },
  6: { name: 'Gesture 6', action: 'open_timer' },
  14: { name: 'Gesture 14', action: 'close_tab' },
  15: { name: 'Gesture 15', action: 'open_youtube' },
  16: { name: 'Gesture 16', action: 'open_instagram' },
  17: { name: 'Gesture 17', action: 'mute_all_tabs' },
  19: { name: 'Gesture 19', action: 'open_claude' },
  20: { name: 'Gesture 20', action: 'open_window' },
  21: { name: 'Gesture 21', action: 'open_chatgpt' },
  23: { name: 'Gesture 23', action: 'unmute_all_tabs' },
  26: { name: 'Gesture 26', action: 'open_gemini' },
};

// Initialize camera
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    videoElement.srcObject = stream;
    videoElement.play();

    // Set canvas size to match video
    const updateCanvasSize = () => {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
      } else {
        canvasElement.width = 640;
        canvasElement.height = 480;
      }
    };

    // Update canvas size when video metadata is loaded
    videoElement.addEventListener('loadedmetadata', updateCanvasSize, { once: true });

    // Set initial canvas size
    updateCanvasSize();

    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    statusIndicator.classList.add('recording');
    statusText.textContent = 'Camera active - Show gesture';

    // Load model and start detection
    await loadModel();
    await initializeEyeTracking();
    startDetection();

  } catch (error) {
    console.error('Error accessing camera:', error);
    showError(`Camera error: ${error.message}`);
    statusText.textContent = 'Camera error';
  }
}

// Stop camera
function stopCamera() {
  isRunning = false;
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  videoElement.srcObject = null;
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  statusIndicator.classList.remove('recording');
  statusText.textContent = 'Stopped';
  gestureText.textContent = 'No gesture detected';
  actionText.textContent = 'Waiting for gesture...';
}

// Check Flask server connection
async function loadModel() {
  try {
    statusText.textContent = 'Connecting to Flask server...';

    // Check if Flask server is running
    const response = await fetch('http://localhost:5001/health');
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Flask server connected:', result);
    statusText.textContent = 'Server connected - Ready for gestures';

  } catch (error) {
    console.error('Error connecting to Flask server:', error);
    statusText.textContent = 'Server not available';
    showError(`Cannot connect to Flask server. Make sure server.py is running on http://localhost:5001`);
  }
}

// Start gesture detection loop
function startDetection() {
  if (isRunning) return;

  isRunning = true;
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

  detectionInterval = setInterval(async () => {
    if (!videoElement.videoWidth) return;

    // Create a temporary canvas to get image data for detection
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth || 640;
    tempCanvas.height = videoElement.videoHeight || 480;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get image data for processing
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    // Update canvas size to match video
    if (canvasElement.width !== tempCanvas.width || canvasElement.height !== tempCanvas.height) {
      canvasElement.width = tempCanvas.width;
      canvasElement.height = tempCanvas.height;
    }

    // Clear the overlay canvas before drawing new overlay
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Detect gesture with bounding box
    const detectionResult = await detectGesture(imageData);
    const gesture = detectionResult?.gesture;
    const bbox = detectionResult?.bbox;

    // Draw bounding box and gesture label if detection exists
    if (bbox && gesture !== null && gesture !== undefined) {
      drawDetectionOverlay(ctx, bbox, gesture, detectionResult.confidence);
    }

    // Show all detected gestures
    if (gesture !== null && gesture !== undefined) {
      gestureText.textContent = `Gesture ${gesture}`;

      // Only execute actions for gestures 14, 17, 19, 20, 21, 23, 26, and 30
      if (gesture == 1 || gesture == 3 || gesture == 4 || gesture == 6 || gesture == 7 || gesture === 14 || gesture === 17 || gesture === 19 || gesture === 20 || gesture === 21 || gesture === 23 || gesture === 26 || gesture === 30 || gesture === 15 || gesture === 16) {
        // Get the action for this gesture
        const actionInfo = GESTURE_ACTIONS[gesture];
        const currentAction = actionInfo ? actionInfo.action : null;

        // Check if this is a new gesture detection (different from last detected gesture in frame)
        const isNewGestureDetection = gesture !== lastGesture;

        if (currentAction && isNewGestureDetection) {
          // Check if enough time has passed since last action (cooldown)
          const now = Date.now();
          const timeSinceLastAction = now - lastActionTimestamp;
          const cooldownPassed = timeSinceLastAction >= ACTION_COOLDOWN_MS;

          // Check if this is a different action than the last executed one
          const isDifferentAction = currentAction !== lastExecutedAction;

          // Check if this is the same gesture as the last executed one
          const isSameGesture = gesture === lastExecutedGesture;

          // Execute action only if:
          // 1. It's a completely different action (different gesture/action), OR
          // 2. It's the same action but enough time has passed (cooldown)
          // This ensures the same action can't execute twice within the cooldown period
          // Note: We check same action (not just same gesture) to handle cases where
          // different gestures might map to the same action
          const isSameAction = currentAction === lastExecutedAction;
          const shouldExecute = isDifferentAction || (cooldownPassed && isSameAction);

          if (shouldExecute) {
            lastExecutedGesture = gesture;
            lastExecutedAction = currentAction;
            lastActionTimestamp = now;
            await executeGestureAction(gesture);
          }
        }

        // Update lastGesture for frame comparison
        lastGesture = gesture;
        // If same gesture in consecutive frames, do nothing (counts as one action)
      } else {
        // No gesture detected - this creates a gap
        lastGesture = null;
      }

      // Update previous frame gesture for next iteration
      previousFrameGesture = gesture;
    } else {
      gestureText.textContent = 'No gesture detected';
      lastGesture = null;
    }

  }, 200); // Run detection every 200ms (reduced frequency for better performance)
}

// Detect gesture from image using Flask server
async function detectGesture(imageData) {
  try {
    // Convert imageData to base64
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to base64
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

    // Send to Flask server
    const response = await fetch('http://localhost:5001/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      console.error('Server error:', result.error);
      return null;
    }

    // Return gesture, bounding box, and confidence
    return {
      gesture: result.gesture || null,
      bbox: result.bbox || null,
      confidence: result.confidence || 0
    };

  } catch (error) {
    console.error('Error detecting gesture:', error);
    // Don't show error for connection issues (server might not be running)
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      console.log('Flask server not available. Make sure server.py is running.');
    }
    return null;
  }
}

// Draw detection overlay (bounding box and gesture label) on canvas
function drawDetectionOverlay(ctx, bbox, gesture, confidence) {
  // Get gesture name
  const gestureInfo = GESTURE_ACTIONS[gesture];
  const gestureName = gestureInfo ? gestureInfo.name : `Gesture ${gesture}`;

  // Bounding box coordinates are already in canvas coordinate space
  // since we send the canvas image to the server
  const x1 = bbox.x1;
  const y1 = bbox.y1;
  const x2 = bbox.x2;
  const y2 = bbox.y2;

  // Box style - green outline for hand
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  // Draw rectangle (hand outline)
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  // Draw label background
  const labelText = `${gestureName} (${Math.round(confidence * 100)}%)`;
  ctx.font = 'bold 18px Arial';
  ctx.textBaseline = 'top';

  // Measure text for background
  const textMetrics = ctx.measureText(labelText);
  const textWidth = textMetrics.width;
  const textHeight = 24;
  const padding = 8;

  // Label position (above the bounding box)
  const labelX = x1;
  const labelY = Math.max(0, y1 - textHeight - padding * 2);

  // Draw label background with rounded corners
  const labelBgX = labelX;
  const labelBgY = labelY;
  const labelBgWidth = textWidth + padding * 2;
  const labelBgHeight = textHeight + padding * 2;

  // Helper function to draw rounded rectangle
  const drawRoundedRect = (x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Draw rounded rectangle for label background
  ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
  drawRoundedRect(labelBgX, labelBgY, labelBgWidth, labelBgHeight, 4);
  ctx.fill();

  // Draw border for label
  ctx.strokeStyle = '#00cc00';
  ctx.lineWidth = 2;
  drawRoundedRect(labelBgX, labelBgY, labelBgWidth, labelBgHeight, 4);
  ctx.stroke();

  // Draw label text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(labelText, labelX + padding, labelY + padding);
}

// Unused ONNX functions removed - using Flask server instead

// Execute action based on gesture
async function executeGestureAction(gesture) {
  const action = GESTURE_ACTIONS[gesture];
  if (!action) {
    actionText.textContent = `Unknown gesture: ${gesture}`;
    return;
  }

  try {
    actionText.textContent = `Executing: ${action.name}...`;

    switch (action.action) {
      case 'mute_all_tabs':
        const allTabs = await chrome.tabs.query({});
        const mutePromises = allTabs.map(tab =>
          chrome.tabs.update(tab.id, { muted: true })
        );
        await Promise.all(mutePromises);
        actionText.textContent = `✅ Muted ${allTabs.length} tab(s)`;
        break;

      case 'unmute_all_tabs':
        const allTabsUnmute = await chrome.tabs.query({});
        const unmutePromises = allTabsUnmute.map(tab =>
          chrome.tabs.update(tab.id, { muted: false })
        );
        await Promise.all(unmutePromises);
        actionText.textContent = `✅ Unmuted ${allTabsUnmute.length} tab(s)`;
        break;

      case 'open_window':
        await chrome.windows.create({});
        actionText.textContent = '✅ Opened new window';
        break;

      case 'close_window':
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow) {
          await chrome.windows.remove(currentWindow.id);
          actionText.textContent = '✅ Closed current window';
        } else {
          actionText.textContent = '⚠️ No window to close';
        }
        break;

      case 'force_quit_chrome':
        // Close all Chrome windows (effectively quits Chrome)
        const allWindows = await chrome.windows.getAll();
        const closePromises = allWindows.map(window =>
          chrome.windows.remove(window.id)
        );
        await Promise.all(closePromises);
        actionText.textContent = `✅ Closed ${allWindows.length} window(s) - Chrome will quit`;
        break;

      case 'open_claude':
        await chrome.tabs.create({ url: 'https://claude.ai' });
        actionText.textContent = '✅ Opened Claude.ai';
        break;

      case 'close_tab':
        // Get all tabs and find the active non-extension tab
        const allTabsForClose = await chrome.tabs.query({});
        // Filter out extension pages and find active tab in a normal window
        const browserTabs = allTabsForClose.filter(tab =>
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('chrome://') &&
          tab.active === true
        );

        if (browserTabs.length > 0) {
          const tabToClose = browserTabs[0];
          if (!tabToClose.pinned) {
            await chrome.tabs.remove(tabToClose.id);
            actionText.textContent = '✅ Closed current tab';
          } else {
            actionText.textContent = '⚠️ Cannot close pinned tab';
          }
        } else {
          actionText.textContent = '⚠️ No browser tab to close';
        }
        break;

      case 'open_gemini':
        await chrome.tabs.create({ url: 'https://gemini.google.com' });
        actionText.textContent = '✅ Opened Gemini.google.com';
        break;

      case 'open_chatgpt':
        await chrome.tabs.create({ url: 'https://chatgpt.com' });
        actionText.textContent = '✅ Opened ChatGPT.com';
        break;

      case 'open_youtube':
        await chrome.tabs.create({ url: 'https://youtube.com' });
        actionText.textContent = '✅ Opened YouTube.com';
        break;

      case 'open_spotify':
        await chrome.tabs.create({ url: 'https://spotify.com' });
        actionText.textContent = '✅ Opened Spotify.com';
        break;

      case 'open_instagram':
        await chrome.tabs.create({ url: 'https://instagram.com' });
        actionText.textContent = '✅ Opened Instagram.com';
        break;

      case 'open_timer':
        await chrome.tabs.create({ url: 'https://vclock.com/timer/' });
        actionText.textContent = '✅ Opened Timer';
        break;

      case 'open_yc':
        await chrome.tabs.create({ url: 'https://ycombinator.com' });
        actionText.textContent = '✅ Opened Ycombinator.com';
        break;

      case 'eye_click':
        // Get eye gaze position and click at that location
        actionText.textContent = '👁️ Detecting gaze for click...';
        const gazePosition = await getEyeGazePosition();
        if (gazePosition) {
          // Show visual overlay first
          await showGazeOverlay(gazePosition.x, gazePosition.y, true);
          // Small delay to show the overlay
          await new Promise(resolve => setTimeout(resolve, 300));
          await clickAtPosition(gazePosition.x, gazePosition.y);
          actionText.textContent = `✅ Clicked at (${Math.round(gazePosition.x)}, ${Math.round(gazePosition.y)})`;
        } else {
          actionText.textContent = '⚠️ Could not determine gaze position';
        }
        break;

      case 'eye_track_continuous':
        // Toggle continuous eye tracking mode
        if (!isEyeTrackingActive) {
          isEyeTrackingActive = true;
          startContinuousEyeTracking();
          actionText.textContent = '👁️ Eye tracking active - showing gaze position';
        } else {
          isEyeTrackingActive = false;
          stopContinuousEyeTracking();
          actionText.textContent = '👁️ Eye tracking stopped';
        }
        break;


      default:
        actionText.textContent = `Unknown action: ${action.action}`;
    }

    // Don't reset lastGesture here - let the cooldown handle it
    // This prevents the same gesture from triggering again immediately

  } catch (error) {
    console.error('Error executing action:', error);
    actionText.textContent = `❌ Error: ${error.message}`;
    showError(`Failed to execute action: ${error.message}`);
  }
}

// Eye tracking functions
let eyeTrackingModel = null;
let isEyeTrackingReady = false;

// Initialize eye tracking (simplified - uses face detection to estimate gaze)
async function initializeEyeTracking() {
  // For now, we'll use a simple approach: detect face position and estimate gaze
  // In production, you'd use MediaPipe Face Mesh or similar for accurate eye tracking
  isEyeTrackingReady = true;
  console.log('Eye tracking initialized (basic mode)');
}

// Get eye gaze position from current camera frame
async function getEyeGazePosition() {
  if (!videoElement || !videoElement.videoWidth) {
    return null;
  }

  try {
    // Get current video frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);

    // Send to Flask server for eye tracking
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    const response = await fetch('http://localhost:5001/eye_track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error || !result.gaze) {
      console.error('Eye tracking error:', result.error);
      return null;
    }

    // result.gaze should contain {x, y} in screen coordinates (0-1 normalized)
    // Convert to actual screen coordinates
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    return {
      x: result.gaze.x * screenWidth,
      y: result.gaze.y * screenHeight
    };

  } catch (error) {
    console.error('Error getting eye gaze:', error);
    return null;
  }
}

// Start continuous eye tracking overlay
async function startContinuousEyeTracking() {
  if (eyeTrackingInterval) return;

  eyeTrackingInterval = setInterval(async () => {
    if (!videoElement || !videoElement.videoWidth || !isEyeTrackingActive) {
      return;
    }

    try {
      // Get gaze position
      const gazePosition = await getEyeGazePosition();
      if (gazePosition) {
        // Update overlay continuously
        await showGazeOverlay(gazePosition.x, gazePosition.y, false);
      }
    } catch (error) {
      console.error('Error in continuous eye tracking:', error);
    }
  }, 150); // Update every 150ms for smooth tracking
}

// Stop continuous eye tracking
function stopContinuousEyeTracking() {
  if (eyeTrackingInterval) {
    clearInterval(eyeTrackingInterval);
    eyeTrackingInterval = null;
  }
  // Remove overlay
  chrome.tabs.query({ active: true }, (tabs) => {
    const browserTab = tabs.find(tab =>
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://')
    );
    if (browserTab) {
      chrome.scripting.executeScript({
        target: { tabId: browserTab.id },
        func: () => {
          const overlay = document.getElementById('gaze-overlay');
          if (overlay) overlay.remove();
        }
      });
    }
  });
}

// Show visual overlay at gaze position
async function showGazeOverlay(x, y, showClickAnimation = false) {
  try {
    // Get the active browser tab (not extension pages)
    const tabs = await chrome.tabs.query({ active: true });
    const browserTab = tabs.find(tab =>
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://')
    );

    if (!browserTab) {
      return;
    }

    // Get window position to calculate relative coordinates
    const windowInfo = await chrome.windows.get(browserTab.windowId);

    // Inject content script to show overlay
    await chrome.scripting.executeScript({
      target: { tabId: browserTab.id },
      func: (screenX, screenY, windowLeft, windowTop, isClickAnimation) => {
        // Update existing overlay if it exists (for smooth continuous tracking)
        const existingOverlay = document.getElementById('gaze-overlay');
        if (existingOverlay && !isClickAnimation) {
          // Update position smoothly for continuous tracking
          existingOverlay.style.left = `${screenX - windowLeft}px`;
          existingOverlay.style.top = `${screenY - windowTop - 80}px`;
          // Update coordinate text
          const coordText = existingOverlay.querySelector('div:last-child');
          if (coordText) {
            coordText.textContent = `${Math.round(screenX - windowLeft)}, ${Math.round(screenY - windowTop - 80)}`;
          }
          return; // Overlay updated, no need to create new one
        }

        // Remove existing overlay if creating new one (for click animation)
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create new overlay

        // Convert screen coordinates to viewport coordinates
        const viewportX = screenX - windowLeft;
        const viewportY = screenY - windowTop - 80; // Approximate browser chrome height

        // Create overlay element
        const overlay = document.createElement('div');
        overlay.id = 'gaze-overlay';
        overlay.style.cssText = `
          position: fixed;
          left: ${viewportX}px;
          top: ${viewportY}px;
          width: 40px;
          height: 40px;
          border: 3px solid #ff0000;
          border-radius: 50%;
          background: rgba(255, 0, 0, 0.2);
          pointer-events: none;
          z-index: 999999;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
          transition: all 0.1s ease-out;
        `;

        // Create crosshair lines
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          transform: translate(-50%, -50%);
          pointer-events: none;
        `;

        // Horizontal line
        const hLine = document.createElement('div');
        hLine.style.cssText = `
          position: absolute;
          left: 0;
          top: 50%;
          width: 100%;
          height: 2px;
          background: #ff0000;
          transform: translateY(-50%);
        `;

        // Vertical line
        const vLine = document.createElement('div');
        vLine.style.cssText = `
          position: absolute;
          left: 50%;
          top: 0;
          width: 2px;
          height: 100%;
          background: #ff0000;
          transform: translateX(-50%);
        `;

        crosshair.appendChild(hLine);
        crosshair.appendChild(vLine);
        overlay.appendChild(crosshair);

        // Create coordinate text
        const coordText = document.createElement('div');
        coordText.textContent = `${Math.round(viewportX)}, ${Math.round(viewportY)}`;
        coordText.style.cssText = `
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          white-space: nowrap;
          pointer-events: none;
        `;
        overlay.appendChild(coordText);

        document.body.appendChild(overlay);

        // If it's a click animation, remove after showing
        if (showClickAnimation) {
          // Add click animation
          setTimeout(() => {
            overlay.style.borderColor = '#00ff00';
            overlay.style.background = 'rgba(0, 255, 0, 0.3)';
            overlay.style.transform = 'translate(-50%, -50%) scale(1.5)';
          }, 200);

          // Remove overlay after animation
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.style.opacity = '0';
              overlay.style.transform = 'translate(-50%, -50%) scale(0.5)';
              setTimeout(() => {
                overlay.remove();
              }, 200);
            }
          }, 1000);
        } else {
          // For continuous tracking, overlay will be updated/replaced on next call
          // Keep it visible but mark it for potential removal if tracking stops
          overlay.setAttribute('data-tracking', 'true');
        }
      },
      args: [x, y, windowInfo.left, windowInfo.top, showClickAnimation]
    });

  } catch (error) {
    console.error('Error showing gaze overlay:', error);
  }
}

// Click at a specific screen position
async function clickAtPosition(x, y) {
  try {
    // Get the active browser tab (not extension pages)
    const tabs = await chrome.tabs.query({ active: true });
    const browserTab = tabs.find(tab =>
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://')
    );

    if (!browserTab) {
      throw new Error('No active browser tab found');
    }

    // Get window position to calculate relative coordinates
    const windowInfo = await chrome.windows.get(browserTab.windowId);

    // Inject content script to click at the position
    await chrome.scripting.executeScript({
      target: { tabId: browserTab.id },
      func: (screenX, screenY, windowLeft, windowTop) => {
        // Convert screen coordinates to viewport coordinates
        // Account for window position and browser chrome (address bar, etc.)
        const viewportX = screenX - windowLeft;
        const viewportY = screenY - windowTop - 80; // Approximate browser chrome height

        // Find element at that position
        const element = document.elementFromPoint(viewportX, viewportY);
        if (element) {
          // Use click() method for better compatibility
          element.click();
        }
      },
      args: [x, y, windowInfo.left, windowInfo.top]
    });

  } catch (error) {
    console.error('Error clicking at position:', error);
    throw error;
  }
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Event listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Clean up on window close
window.addEventListener('beforeunload', () => {
  stopCamera();
});
