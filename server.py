from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
app = Flask(__name__)
# Allow cross-origin requests from Chrome extension
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Load YOLO model once at startup
print("Loading YOLO model...")
model = YOLO("YOLOv10x_gestures.pt")
print("Model loaded successfully!")

# Initialize OpenCV cascades for improved eye tracking
print("Initializing OpenCV face and eye detectors...")
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
print("Eye tracking ready!")

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_gesture():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    try:
        # Get image data from request
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Convert to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Run YOLO inference
        results = model(img, verbose=False)
        
        # Extract detections
        detections = results[0]
        gesture = None
        max_confidence = 0
        
        # Find highest confidence detection (any gesture, not just 19 and 21)
        best_box = None
        for box in detections.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            
            # Consider any gesture with confidence > 0.5
            if confidence > 0.85 and confidence > max_confidence:
                max_confidence = confidence
                gesture = class_id
                best_box = box
        
        # Prepare bounding box information if gesture detected
        bbox = None
        if best_box is not None:
            # Get bounding box coordinates (x1, y1, x2, y2)
            xyxy = best_box.xyxy[0].cpu().numpy()
            bbox = {
                'x1': float(xyxy[0]),
                'y1': float(xyxy[1]),
                'x2': float(xyxy[2]),
                'y2': float(xyxy[3])
            }
        
        return jsonify({
            'gesture': gesture,
            'confidence': max_confidence if gesture else 0,
            'bbox': bbox
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/eye_track', methods=['POST', 'OPTIONS'])
def eye_track():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    try:
        # Get image data from request
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Convert to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return jsonify({'error': 'No face detected'}), 400
        
        # Get the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w_face, h_face = face
        
        # Extract face ROI for eye detection
        roi_gray = gray[y:y+h_face, x:x+w_face]
        roi_color = img[y:y+h_face, x:x+w_face]
        eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 3)
        
        gaze_offset_x = 0.0
        gaze_offset_y = 0.0
        
        if len(eyes) >= 2:
            # Sort eyes by X position (left eye first)
            eyes_sorted = sorted(eyes, key=lambda e: e[0])
            left_eye = eyes_sorted[0]
            right_eye = eyes_sorted[1]
            
            # Process each eye to find iris/pupil position
            eye_gaze_offsets = []
            
            for eye_idx, (ex, ey, ew, eh) in enumerate([left_eye, right_eye]):
                # Extract eye region
                eye_roi = roi_gray[ey:ey+eh, ex:ex+ew]
                
                if eye_roi.size == 0:
                    continue
                
                # Apply Gaussian blur to reduce noise
                eye_roi_blur = cv2.GaussianBlur(eye_roi, (5, 5), 0)
                
                # Use adaptive threshold to find dark regions (pupil/iris)
                # Try multiple methods to find the darkest region
                _, thresh = cv2.threshold(eye_roi_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
                # Find contours (potential pupil)
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    # Find the largest dark region (likely the pupil)
                    largest_contour = max(contours, key=cv2.contourArea)
                    if cv2.contourArea(largest_contour) > 10:  # Minimum area threshold
                        # Get center of the contour
                        M = cv2.moments(largest_contour)
                        if M["m00"] != 0:
                            cx = int(M["m10"] / M["m00"])
                            cy = int(M["m01"] / M["m00"])
                            
                            # Calculate offset from eye center (normalized to -1 to 1)
                            eye_center_x = ew / 2
                            eye_center_y = eh / 2
                            
                            # Normalize offset
                            eye_offset_x = (cx - eye_center_x) / (ew / 2)
                            eye_offset_y = (cy - eye_center_y) / (eh / 2)
                            
                            eye_gaze_offsets.append((eye_offset_x, eye_offset_y))
            
            # Average gaze offsets from both eyes
            if eye_gaze_offsets:
                avg_gaze_x = sum(g[0] for g in eye_gaze_offsets) / len(eye_gaze_offsets)
                avg_gaze_y = sum(g[1] for g in eye_gaze_offsets) / len(eye_gaze_offsets)
                gaze_offset_x = avg_gaze_x
                gaze_offset_y = avg_gaze_y
        
        # Also calculate head position offset (for combined head + gaze tracking)
        eye_center_x = x + w_face / 2
        eye_center_y = y + h_face / 3  # Eyes are typically at 1/3 from top
        
        frame_center_x = w / 2
        frame_center_y = h / 2
        
        # Head position offset (normalized)
        head_offset_x = (eye_center_x - frame_center_x) / (w / 2)
        head_offset_y = (eye_center_y - frame_center_y) / (h / 2)
        
        # Combine head movement (70%) with eye gaze (30%) for better accuracy
        # Invert X direction for head offset
        combined_offset_x = -head_offset_x * 0.7 + gaze_offset_x * 0.3
        combined_offset_y = head_offset_y * 0.7 + gaze_offset_y * 0.3
        
        # Map to screen coordinates with 5x scaling
        screen_x = 0.5 + combined_offset_x * 2.5
        screen_y = 0.5 + combined_offset_y * 2.5
        
        # Clamp to valid range (0.0 to 1.0)
        screen_x = max(0.0, min(1.0, screen_x))
        screen_y = max(0.0, min(1.0, screen_y))
        
        return jsonify({
            'gaze': {
                'x': screen_x,
                'y': screen_y
            }
        })
        
    except Exception as e:
        print(f"Eye tracking error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'loaded'})

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5001")
    print("Make sure to allow CORS for Chrome extension")
    app.run(host='0.0.0.0', port=5001, debug=True)

