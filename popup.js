// Get DOM elements
const openCameraBtn = document.getElementById('openCameraBtn');
const openAssistantBtn = document.getElementById('openAssistantBtn');

// Open camera window
openCameraBtn.addEventListener('click', async () => {
  try {
    // Get the extension's URL
    const url = chrome.runtime.getURL('camera.html');
    
    // Create a new window
    const window = await chrome.windows.create({
      url: url,
      type: 'popup',
      width: 900,
      height: 700,
      focused: true
    });
    
    console.log('Camera window opened:', window.id);
  } catch (error) {
    console.error('Error opening camera window:', error);
    alert('Error opening camera window. Please try again.');
  }
});

// Open voice assistant window
openAssistantBtn.addEventListener('click', async () => {
  try {
    // Get the extension's URL
    const url = chrome.runtime.getURL('assistant.html');
    
    // Create a new window
    const window = await chrome.windows.create({
      url: url,
      type: 'popup',
      width: 900,
      height: 800,
      focused: true
    });
    
    console.log('Assistant window opened:', window.id);
  } catch (error) {
    console.error('Error opening assistant window:', error);
    alert('Error opening assistant window. Please try again.');
  }
});
