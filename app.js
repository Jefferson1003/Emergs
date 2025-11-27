// Enhanced Constants
const LUMBER_VOLUME_CM3 = 2000;
const WOOD_DENSITY_G_CM3 = 0.6;
const MIN_CONTOUR_AREA = 2500;
const DETECTION_INTERVAL = 400;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1;
let calibrationMode = false;
let calibrationPoints = [];
let realTimeDetection = false;
let detectionInterval = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let currentMode = 'realtime'; // 'realtime' or 'upload'

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

// Mode Switching
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

// Upload Functionality
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
    // Validate file
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPG, PNG, WebP)');
        return;
    }
    
    if (file.size > MAX_IMAGE_SIZE) {
        alert('Image size too large. Please upload image smaller than 5MB.');
        return;
    }
    
    // Read and preview image
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

// Image Analysis
function analyzeUploadedImage() {
    if (!previewImage.src) {
        alert('Please upload an image first!');
        return;
    }
    
    statusElement.textContent = 'Status: Analyzing image...';
    detectionInfo.textContent = 'Processing image for tree detection';
    
    // Create temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = previewImage.naturalWidth;
    tempCanvas.height = previewImage.naturalHeight;
    tempCtx.drawImage(previewImage, 0, 0);
    
    // Process with OpenCV
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
            
            // Draw detection on preview image
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
    
    // Draw bounding box
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    // Draw measurements
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`D: ${(rect.width * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y - 10);
    ctx.fillText(`H: ${(rect.height * PIXEL_TO_CM).toFixed(1)}cm`, rect.x, rect.y + rect.height + 25);
    
    // Update preview image
    previewImage.src = canvas.toDataURL();
}

// Upload Calibration
function startUploadCalibration() {
    calibrationMode = true;
    calibrationPoints = [];
    calibrationStatus.textContent = "Click two points on a known object in the image...";
    calibrationStatus.style.color = "#e74c3c";
    
    // Create click handler for image calibration
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
        
        // Draw point on temporary canvas
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
                
                // Remove click handler
                previewImage.removeEventListener('click', clickHandler);
                
                // Re-analyze with new calibration
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

// Enhanced OpenCV.js loading
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

// Enhanced tree detection (shared between realtime and upload)
function enhancedTreeDetection(src) {
    let hsv = new cv.Mat();
    let mask = new cv.Mat();
    
    // Convert to HSV
    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
    
    // Color ranges for coconut trees
    let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 50, 30, 0]);
    let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 200, 255]);
    
    let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 50, 30, 0]);
    let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 200, 255]);
    
    let mask1 = new cv.Mat();
    let mask2 = new cv.Mat();
    
    cv.inRange(hsv, low_brown1, high_brown1, mask1);
    cv.inRange(hsv, low_brown2, high_brown2, mask2);
    cv.bitwise_or(mask1, mask2, mask);
    
    // Morphology operations
    let kernel_open = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    let kernel_close = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
    
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel_open);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel_close);
    
    // Find contours
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
            
            // Calculate measurements
            let diameter_cm = rect.width * PIXEL_TO_CM;
            let height_cm = rect.height * PIXEL_TO_CM;
            let radius_cm = diameter_cm / 2;
            let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm * 0.8;
            let weight_kg = (volume_cm3 * WOOD_DENSITY_G_CM3) / 1000;
            let num_lumber = Math.max(0, (volume_cm3 / LUMBER_VOLUME_CM3) * 0.7);
            
            // Determine quality
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

// [REST OF THE CAMERA FUNCTIONS REMAIN THE SAME AS PREVIOUS VERSION]
// (startBtn event listener, handleCameraError, processFrame, etc.)
// Include all the camera functionality from the previous version

// Enhanced frame processing for real-time
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
        
        // Process with shared detection function
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

// Shared functions
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

// Initialize application
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

// [Include all the remaining camera functions from previous version]
// calibrateBtn event listener, handleCalibrationClick, stopCamera, etc.