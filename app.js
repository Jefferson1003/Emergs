// Enhanced Constants for Mobile
const LUMBER_VOLUME_CM3 = 2000;
const WOOD_DENSITY_G_CM3 = 0.6;
const MIN_CONTOUR_AREA = 2500;
const DETECTION_INTERVAL = 400; // Slower for mobile performance

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1;
let calibrationMode = false;
let calibrationPoints = [];
let realTimeDetection = false;
let detectionInterval = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
const cameraFeedback = document.getElementById('cameraFeedback');
const statusElement = document.getElementById('status');

const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const volumeResult = document.getElementById('volumeResult');
const weightResult = document.getElementById('weightResult');
const lumberResult = document.getElementById('lumberResult');

// Enhanced OpenCV.js loading with mobile support
function onOpenCvReady() {
    openCvReady = true;
    console.log('OpenCV.js loaded successfully!');
    startBtn.disabled = false;
    statusElement.textContent = "Status: Ready - Tap 'Start Camera'";
    
    // Show mobile instructions
    if (isMobile) {
        document.querySelector('.mobile-instructions').style.display = 'block';
    }
    
    updateCameraFeedback("OpenCV loaded successfully");
}

// MOBILE-FRIENDLY CAMERA START FUNCTION
startBtn.addEventListener('click', async () => {
    try {
        if (!openCvReady) {
            alert('Please wait for OpenCV to load completely...');
            return;
        }
        
        updateCameraFeedback("Starting camera...");
        
        // Stop existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // MOBILE-SPECIFIC CONSTRAINTS
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24 }, // Lower for mobile performance
                facingMode: isMobile ? 'environment' : 'environment' // Always back camera on mobile
            },
            audio: false
        };
        
        // For desktop, allow camera selection
        if (!isMobile && cameraSelect.value === 'user') {
            constraints.video.facingMode = 'user';
        }
        
        console.log("Requesting camera with constraints:", constraints);
        
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoInput.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoInput.onloadedmetadata = () => {
                resolve();
            };
        });
        
        await videoInput.play();
        
        // Set canvas size to match video
        canvasOutput.width = videoInput.videoWidth;
        canvasOutput.height = videoInput.videoHeight;
        
        // Update UI
        toggleDetectBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.disabled = true;
        statusElement.textContent = "Status: Camera active - Tap 'Start Detection'";
        
        document.body.classList.add('camera-active');
        updateCameraFeedback(`Camera active: ${videoInput.videoWidth}x${videoInput.videoHeight}`);
        
        console.log(`Camera started successfully: ${videoInput.videoWidth}x${videoInput.videoHeight}`);
        
    } catch (err) {
        console.error("Camera access error:", err);
        handleCameraError(err);
    }
});

// Enhanced error handling for mobile
function handleCameraError(err) {
    let errorMessage = "Camera error: ";
    
    switch (err.name) {
        case 'NotAllowedError':
            errorMessage += "Please allow camera access in your browser settings.";
            break;
        case 'NotFoundError':
            errorMessage += "No camera found on this device.";
            break;
        case 'NotSupportedError':
            errorMessage += "Camera not supported by your browser.";
            break;
        case 'NotReadableError':
            errorMessage += "Camera is being used by another application.";
            break;
        case 'OverconstrainedError':
            errorMessage += "Camera doesn't support required settings. Trying alternative...";
            // Try with simpler constraints
            tryAlternativeConstraints();
            return;
        default:
            errorMessage += "Unknown error occurred.";
    }
    
    alert(errorMessage);
    statusElement.textContent = "Status: " + errorMessage;
    updateCameraFeedback("Camera error - " + errorMessage);
}

// Alternative constraints for problematic devices
async function tryAlternativeConstraints() {
    try {
        updateCameraFeedback("Trying alternative camera settings...");
        
        const alternativeConstraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 }
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(alternativeConstraints);
        videoInput.srcObject = stream;
        
        videoInput.onloadedmetadata = () => {
            canvasOutput.width = videoInput.videoWidth;
            canvasOutput.height = videoInput.videoHeight;
            
            toggleDetectBtn.disabled = false;
            stopBtn.disabled = false;
            startBtn.disabled = true;
            statusElement.textContent = "Status: Camera active (alternative mode)";
            
            updateCameraFeedback("Camera started with alternative settings");
        };
        
    } catch (fallbackErr) {
        console.error("Alternative camera also failed:", fallbackErr);
        alert("Cannot access camera with any settings. Please check permissions.");
    }
}

// Enhanced real-time detection toggle
toggleDetectBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    if (!realTimeDetection) {
        // Start real-time detection
        realTimeDetection = true;
        toggleDetectBtn.textContent = "🔴 Stop Detection";
        toggleDetectBtn.classList.add('active');
        statusElement.textContent = "Status: Real-time detection ACTIVE";
        
        // Process frames at mobile-friendly interval
        detectionInterval = setInterval(processFrame, DETECTION_INTERVAL);
        
        updateCameraFeedback("Detection active - Point camera at tree");
        console.log("Real-time detection started");
        
    } else {
        // Stop real-time detection
        realTimeDetection = false;
        toggleDetectBtn.textContent = "🟢 Start Detection";
        toggleDetectBtn.classList.remove('active');
        statusElement.textContent = "Status: Detection paused";
        detectionOverlay.classList.remove('overlay-active');
        
        clearInterval(detectionInterval);
        updateCameraFeedback("Detection paused");
        console.log("Real-time detection stopped");
    }
});

// Enhanced calibration for mobile touch
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
    calibrationStatus.textContent = "Tap two points on a known object...";
    calibrationStatus.style.color = "#e74c3c";
    
    updateCameraFeedback("Calibration mode - Tap two points");
    console.log("Calibration mode activated");
});

// Enhanced touch event for calibration
canvasOutput.addEventListener('click', handleCalibrationClick);

function handleCalibrationClick(event) {
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
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = calibrationPoints.length === 1 ? '#3498db' : '#e74c3c';
    ctx.fill();
    
    if (calibrationPoints.length === 1) {
        calibrationStatus.textContent = "Now tap the second point...";
        updateCameraFeedback("First point set - tap second point");
    }
    
    if (calibrationPoints.length === 2) {
        const pixelDistance = Math.sqrt(
            Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
            Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
        );
        
        const refWidthCm = parseFloat(refWidthInput.value);
        
        if (refWidthCm > 0 && pixelDistance > 10) { // Minimum 10 pixel distance
            PIXEL_TO_CM = refWidthCm / pixelDistance;
            calibrationMode = false;
            
            calibrationStatus.textContent = `✅ Calibrated! 1px = ${PIXEL_TO_CM.toFixed(4)}cm`;
            calibrationStatus.style.color = "#27ae60";
            
            updateCameraFeedback(`Calibration complete: ${PIXEL_TO_CM.toFixed(4)}cm/px`);
            console.log(`Calibration: ${refWidthCm}cm = ${pixelDistance.toFixed(1)}px`);
            
            // Clear and restart detection
            setTimeout(() => {
                if (realTimeDetection) processFrame();
            }, 500);
            
        } else {
            calibrationStatus.textContent = "❌ Points too close - try again";
            calibrationStatus.style.color = "#e74c3c";
            calibrationPoints = [];
        }
    }
}

// Enhanced frame processing for mobile
function processFrame() {
    if (!stream || !videoInput.videoWidth) return;
    
    try {
        const ctx = canvasOutput.getContext('2d');
        
        // Ensure canvas size matches video
        if (canvasOutput.width !== videoInput.videoWidth || 
            canvasOutput.height !== videoInput.videoHeight) {
            canvasOutput.width = videoInput.videoWidth;
            canvasOutput.height = videoInput.videoHeight;
        }
        
        // Draw current video frame to canvas
        ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
        
        // Process with OpenCV
        enhancedProcessWithOpenCV();
        
    } catch (err) {
        console.error('Frame processing error:', err);
    }
}

// MOBILE-OPTIMIZED OPENCV PROCESSING
function enhancedProcessWithOpenCV() {
    try {
        let src = cv.imread(canvasOutput);
        let hsv = new cv.Mat();
        let mask = new cv.Mat();
        
        // Convert to HSV
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
        
        // ENHANCED COLOR DETECTION FOR MOBILE
        // Brown ranges for tree trunks
        let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 50, 30, 0]);
        let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 200, 255]);
        
        let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 50, 30, 0]);
        let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 200, 255]);
        
        let mask1 = new cv.Mat();
        let mask2 = new cv.Mat();
        
        cv.inRange(hsv, low_brown1, high_brown1, mask1);
        cv.inRange(hsv, low_brown2, high_brown2, mask2);
        cv.bitwise_or(mask1, mask2, mask);
        
        // MOBILE-OPTIMIZED MORPHOLOGY
        let kernel_open = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        let kernel_close = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
        
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
                
                if (area > MIN_CONTOUR_AREA && area > maxArea) {
                    maxArea = area;
                    maxContourIndex = i;
                    maxContour = contour;
                }
            }
            
            if (maxContourIndex !== -1 && maxContour) {
                detected = true;
                let rect = cv.boundingRect(maxContour);
                
                // Calculate measurements
                let diameter_px = rect.width;
                let height_px = rect.height;
                
                let diameter_cm = diameter_px * PIXEL_TO_CM;
                let height_cm = height_px * PIXEL_TO_CM;
                
                // Volume calculation (cylindrical assumption)
                let radius_cm = diameter_cm / 2;
                let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm * 0.8;
                
                // Weight calculation
                let weight_kg = (volume_cm3 * WOOD_DENSITY_G_CM3) / 1000;
                
                // Lumber calculation
                let num_lumber = Math.max(0, (volume_cm3 / LUMBER_VOLUME_CM3) * 0.7);
                
                // Update results
                updateEnhancedResults(diameter_cm, height_cm, volume_cm3, weight_kg, num_lumber);
                
                // Draw detection overlay
                drawDetectionOverlay(rect, diameter_px, height_px);
                
                updateCameraFeedback(`Tree detected: ${maxArea.toFixed(0)}px`);
                
            } else {
                showNoDetection();
                updateCameraFeedback("No tree detected - adjust camera");
            }
        } else {
            showNoDetection();
            updateCameraFeedback("Searching for tree...");
        }
        
        if (!detected) {
            detectionOverlay.classList.remove('overlay-active');
        }
        
        // Clean up memory
        cleanupOpenCV([src, hsv, mask, mask1, mask2, contours, hierarchy,
                      low_brown1, high_brown1, low_brown2, high_brown2,
                      kernel_open, kernel_close]);
        
    } catch (err) {
        console.error('OpenCV processing error:', err);
        showNoDetection();
        updateCameraFeedback("Processing error");
    }
}

// Memory cleanup helper
function cleanupOpenCV(mats) {
    mats.forEach(mat => {
        if (mat && !mat.isDeleted()) {
            try {
                mat.delete();
            } catch (e) {
                console.warn('Error deleting OpenCV mat:', e);
            }
        }
    });
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
    ctx.font = '14px Arial';
    ctx.fillText(`D: ${(diameter_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y - 5);
    ctx.fillText(`H: ${(height_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y + rect.height + 20);
}

function showNoDetection() {
    diameterResult.textContent = "-- cm";
    heightResult.textContent = "-- cm";
    volumeResult.textContent = "-- cm³";
    weightResult.textContent = "-- kg";
    lumberResult.textContent = "-- pieces";
    
    detectionOverlay.classList.remove('overlay-active');
}

// Enhanced camera feedback
function updateCameraFeedback(message) {
    cameraFeedback.textContent = message;
    cameraFeedback.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (!calibrationMode) {
            cameraFeedback.style.display = 'none';
        }
    }, 3000);
}

// Enhanced stop function
stopBtn.addEventListener('click', () => {
    if (stream) {
        // Stop detection first
        if (realTimeDetection) {
            realTimeDetection = false;
            clearInterval(detectionInterval);
            toggleDetectBtn.textContent = "🟢 Start Detection";
            toggleDetectBtn.classList.remove('active');
        }
        
        // Stop camera
        stream.getTracks().forEach(track => track.stop());
        videoInput.srcObject = null;
        stream = null;
        
        // Update UI
        toggleDetectBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.disabled = false;
        statusElement.textContent = "Status: Camera stopped";
        detectionOverlay.classList.remove('overlay-active');
        document.body.classList.remove('camera-active');
        
        showNoDetection();
        updateCameraFeedback("Camera stopped");
        
        console.log("Camera stopped successfully");
    }
});

// Initialize application
function initializeApp() {
    toggleDetectBtn.disabled = true;
    stopBtn.disabled = true;
    
    // Set initial pixel-to-cm ratio based on device type
    PIXEL_TO_CM = isMobile ? 0.05 : 0.1; // Different default for mobile
    
    console.log(`App initialized - Mobile: ${isMobile}, Default PIXEL_TO_CM: ${PIXEL_TO_CM}`);
    
    // Add resize handler for orientation changes
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
}

function handleResize() {
    // Brief pause during orientation change
    if (realTimeDetection) {
        clearInterval(detectionInterval);
        setTimeout(() => {
            if (realTimeDetection) {
                detectionInterval = setInterval(processFrame, DETECTION_INTERVAL);
            }
        }, 1000);
    }
}

// Start initialization when page loads
document.addEventListener('DOMContentLoaded', initializeApp);