from ultralytics import YOLO

# Load the PyTorch model
model = YOLO('YOLOv10x_gestures.pt')

# Export to ONNX with opset 11 for compatibility with ONNX Runtime Web
# ONNX Runtime Web supports opset 11 well, which is more compatible than newer versions
model.export(format='onnx', imgsz=640, opset=11)