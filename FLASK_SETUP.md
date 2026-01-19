# Flask Server Setup for Gesture Detection

The extension now uses a Flask backend for fast gesture detection using native Python/YOLO.

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Flask Server

```bash
python3 server.py
```

The server will start on `http://localhost:5000`

### 3. Load the Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

### 4. Use the Extension

1. Click the extension icon
2. Click "Gesture Assistant"
3. Click "Start Camera"
4. The extension will connect to the Flask server automatically

## How It Works

- **Browser**: Captures camera frames and sends them to Flask server as base64-encoded images
- **Flask Server**: Runs YOLO model inference and returns gesture detections (19 or 21)
- **Browser**: Executes actions (open/close tab) based on detected gestures

## Performance

- **Much faster** than browser-based ONNX inference
- Uses native PyTorch with GPU acceleration (if available)
- Real-time gesture detection

## Troubleshooting

- **"Server not available"**: Make sure `server.py` is running on port 5000
- **CORS errors**: Flask-CORS is already configured, but check browser console
- **Slow detection**: Check if GPU is being used (PyTorch will use CUDA if available)

