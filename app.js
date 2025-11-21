// Constants
const LUMBER_VOLUME_CM3 = 2000;

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1; // Will be updated by calibration
let calibrationMode = false;
let calibrationPoints = [];

// DOM Elements
const videoInput = document.getElementById('videoInput');
const canvasOutput = document.getElementById('canvasOutput');
const startBtn = document.getElementById('startBtn');
const processBtn = document.getElementById('processBtn');
const stopBtn = document.getElementById('stopBtn');
const cameraSelect = document.getElementById('cameraSelect');
const refWidthInput = document.getElementById('refWidth');
const calibrateBtn = document.getElementById('calibrateBtn');
const calibrationStatus = document.getElementById('calibrationStatus');

const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const lumberResult = document.getElementById('lumberResult');

// Check when OpenCV.js is loaded
function onOpenCvReady() {
    openCvReady = true;
    console.log('OpenCV.js is ready!');
    startBtn.disabled = false;
    getCameras();
}

// Get available cameras
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '<option value="environment">Back Camera (Auto)</option>';
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            
            // Try to identify back camera
            if (device.label && device.label.toLowerCase().includes('back')) {
                cameraSelect.appendChild(option);
            } else {
                cameraSelect.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Error getting cameras:', err);
    }
}

// Start camera function with back camera preference
startBtn.addEventListener('click', async () => {
    try {
        if (!openCvReady) {
            alert('Please wait for OpenCV to load...');
            return;
        }
        
        // Stop current stream if any
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const selectedCamera = cameraSelect.value;
        let constraints = {
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
            } 
        };
        
        // Camera selection logic
        if (selectedCamera === 'environment') {
            constraints.video.facingMode = { ideal: 'environment' }; // Back camera
        } else if (selectedCamera) {
            constraints.video.deviceId = { exact: selectedCamera };
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        videoInput.srcObject = stream;
        processBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.disabled = true;
        
        console.log("Camera started successfully!");
        
    } catch (err) {
        console.error("Error accessing camera:", err);
        
        // Fallback: try without specific constraints
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoInput.srcObject = stream;
            processBtn.disabled = false;
            stopBtn.disabled = false;
            startBtn.disabled = true;
            console.log("Camera started with fallback!");
        } catch (fallbackErr) {
            alert("Cannot access camera. Please check permissions and try again.");
        }
    }
});

// Calibration function
calibrateBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    calibrationMode = true;
    calibrationPoints = [];
    calibrationStatus.textContent = "Click two points on a known object...";
    calibrationStatus.style.color = "#e74c3c";
});

// Click event for calibration
canvasOutput.addEventListener('click', (event) => {
    if (!calibrationMode) return;
    
    const rect = canvasOutput.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    calibrationPoints.push({x, y});
    
    if (calibrationPoints.length === 2) {
        // Calculate pixel distance between two points
        const pixelDistance = Math.sqrt(
            Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
            Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
        );
        
        const refWidthCm = parseFloat(refWidthInput.value);
        
        if (refWidthCm > 0 && pixelDistance > 0) {
            PIXEL_TO_CM = refWidthCm / pixelDistance;
            calibrationMode = false;
            
            calibrationStatus.textContent = `Calibrated! 1 pixel = ${PIXEL_TO_CM.toFixed(4)} cm`;
            calibrationStatus.style.color = "#27ae60";
            
            alert(`Calibration complete!\n1 pixel = ${PIXEL_TO_CM.toFixed(4)} cm\nReference: ${refWidthCm} cm = ${pixelDistance.toFixed(1)} pixels`);
        } else {
            alert("Invalid measurement. Please try again.");
        }
        
        calibrationPoints = [];
    }
});

// Process frame function
processBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    processFrame();
});

function processFrame() {
    const ctx = canvasOutput.getContext('2d');
    canvasOutput.width = videoInput.videoWidth;
    canvasOutput.height = videoInput.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
    
    // Process with OpenCV
    processWithOpenCV();
}

function processWithOpenCV() {
    try {
        let src = cv.imread(canvasOutput);
        let hsv = new cv.Mat();
        let mask = new cv.Mat();
        
        // Convert to HSV
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
        
        // IMPROVED BROWN COLOR DETECTION - Multiple ranges for better accuracy
        let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 30, 20, 0]);
        let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 200, 180, 255]);
        let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 30, 20, 0]);
        let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 200, 180, 255]);
        
        let mask1 = new cv.Mat();
        let mask2 = new cv.Mat();
        
        cv.inRange(hsv, low_brown1, high_brown1, mask1);
        cv.inRange(hsv, low_brown2, high_brown2, mask2);
        cv.bitwise_or(mask1, mask2, mask);
        
        // Better morphological operations
        let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
        
        kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        if (contours.size() > 0) {
            let maxArea = 0;
            let maxContourIndex = -1;
            
            // Find largest contour with minimum area filter
            for (let i = 0; i < contours.size(); i++) {
                let area = cv.contourArea(contours.get(i));
                // Only consider contours larger than 1000 pixels (reduces noise)
                if (area > 1000 && area > maxArea) {
                    maxArea = area;
                    maxContourIndex = i;
                }
            }
            
            if (maxContourIndex !== -1) {
                let trunk = contours.get(maxContourIndex);
                let rect = cv.boundingRect(trunk);
                
                // Calculate measurements
                let diameter_cm = rect.width * PIXEL_TO_CM;
                let height_cm = rect.height * PIXEL_TO_CM;
                
                // Calculate volume and lumber pieces (assuming cylindrical trunk)
                let radius_cm = diameter_cm / 2;
                let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm;
                let num_lumber = volume_cm3 / LUMBER_VOLUME_CM3;
                
                // Update results display
                diameterResult.textContent = `Diameter: ${diameter_cm.toFixed(1)} cm`;
                heightResult.textContent = `Height: ${height_cm.toFixed(1)} cm`;
                lumberResult.textContent = `Lumber Estimate: ${Math.max(0, num_lumber).toFixed(1)} pieces`;
                
                console.log(`Detected: ${diameter_cm.toFixed(1)}cm diameter, ${num_lumber.toFixed(1)} lumber pieces`);
            } else {
                showNoDetection();
            }
        } else {
            showNoDetection();
        }
        
        // Clean up memory
        src.delete(); hsv.delete(); mask.delete(); mask1.delete(); mask2.delete();
        contours.delete(); hierarchy.delete();
        low_brown1.delete(); high_brown1.delete(); low_brown2.delete(); high_brown2.delete();
        
    } catch (err) {
        console.error('Error in OpenCV processing:', err);
        showNoDetection();
    }
}

function showNoDetection() {
    diameterResult.textContent = "Diameter: No tree detected";
    heightResult.textContent = "Height: -- cm";
    lumberResult.textContent = "Lumber Estimate: -- pieces";
}

// Stop camera function
stopBtn.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoInput.srcObject = null;
        stream = null;
        
        processBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.disabled = false;
        
        console.log("Camera stopped");
    }
});

// Initialize button states
processBtn.disabled = true;
stopBtn.disabled = true;

// Add some tips
console.log("Tree Lumber Estimator Web App Loaded!");
console.log("Tips for better accuracy:");
console.log("- Use good lighting conditions");
console.log("- Place a known object for calibration");
console.log("- Ensure tree trunk has clear contrast with background");
console.log("- Use back camera for consistent results");