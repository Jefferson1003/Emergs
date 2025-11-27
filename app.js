// Enhanced Constants
const LUMBER_VOLUME_CM3 = 2000;
const WOOD_DENSITY_G_CM3 = 0.6;
const MIN_CONTOUR_AREA = 2500;
const DETECTION_INTERVAL = 400;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1;
let calibrationMode = false;
let calibrationPoints = [];
let realTimeDetection = false;
let detectionInterval = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let currentMode = 'realtime';

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

// Mode Elements
const realtimeModeBtn = document.getElementById('realtimeMode');
const uploadModeBtn = document.getElementById('uploadMode');
const realtimeSection = document.getElementById('realtimeSection');
const uploadSection = document.getElementById('uploadSection');

// Upload Elements
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const previewImage = document.getElementById('previewImage');
const uploadPreview = document.getElementById('uploadPreview');
const removeImageBtn = document.getElementById('removeImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const calibrateUploadBtn = document.getElementById('calibrateUploadBtn');

// Result Elements
const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const volumeResult = document.getElementById('volumeResult');
const weightResult = document.getElementById('weightResult');
const lumberResult = document.getElementById('lumberResult');
const qualityResult = document.getElementById('qualityResult');
const detectionInfo = document.getElementById('detectionInfo');

// ==================== MODE SWITCHING ====================
realtimeModeBtn.addEventListener('click', () => switchMode('realtime'));
uploadModeBtn.addEventListener('click', () => switchMode('upload'));

function switchMode(mode) {
    currentMode = mode;
    
    // Update UI
    realtimeModeBtn.classList.toggle('active', mode === 'realtime');
    uploadModeBtn.classList.toggle('active', mode === 'upload');
    realtimeSection.classList.toggle('active', mode === 'realtime');
    uploadSection.classList.toggle('active', mode === 'upload');
    
    // Stop camera if switching to upload mode
    if (mode === 'upload' && stream) {
        stopCamera();
    }
    
    // Update status
    statusElement.textContent = `Status: ${mode === 'realtime' ? 'Real-time mode' : 'Upload mode'} - Ready to start`;
    detectionInfo.textContent = mode === 'realtime' ? 'No tree detected' : 'No image uploaded';
    
    console.log(`Switched to ${mode} mode`);
}

// ==================== UPLOAD FUNCTIONALITY ====================
uploadArea.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', handleImageUpload);

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0]);
    }
});

function handleImageUpload(e) {
    if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
    }
}

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPG, PNG, WebP)');
        return;
    }
    
    if (file.size > MAX_IMAGE_SIZE) {
        alert('Image size too large. Please upload image smaller than 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadPreview.style.display = 'block';
        analyzeBtn.disabled = false;
        statusElement.textContent = 'Status: Image uploaded - Click "Analyze Image"';
        detectionInfo.textContent = 'Image ready for analysis';
    };
    reader.readAsDataURL(file);
}

removeImageBtn.addEventListener('click', () => {
    previewImage.src = '';
    uploadPreview.style.display = 'none';
    analyzeBtn.disabled = true;
    imageInput.value = '';
    statusElement.textContent = 'Status: Upload mode - No image selected';
    detectionInfo.textContent = 'No image uploaded';
    clearResults();
});

analyzeBtn.addEventListener('click', analyzeUploadedImage);

calibrateUploadBtn.addEventListener('click', () => {
    if (!previewImage.src) {
        alert('Please upload an image first!');
        return;
    }
    startUploadCalibration();
});

function analyzeUploadedImage() {
    if (!previewImage.src) {
        alert('Please upload an image first!');
        return;
    }
    
    statusElement.textContent = 'Status: Analyzing image...';
    detectionInfo.textContent = 'Processing image for tree detection';
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = previewImage.naturalWidth;
    tempCanvas.height = previewImage.naturalHeight;
    tempCtx.drawImage(previewImage, 0, 0);
    
    processImageWithOpenCV(tempCanvas);
}

function processImageWithOpenCV(canvas) {
    try {
        let src = cv.imread(canvas);
        let results = enhancedTreeDetection(src);
        
        if (results.detected) {
            updateEnhancedResults(
                results.diameter, 
                results.height, 
                results.volume, 
                results.weight, 
                results.lumber
            );
            
            drawImageDetection(canvas, results.rect);
            qualityResult.textContent = results.quality;
            detectionInfo.textContent = `Tree detected: ${results.contourArea.toFixed(0)} pixels`;
            statusElement.textContent = 'Status: Analysis complete';
            
        } else {
            showNoDetection();
            detectionInfo.textContent = 'No tree detected in image';
            statusElement.textContent = 'Status: Analysis failed - No tree found';
        }
        
        src.delete();
        
    } catch (err) {
        console.error('Image analysis error:', err);
        showNoDetection();
        detectionInfo.textContent = 'Analysis error - Try another image';
        statusElement.textContent = 'Status: Analysis error';
    }
}

function drawImageDetection(canvas, rect) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`D: ${(rect.width * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y - 10);
    ctx.fillText(`H: ${(rect.height * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y + rect.height + 25);
    
    previewImage.src = canvas.toDataURL();
}

function startUploadCalibration() {
    calibrationMode = true;
    calibrationPoints = [];
    calibrationStatus.textContent = "Click two points on a known object in the image...";
    calibrationStatus.style.color = "#e74c3c";
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = previewImage.naturalWidth;
    tempCanvas.height = previewImage.naturalHeight;
    tempCtx.drawImage(previewImage, 0, 0);
    
    const clickHandler = (e) => {
        if (!calibrationMode) return;
        
        const rect = previewImage.getBoundingClientRect();
        const scaleX = previewImage.naturalWidth / rect.width;
        const scaleY = previewImage.naturalHeight / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        calibrationPoints.push({x, y});
        
        tempCtx.beginPath();
        tempCtx.arc(x, y, 8, 0, 2 * Math.PI);
        tempCtx.fillStyle = calibrationPoints.length === 1 ? '#3498db' : '#e74c3c';
        tempCtx.fill();
        
        previewImage.src = tempCanvas.toDataURL();
        
        if (calibrationPoints.length === 1) {
            calibrationStatus.textContent = "Now click the second point...";
        }
        
        if (calibrationPoints.length === 2) {
            const pixelDistance = Math.sqrt(
                Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
                Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
            );
            
            const refWidthCm = parseFloat(refWidthInput.value);
            
            if (refWidthCm > 0 && pixelDistance > 10) {
                PIXEL_TO_CM = refWidthCm / pixelDistance;
                calibrationMode = false;
                
                calibrationStatus.textContent = `✅ Calibrated! 1px = ${PIXEL_TO_CM.toFixed(4)}cm`;
                calibrationStatus.style.color = "#27ae60";
                
                previewImage.removeEventListener('click', clickHandler);
                setTimeout(analyzeUploadedImage, 500);
                
            } else {
                calibrationStatus.textContent = "❌ Points too close - try again";
                calibrationPoints = [];
            }
        }
    };
    
    previewImage.addEventListener('click', clickHandler);
    detectionInfo.textContent = 'Calibration mode - Click two points on image';
}

// ==================== CAMERA FUNCTIONALITY ====================
function onOpenCvReady() {
    openCvReady = true;
    console.log('OpenCV.js loaded successfully!');
    startBtn.disabled = false;
    statusElement.textContent = "Status: Ready - Select mode to start";
    
    if (isMobile) {
        document.querySelector('.mobile-instructions').style.display = 'block';
    }
    
    updateCameraFeedback("OpenCV loaded successfully");
}

// MOBILE-FRIENDLY CAMERA START
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
        
        // MOBILE-OPTIMIZED CONSTRAINTS
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24 },
                facingMode: isMobile ? 'environment' : 'environment'
            },
            audio: false
        };
        
        // For desktop, allow camera selection
        if (!isMobile && cameraSelect.value === 'user') {
            constraints.video.facingMode = 'user';
        }
        
        console.log("Requesting camera with constraints:", constraints);
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoInput.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoInput.onloadedmetadata = () => {
                resolve();
            };
        });
        
        await videoInput.play();
        
        // Set canvas size
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
            tryAlternativeConstraints();
            return;
        default:
            errorMessage += "Unknown error occurred.";
    }
    
    alert(errorMessage);
    statusElement.textContent = "Status: " + errorMessage;
    updateCameraFeedback("Camera error - " + errorMessage);
}

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

// REAL-TIME DETECTION TOGGLE
toggleDetectBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Please start camera first!");
        return;
    }
    
    if (!realTimeDetection) {
        realTimeDetection = true;
        toggleDetectBtn.textContent = "🔴 Stop Detection";
        toggleDetectBtn.classList.add('active');
        statusElement.textContent = "Status: Real-time detection ACTIVE";
        
        detectionInterval = setInterval(processFrame, DETECTION_INTERVAL);
        
        updateCameraFeedback("Detection active - Point camera at tree");
        console.log("Real-time detection started");
        
    } else {
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

// CALIBRATION FOR CAMERA
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

canvasOutput.addEventListener('click', handleCalibrationClick);

function handleCalibrationClick(event) {
    if (!calibrationMode) return;
    
    const rect = canvasOutput.getBoundingClientRect();
    const scaleX = canvasOutput.width / rect.width;
    const scaleY = canvasOutput.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    calibrationPoints.push({x, y});
    
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
        
        if (refWidthCm > 0 && pixelDistance > 10) {
            PIXEL_TO_CM = refWidthCm / pixelDistance;
            calibrationMode = false;
            
            calibrationStatus.textContent = `✅ Calibrated! 1px = ${PIXEL_TO_CM.toFixed(4)}cm`;
            calibrationStatus.style.color = "#27ae60";
            
            updateCameraFeedback(`Calibration complete: ${PIXEL_TO_CM.toFixed(4)}cm/px`);
            console.log(`Calibration: ${refWidthCm}cm = ${pixelDistance.toFixed(1)}px`);
            
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

// FRAME PROCESSING
function processFrame() {
    if (!stream || !videoInput.videoWidth) return;
    
    try {
        const ctx = canvasOutput.getContext('2d');
        
        if (canvasOutput.width !== videoInput.videoWidth || 
            canvasOutput.height !== videoInput.videoHeight) {
            canvasOutput.width = videoInput.videoWidth;
            canvasOutput.height = videoInput.videoHeight;
        }
        
        ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
        
        let src = cv.imread(canvasOutput);
        let results = enhancedTreeDetection(src);
        
        if (results.detected) {
            updateEnhancedResults(
                results.diameter, 
                results.height, 
                results.volume, 
                results.weight, 
                results.lumber
            );
            
            drawDetectionOverlay(results.rect, results.diameter / PIXEL_TO_CM, results.height / PIXEL_TO_CM);
            qualityResult.textContent = results.quality;
            detectionInfo.textContent = `Tree detected: ${results.contourArea.toFixed(0)} pixels`;
            
        } else {
            showNoDetection();
            detectionInfo.textContent = "No tree detected - adjust camera";
        }
        
        src.delete();
        
    } catch (err) {
        console.error('Frame processing error:', err);
        showNoDetection();
        detectionInfo.textContent = "Processing error";
    }
}

function drawDetectionOverlay(rect, diameter_px, height_px) {
    detectionOverlay.classList.add('overlay-active');
    
    const ctx = canvasOutput.getContext('2d');
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = '14px Arial';
    ctx.fillText(`D: ${(diameter_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y - 5);
    ctx.fillText(`H: ${(height_px * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y + rect.height + 20);
}

// STOP CAMERA FUNCTION
function stopCamera() {
    if (stream) {
        if (realTimeDetection) {
            realTimeDetection = false;
            clearInterval(detectionInterval);
            toggleDetectBtn.textContent = "🟢 Start Detection";
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
        document.body.classList.remove('camera-active');
        
        showNoDetection();
        updateCameraFeedback("Camera stopped");
        
        console.log("Camera stopped successfully");
    }
}

stopBtn.addEventListener('click', stopCamera);

// ==================== SHARED DETECTION ALGORITHM ====================
function enhancedTreeDetection(src) {
    let hsv = new cv.Mat();
    let mask = new cv.Mat();
    
    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
    
    let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 50, 30, 0]);
    let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 200, 255]);
    
    let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 50, 30, 0]);
    let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 200, 255]);
    
    let mask1 = new cv.Mat();
    let mask2 = new cv.Mat();
    
    cv.inRange(hsv, low_brown1, high_brown1, mask1);
    cv.inRange(hsv, low_brown2, high_brown2, mask2);
    cv.bitwise_or(mask1, mask2, mask);
    
    let kernel_open = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    let kernel_close = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
    
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel_open);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel_close);
    
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    let result = {
        detected: false,
        diameter: 0,
        height: 0,
        volume: 0,
        weight: 0,
        lumber: 0,
        quality: 'Low',
        contourArea: 0,
        rect: null
    };
    
    if (contours.size() > 0) {
        let maxArea = 0;
        let maxContourIndex = -1;
        
        for (let i = 0; i < contours.size(); i++) {
            let area = cv.contourArea(contours.get(i));
            if (area > MIN_CONTOUR_AREA && area > maxArea) {
                maxArea = area;
                maxContourIndex = i;
            }
        }
        
        if (maxContourIndex !== -1) {
            let trunk = contours.get(maxContourIndex);
            let rect = cv.boundingRect(trunk);
            
            let diameter_cm = rect.width * PIXEL_TO_CM;
            let height_cm = rect.height * PIXEL_TO_CM;
            let radius_cm = diameter_cm / 2;
            let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm * 0.8;
            let weight_kg = (volume_cm3 * WOOD_DENSITY_G_CM3) / 1000;
            let num_lumber = Math.max(0, (volume_cm3 / LUMBER_VOLUME_CM3) * 0.7);
            
            let quality = maxArea > 10000 ? 'High' : (maxArea > 5000 ? 'Medium' : 'Low');
            
            result = {
                detected: true,
                diameter: diameter_cm,
                height: height_cm,
                volume: volume_cm3,
                weight: weight_kg,
                lumber: num_lumber,
                quality: quality,
                contourArea: maxArea,
                rect: rect
            };
        }
    }
    
    // Cleanup
    [hsv, mask, mask1, mask2, contours, hierarchy,
     low_brown1, high_brown1, low_brown2, high_brown2,
     kernel_open, kernel_close].forEach(mat => {
        if (mat && !mat.isDeleted()) mat.delete();
    });
    
    return result;
}

// ==================== SHARED UTILITY FUNCTIONS ====================
function updateEnhancedResults(diameter, height, volume, weight, lumber) {
    diameterResult.textContent = `${diameter.toFixed(1)} cm`;
    heightResult.textContent = `${height.toFixed(1)} cm`;
    volumeResult.textContent = `${volume.toFixed(0)} cm³`;
    weightResult.textContent = `${weight.toFixed(1)} kg`;
    lumberResult.textContent = `${Math.round(lumber * 10) / 10} pieces`;
    
    const results = [diameterResult, heightResult, volumeResult, weightResult, lumberResult];
    results.forEach(result => {
        result.parentElement.classList.add('detecting');
        setTimeout(() => result.parentElement.classList.remove('detecting'), 1000);
    });
}

function showNoDetection() {
    diameterResult.textContent = "-- cm";
    heightResult.textContent = "-- cm";
    volumeResult.textContent = "-- cm³";
    weightResult.textContent = "-- kg";
    lumberResult.textContent = "-- pieces";
    qualityResult.textContent = "--";
    
    detectionOverlay.classList.remove('overlay-active');
}

function clearResults() {
    showNoDetection();
}

function updateCameraFeedback(message) {
    cameraFeedback.textContent = message;
    cameraFeedback.style.display = 'block';
    setTimeout(() => {
        if (!calibrationMode) {
            cameraFeedback.style.display = 'none';
        }
    }, 3000);
}

// ==================== INITIALIZATION ====================
function initializeApp() {
    toggleDetectBtn.disabled = true;
    stopBtn.disabled = true;
    PIXEL_TO_CM = isMobile ? 0.05 : 0.1;
    
    console.log(`App initialized - Mobile: ${isMobile}`);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
}

function handleResize() {
    if (realTimeDetection) {
        clearInterval(detectionInterval);
        setTimeout(() => {
            if (realTimeDetection) {
                detectionInterval = setInterval(processFrame, DETECTION_INTERVAL);
            }
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);