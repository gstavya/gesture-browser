// Get DOM elements
const videoElement = document.getElementById('videoElement');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const errorMessage = document.getElementById('errorMessage');
let stream = null;

// Check if we can access media devices
function checkMediaDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  return true;
}

// Start camera function
async function startCamera() {
  // Check if media devices are available
  if (!checkMediaDevices()) {
    errorMessage.innerHTML = 'Your browser does not support camera access.';
    errorMessage.classList.remove('hidden');
    return;
  }

  try {
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    // Set the video source
    videoElement.srcObject = stream;
    
    // Show/hide buttons
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    
  } catch (error) {
    console.error('Error accessing camera:', error);
    let errorText = 'Could not access camera';
    let instructions = '';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorText = 'Camera permission denied.';
      instructions = `
        <div style="margin-top: 10px; font-size: 12px; line-height: 1.5;">
          <strong>To allow camera access:</strong><br>
          1. Look for a camera icon in Chrome's address bar<br>
          2. Click it and select "Allow"<br>
          3. Or go to: chrome://settings/content/camera<br>
          4. Make sure "Ask before accessing" is enabled<br>
          5. Refresh this page and click "Start Camera" again
        </div>
      `;
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorText = 'No camera found. Please connect a camera and try again.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorText = 'Camera is already in use by another application.';
    } else if (error.message) {
      errorText = `Error: ${error.message}`;
    }
    
    errorMessage.innerHTML = errorText + instructions;
    errorMessage.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

// Stop camera function
function stopCamera() {
  if (stream) {
    // Stop all tracks
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    
    // Clear video source
    videoElement.srcObject = null;
    
    // Show/hide buttons
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    errorMessage.classList.add('hidden');
  }
}

// Event listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Clean up when window closes
window.addEventListener('beforeunload', () => {
  stopCamera();
});

// Auto-start camera when window opens
startCamera();





