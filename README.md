# Gesture Browser Extension

A Chrome extension that allows you to control your browser using hand gestures. The extension uses YOLO v10 for gesture recognition and provides various browser actions triggered by specific gestures.

## Prerequisites

- Python 3.8 or higher
- Google Chrome browser
- Webcam/camera access

## Setup Instructions

### 1. Create a Virtual Environment

First, create a Python virtual environment in the project directory:

```bash
python3 -m venv venv
```

Or on Windows:

```bash
python -m venv venv
```

### 2. Activate the Virtual Environment

On macOS/Linux:
```bash
source venv/bin/activate
```

On Windows:
```bash
venv\Scripts\activate
```

### 3. Install Requirements

Once the virtual environment is activated, install all required dependencies:

```bash
pip install -r requirements.txt
```

### 4. Run the Flask Server

Start the Flask server that handles gesture detection:

```bash
python server.py
```

The server will start on `http://localhost:5001`. Keep this terminal window open and running while using the extension.

### 5. Load the Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right corner)
3. Click "Load unpacked"
4. Select the cloned repository folder (the folder containing `manifest.json`)
5. The extension should now appear in your extensions list

### 6. Using the Extension

1. Click on the extension icon in Chrome's toolbar
2. Click "Start Camera" in the extension popup
3. Grant camera permissions when prompted
4. Show gestures to your camera to trigger browser actions

## Supported Gestures

- **Gesture 3**: Eye Click
- **Gesture 4**: Open YCombinator
- **Gesture 6**: Open Timer
- **Gesture 14**: Close Current Tab
- **Gesture 15**: Open YouTube
- **Gesture 16**: Open Instagram
- **Gesture 17**: Mute All Tabs
- **Gesture 19**: Open Claude.ai
- **Gesture 20**: Open New Window
- **Gesture 21**: Open ChatGPT
- **Gesture 23**: Unmute All Tabs
- **Gesture 26**: Open Gemini

## Notes

- Make sure the Flask server is running before using the extension
- The extension requires camera permissions to function
- Actions have a 2-second cooldown to prevent accidental double-triggering
- The hand outline and detected gesture will be displayed in the camera view

## Troubleshooting

- **Server connection error**: Make sure `server.py` is running on port 5001
- **Camera not working**: Check that camera permissions are granted in Chrome settings
- **Extension not loading**: Ensure all files are in the same directory and `manifest.json` is present
- **Model not found**: The YOLO model file (`YOLOv10x_gestures.pt`) must be in the project root directory
