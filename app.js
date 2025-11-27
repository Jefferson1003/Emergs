// Enhanced Constants
const LUMBER_VOLUME_CM3 = 2000;
const WOOD_DENSITY_G_CM3 = 0.6;
const MIN_CONTOUR_AREA = 3000; // Increased minimum area to reduce noise
const DETECTION_INTERVAL = 300; // Faster detection for better real-time

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1;
let calibrationMode = false;
let calibrationPoints = [];
let realTimeDetection = false;
let detectionInterval = null;
let lastDetectionTime = 0;

// DOM Elements
const videoInput = document.getElementById('videoInput');
const canvasOutput = document.getElementById('canvasOutput');
const startBtn = document.getElementById('startBtn');
const toggleDetectBtn = document.getElementById('toggleDetectBtn');
const stopBtn = document.getElementById('stopBtn');
const cameraSelect = document.getElementById('cameraSelect');
const refWidthInput = document.getElementById('refWidth');
const calibrateBtn = document.getElementById('calibrateBtn');
const calibrationStatus = document.getElementById('calibrationStatus');
const detectionOverlay = document.getElementById('detectionOverlay');
const detectionInfo = document.getElementById('detectionInfo');

const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const volumeResult = document.getElementById('volumeResult');
const weightResult = document.getElementById('weightResult');
const lumberResult = document.getElementById('lumberResult');
const statusElement = document.getElementById('status');

// Enhanced OpenCV.js loading
function onOpenCvReady() {
    openCvReady = true;
    console.log('OpenCV.js is ready!');
    startBtn.disabled = false;
    statusElement.textContent = "Status: OpenCV loaded - Ready to start camera";
    getCameras();
}

// Get available cameras with better device detection
async function getCameras() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            throw new Error('Camera API not supported');
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '';
        
        if (videoDevices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.text = 'No cameras found';
            cameraSelect.appendChild(option);
            startBtn.disabled = true;
            return;
        }
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            // Enhanced camera identification
            const label = device.label.toLowerCase();
            if (label.includes('back') || label.includes('rear') || 
                (videoDevices.length > 1 && index === videoDevices.length - 1)) {
                option.text = 'Back Camera';
            } else if (label.includes('front') || label.includes('user')) {
                option.text = 'Front Camera';
            } else {
                option.text = `Camera ${index + 1}`;
            }
            
            cameraSelect.appendChild(option);
        });
        
        console.log(`Found ${videoDevices.length} camera(s)`);
    } catch (err) {
        console.error('Error getting cameras:', err);
        statusElement.textContent = "Status: Error accessing cameras";
    }
}

// Enhanced camera startup
startBtn.addEventListener('click', async () => {
    try {
        if (!openCvReady) {
            alert('Please wait for OpenCV to load completely...');
            return;
        }
        
        // Stop existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const selectedCamera = cameraSelect.value;
        const constraints = {
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                facingMode: selectedCamera === 'user' ? 'user' : 'environment'
            } 
        };
        
        // Add specific device ID if available
        if (selectedCamera && selectedCamera !== 'user' && selectedCamera !== 'environment') {
            constraints.video.deviceId = { exact: selectedCamera };
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoInput.srcObject = stream;
        
        // Wait for video to be ready
        videoInput.onloadedmetadata = () => {
            canvasOutput.width = videoInput.videoWidth;
            canvasOutput.height = videoInput.videoHeight;
            
            toggleDetectBtn.disabled = false;
            stopBtn.disabled = false;
            startBtn.disabled = true;
            statusElement.textContent = "Status: Camera ready - Click Start Real-time";
            
            console.log(`Camera started: ${videoInput.videoWidth}x${videoInput.videoHeight}`);
        };
        
    } catch (err) {
        console.error("Error accessing camera:", err);
        let errorMessage = "Cannot access camera. ";
        
        if (err.name === 'NotAllowedError') {
            errorMessage += "Please check camera permissions.";
        } else if (err.name === 'NotFoundError') {
            errorMessage += "No camera found.";
        } else if (err.name === 'NotSupportedError') {
            errorMessage += "Camera not supported.";
        } else {
            errorMessage += "Please try again.";
        }
        
        alert(errorMessage);
        statusElement.textContent = "Status: Camera error - " + errorMessage;
    }
});

// Enhanced real-time detection toggle
toggleDetectBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    if (!realTimeDetection) {
        // Start real-time detection
        realTimeDetection = true;
        toggleDetectBtn.textContent = "🔴 Stop Real-time";
        toggleDetectBtn.classList.add('active');
        statusElement.textContent = "Status: Real-time detection ACTIVE";
        
        // Process frames at optimal interval
        detectionInterval = setInterval(processFrame, DETECTION_INTERVAL);
        
        console.log("Enhanced real-time detection started");
    } else {
        // Stop real-time detection
        realTimeDetection = false;
        toggleDetectBtn.textContent = "🟢 Start Real-time";
        toggleDetectBtn.classList.remove('active');
        statusElement.textContent = "Status: Real-time detection PAUSED";
        detectionOverlay.classList.remove('overlay-active');
        
        clearInterval(detectionInterval);
        console.log("Real-time detection stopped");
    }
});

// Enhanced calibration
calibrateBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    const refWidth = parseFloat(refWidthInput.value);
    if (!refWidth || refWidth <= 0) {
        alert("Please enter a valid reference width in centimeters.");
        return;
    }
    
    calibrationMode = true;
    calibrationPoints = [];
    calibrationStatus.textContent = "Click two points on a known object to measure...";
    calibrationStatus.style.color = "#e74c3c";
    
    console.log("Calibration mode activated");
});

// Enhanced click event for calibration
canvasOutput.addEventListener('click', (event) => {
    if (!calibrationMode) return;
    
    const rect = canvasOutput.getBoundingClientRect();
    const scaleX = canvasOutput.width / rect.width;
    const scaleY = canvasOutput.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    calibrationPoints.push({x, y});
    
    // Draw calibration point
    const ctx = canvasOutput.getContext('2d');
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = calibrationPoints.length === 1 ? '#3498db' : '#e74c3c';
    ctx.fill();
    
    if (calibrationPoints.length === 2) {
        const pixelDistance = Math.sqrt(
            Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
            Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
        );
        
        const refWidthCm = parseFloat(refWidthInput.value);
        
        if (refWidthCm > 0 && pixelDistance > 0) {
            PIXEL_TO_CM = refWidthCm / pixelDistance;
            calibrationMode = false;
            
            calibrationStatus.textContent = `✅ Calibrated! 1 pixel = ${PIXEL_TO_CM.toFixed(4)} cm`;
            calibrationStatus.style.color = "#27ae60";
            
            console.log(`Calibration successful: ${refWidthCm}cm = ${pixelDistance.toFixed(1)}px = ${PIXEL_TO_CM.toFixed(4)}cm/px`);
            
            // Clear canvas and redraw
            setTimeout(() => processFrame(), 100);
        } else {
            calibrationStatus.textContent = "❌ Calibration failed - Please try again";
            calibrationStatus.style.color = "#e74c3c";
        }
        
        calibrationPoints = [];
    }
});

// Enhanced frame processing
function processFrame() {
    if (!stream || videoInput.videoWidth === 0) return;
    
    const ctx = canvasOutput.getContext('2d');
    canvasOutput.width = videoInput.videoWidth;
    canvasOutput.height = videoInput.videoHeight;
    
    ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
    enhancedProcessWithOpenCV();
}

// MAJOR ENHANCEMENT: Better tree detection algorithm
function enhancedProcessWithOpenCV() {
    try {
        let src = cv.imread(canvasOutput);
        let hsv = new cv.Mat();
        let mask = new cv.Mat();
        
        // Convert to HSV for better color segmentation
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
        
        // ENHANCED COLOR RANGES FOR TREE DETECTION
        // Brown ranges for tree trunks
        let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 30, 20, 0]);
        let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 200, 180, 255]);
        
        let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 30, 20, 0]);
        let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 200, 180, 255]);
        
        // Green ranges for leaves (optional)
        let low_green = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
        let high_green = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 255]);
        
        let mask1 = new cv.Mat();
        let mask2 = new cv.Mat();
        let mask_green = new cv.Mat();
        
        cv.inRange(hsv, low_brown1, high_brown1, mask1);
        cv.inRange(hsv, low_brown2, high_brown2, mask2);
        cv.inRange(hsv, low_green, high_green, mask_green);
        
        // Combine brown masks and optionally add green
        cv.bitwise_or(mask1, mask2, mask);
        cv.bitwise_or(mask, mask_green, mask);
        
        // ENHANCED MORPHOLOGICAL OPERATIONS
        let kernel_open = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        let kernel_close = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(15, 15));
        
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel_open);
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel_close);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let detected = false;
        
        if (contours.size() > 0) {
            let maxArea = 0;
            let maxContourIndex = -1;
            let maxContour = null;
            
            // Find largest valid contour
            for (let i = 0; i < contours.size(); i++) {
                let contour = contours.get(i);
                let area = cv.contourArea(contour);
                
                // Additional filtering by aspect ratio and solidity
                let rect = cv.boundingRect(contour);
                let aspectRatio = rect.width / rect.height;
                
                // Tree-like objects typically have reasonable aspect ratios
                if (area > MIN_CONTOUR_AREA && area > maxArea && 
                    aspectRatio > 0.2 && aspectRatio < 5.0) {
                    maxArea = area;
                    maxContourIndex = i;
                    maxContour = contour;
                }
            }
            
            if (maxContourIndex !== -1 && maxContour) {
                detected = true;
                let rect = cv.boundingRect(maxContour);
                
                // ENHANCED MEASUREMENT CALCULATIONS
                let diameter_px = rect.width;
                let height_px = rect.height;
                
                let diameter_cm = diameter_px * PIXEL_TO_CM;
                let height_cm = height_px * PIXEL_TO_CM;
                
                // More accurate volume calculation (truncated cone for trees)
                let radius_cm = diameter_cm / 2;
                let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm * 0.8; // 0.8 factor for tree shape
                
                // Weight calculation
                let weight_kg = (volume_cm3 * WOOD_DENSITY_G_CM3) / 1000;
                
                // Lumber calculation with efficiency factor
                let num_lumber = Math.max(0, (volume_cm3 / LUMBER_VOLUME_CM3) * 0.7); // 70% efficiency
                
                // Update results with enhanced visualization
                updateEnhancedResults(diameter_cm, height_cm, volume_cm3, weight_kg, num_lumber);
                
                // Draw detection overlay
                drawDetectionOverlay(rect, diameter_px, height_px);
                
                detectionInfo.textContent = `Tree detected: ${maxArea.toFixed(0)} pixels`;
                detectionInfo.style.color = "#27ae60";
                
            } else {
                showNoDetection();
                detectionInfo.textContent = "No valid tree detected - adjust camera angle";
                detectionInfo.style.color = "#e74c3c";
            }
        } else {
            showNoDetection();
            detectionInfo.textContent = "No tree contours found";
            detectionInfo.style.color = "#e74c3c";
        }
        
        if (!detected) {
            detectionOverlay.classList.remove('overlay-active');
        }
        
        // Enhanced memory cleanup
        [src, hsv, mask, mask1, mask2, mask_green, contours, hierarchy,
         low_brown1, high_brown1, low_brown2, high_brown2, low_green, high_green,
         kernel_open, kernel_close].forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
        
    } catch (err) {
        console.error('Error in enhanced OpenCV processing:', err);
        showNoDetection();
        detectionInfo.textContent = "Processing error - try restarting";
        detectionInfo.style.color = "#e74c3c";
    }
}

// Enhanced results display
function updateEnhancedResults(diameter, height, volume, weight, lumber) {
    diameterResult.textContent = `${diameter.toFixed(1)} cm`;
    heightResult.textContent = `${height.toFixed(1)} cm`;
    volumeResult.textContent = `${volume.toFixed(0)} cm³`;
    weightResult.textContent = `${weight.toFixed(1)} kg`;
    lumberResult.textContent = `${Math.round(lumber * 10) / 10} pieces`;
    
    // Visual feedback
    const results = [diameterResult, heightResult, volumeResult, weightResult, lumberResult];
    results.forEach(result => {
        result.parentElement.classList.add('detecting');
        setTimeout(() => result.parentElement.classList.remove('detecting'), 1000);
    });
    
    lastDetectionTime = Date.now();
}

// Enhanced detection overlay
function drawDetectionOverlay(rect, diameter_px, height_px) {
    detectionOverlay.classList.add('overlay-active');
    
    const ctx = canvasOutput.getContext('2d');
    
    // Draw bounding box
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    // Draw measurements
    ctx.fillStyle = '#e74c3c';
    ctx.font = '16px Arial';
    ctx.fillText(`D: ${(diameter_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y - 10);
    ctx.fillText(`H: ${(height_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y + rect.height + 25);
}

function showNoDetection() {
    diameterResult.textContent = "-- cm";
    heightResult.textContent = "-- cm";
    volumeResult.textContent = "-- cm³";
    weightResult.textContent = "-- kg";
    lumberResult.textContent = "-- pieces";
    
    detectionOverlay.classList.remove('overlay-active');
}

// Enhanced stop function
stopBtn.addEventListener('click', () => {
    if (stream) {
        // Stop real-time detection first
        if (realTimeDetection) {
            realTimeDetection = false;
            clearInterval(detectionInterval);
            toggleDetectBtn.textContent = "🟢 Start Real-time";
            toggleDetectBtn.classList.remove('active');
        }
        
        stream.getTracks().forEach(track => track.stop());
        videoInput.srcObject = null;
        stream = null;
        
        toggleDetectBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.disabled = false;
        statusElement.textContent = "Status: Camera stopped";
        detectionOverlay.classList.remove('overlay-active');
        
        showNoDetection();
        console.log("Camera stopped successfully");
    }
});

// Initialize application
function initializeApp() {
    toggleDetectBtn.disabled = true;
    stopBtn.disabled = true;
    statusElement.textContent = "Status: Loading OpenCV...";
    
    console.log("Enhanced Tree Lumber Estimator Initialized!");
}

// Start initialization
initializeApp();