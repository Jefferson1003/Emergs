// Constants
const LUMBER_VOLUME_CM3 = 2000;
const WOOD_DENSITY_G_CM3 = 0.6; // Average wood density

// Global variables
let stream = null;
let openCvReady = false;
let PIXEL_TO_CM = 0.1;
let calibrationMode = false;
let calibrationPoints = [];
let realTimeDetection = false;
let detectionInterval = null;

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

const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const volumeResult = document.getElementById('volumeResult');
const lumberResult = document.getElementById('lumberResult');
const statusElement = document.getElementById('status');

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
        
        cameraSelect.innerHTML = '';
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            // Identify camera type
            if (device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear') ||
                index === videoDevices.length - 1) {
                option.text = 'Back Camera';
                option.value = 'environment';
            } else {
                option.text = 'Front Camera';
                option.value = 'user';
            }
            
            cameraSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error getting cameras:', err);
    }
}

// Start camera function - NORMAL BACK CAMERA (NO MIRROR)
startBtn.addEventListener('click', async () => {
    try {
        if (!openCvReady) {
            alert('Please wait for OpenCV to load...');
            return;
        }
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const selectedCamera = cameraSelect.value;
        let constraints = {
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            } 
        };
        
        // Camera selection - NORMAL ORIENTATION
        if (selectedCamera === 'environment') {
            constraints.video.facingMode = { ideal: 'environment' }; // Back camera
        } else if (selectedCamera === 'user') {
            constraints.video.facingMode = { ideal: 'user' }; // Front camera
        } else if (selectedCamera) {
            constraints.video.deviceId = { exact: selectedCamera };
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        videoInput.srcObject = stream;
        toggleDetectBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.disabled = true;
        statusElement.textContent = "Status: Camera ready - Click Start Real-time";
        
        console.log("Camera started successfully!");
        
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Cannot access camera. Please check permissions.");
    }
});

// Toggle real-time detection
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
        statusElement.textContent = "Status: Real-time detection ON";
        
        // Process frames every 500ms for real-time detection
        detectionInterval = setInterval(processFrame, 500);
        
        console.log("Real-time detection started");
    } else {
        // Stop real-time detection
        realTimeDetection = false;
        toggleDetectBtn.textContent = "🟢 Start Real-time";
        toggleDetectBtn.classList.remove('active');
        statusElement.textContent = "Status: Real-time detection OFF";
        
        clearInterval(detectionInterval);
        console.log("Real-time detection stopped");
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
            
            console.log(`Calibration: ${refWidthCm}cm = ${pixelDistance}px = ${PIXEL_TO_CM}cm/px`);
        }
        
        calibrationPoints = [];
    }
});

function processFrame() {
    const ctx = canvasOutput.getContext('2d');
    canvasOutput.width = videoInput.videoWidth;
    canvasOutput.height = videoInput.videoHeight;
    
    ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
    processWithOpenCV();
}

function processWithOpenCV() {
    try {
        let src = cv.imread(canvasOutput);
        let hsv = new cv.Mat();
        let mask = new cv.Mat();
        
        // Convert to HSV
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
        
        // IMPROVED TREE DETECTION - Multiple color ranges
        let low_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [5, 40, 30, 0]);
        let high_brown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [25, 220, 200, 255]);
        let low_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [150, 40, 30, 0]);
        let high_brown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 220, 200, 255]);
        
        let mask1 = new cv.Mat();
        let mask2 = new cv.Mat();
        
        cv.inRange(hsv, low_brown1, high_brown1, mask1);
        cv.inRange(hsv, low_brown2, high_brown2, mask2);
        cv.bitwise_or(mask1, mask2, mask);
        
        // Enhanced morphology
        let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(7, 7));
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
        
        kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(15, 15));
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        if (contours.size() > 0) {
            let maxArea = 0;
            let maxContourIndex = -1;
            
            // Find largest contour (minimum 2000 pixels to reduce noise)
            for (let i = 0; i < contours.size(); i++) {
                let area = cv.contourArea(contours.get(i));
                if (area > 2000 && area > maxArea) {
                    maxArea = area;
                    maxContourIndex = i;
                }
            }
            
            if (maxContourIndex !== -1) {
                let trunk = contours.get(maxContourIndex);
                let rect = cv.boundingRect(trunk);
                
                // Calculate real measurements
                let diameter_cm = rect.width * PIXEL_TO_CM;
                let height_cm = rect.height * PIXEL_TO_CM;
                
                // Calculate volume (cylindrical assumption)
                let radius_cm = diameter_cm / 2;
                let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm;
                
                // Calculate weight (volume × density)
                let weight_kg = (volume_cm3 * WOOD_DENSITY_G_CM3) / 1000;
                
                // Calculate lumber pieces
                let num_lumber = volume_cm3 / LUMBER_VOLUME_CM3;
                
                // Update results with visual feedback
                updateResults(diameter_cm, height_cm, volume_cm3, weight_kg, num_lumber);
                
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

function updateResults(diameter, height, volume, weight, lumber) {
    diameterResult.textContent = `Diameter: ${diameter.toFixed(1)} cm`;
    heightResult.textContent = `Height: ${height.toFixed(1)} cm`;
    volumeResult.textContent = `Volume: ${volume.toFixed(0)} cm³`;
    lumberResult.textContent = `Lumber Estimate: ${Math.max(0, lumber).toFixed(1)} pieces`;
    
    // Visual feedback
    diameterResult.classList.add('detecting');
    heightResult.classList.add('detecting');
    volumeResult.classList.add('detecting');
    lumberResult.classList.add('detecting');
    
    // Remove highlighting after 1 second
    setTimeout(() => {
        diameterResult.classList.remove('detecting');
        heightResult.classList.remove('detecting');
        volumeResult.classList.remove('detecting');
        lumberResult.classList.remove('detecting');
    }, 1000);
}

function showNoDetection() {
    diameterResult.textContent = "Diameter: -- cm";
    heightResult.textContent = "Height: -- cm";
    volumeResult.textContent = "Volume: -- cm³";
    lumberResult.textContent = "Lumber Estimate: -- pieces";
    
    diameterResult.classList.remove('detecting');
    heightResult.classList.remove('detecting');
    volumeResult.classList.remove('detecting');
    lumberResult.classList.remove('detecting');
}

// Stop camera function
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
        statusElement.textContent = "Status: Camera off";
        
        showNoDetection();
        console.log("Camera stopped");
    }
});

// Initialize button states
toggleDetectBtn.disabled = true;
stopBtn.disabled = true;

console.log("Tree Lumber Estimator Web App Loaded!");