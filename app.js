// Constants - same as your Python code
const PIXEL_TO_CM = 0.1;
const LUMBER_VOLUME_CM3 = 2000;

// Global variables
let stream = null;
let openCvReady = false;

// DOM Elements
const videoInput = document.getElementById('videoInput');
const canvasOutput = document.getElementById('canvasOutput');
const startBtn = document.getElementById('startBtn');
const processBtn = document.getElementById('processBtn');
const stopBtn = document.getElementById('stopBtn');

const diameterResult = document.getElementById('diameterResult');
const heightResult = document.getElementById('heightResult');
const lumberResult = document.getElementById('lumberResult');

// Check when OpenCV.js is loaded
function onOpenCvReady() {
    openCvReady = true;
    console.log('OpenCV.js is ready!');
    startBtn.disabled = false;
}

// Start camera function
startBtn.addEventListener('click', async () => {
    try {
        if (!openCvReady) {
            alert('Please wait for OpenCV to load...');
            return;
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        videoInput.srcObject = stream;
        processBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.disabled = true;
        
        console.log("Camera started successfully!");
        
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Cannot access camera. Please check permissions.");
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
    // Create canvas context
    const ctx = canvasOutput.getContext('2d');
    
    // Set canvas size same as video
    canvasOutput.width = videoInput.videoWidth;
    canvasOutput.height = videoInput.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height);
    
    // Process with OpenCV
    processWithOpenCV();
}

function processWithOpenCV() {
    try {
        // Convert canvas to OpenCV Mat
        let src = cv.imread(canvasOutput);
        let hsv = new cv.Mat();
        let mask = new cv.Mat();
        
        // Convert BGR to HSV
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
        
        // Define brown color range in HSV
        let low_brown = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 50, 20, 0]);
        let high_brown = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [30, 255, 200, 255]);
        
        // Create mask
        cv.inRange(hsv, low_brown, high_brown, mask);
        
        // Morphological operations
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
        
        kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Process contours if found
        if (contours.size() > 0) {
            let maxArea = 0;
            let maxContourIndex = -1;
            
            // Find largest contour
            for (let i = 0; i < contours.size(); i++) {
                let area = cv.contourArea(contours.get(i));
                if (area > maxArea) {
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
                
                // Calculate volume and lumber pieces
                let radius_cm = diameter_cm / 2;
                let volume_cm3 = Math.PI * Math.pow(radius_cm, 2) * height_cm;
                let num_lumber = volume_cm3 / LUMBER_VOLUME_CM3;
                
                // Update results display
                diameterResult.textContent = `Diameter: ${diameter_cm.toFixed(1)} cm`;
                heightResult.textContent = `Height: ${height_cm.toFixed(1)} cm`;
                lumberResult.textContent = `Lumber Estimate: ${num_lumber.toFixed(1)} pieces`;
                
                console.log(`Detected: ${diameter_cm.toFixed(1)}cm diameter, ${num_lumber.toFixed(1)} lumber pieces`);
            }
        } else {
            diameterResult.textContent = "Diameter: No tree detected";
            heightResult.textContent = "Height: -- cm";
            lumberResult.textContent = "Lumber Estimate: -- pieces";
        }
        
        // Clean up memory
        src.delete();
        hsv.delete();
        mask.delete();
        contours.delete();
        hierarchy.delete();
        
    } catch (err) {
        console.error('Error in OpenCV processing:', err);
    }
}

// Stop camera function
stopBtn.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoInput.srcObject = null;
        
        processBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.disabled = false;
        
        console.log("Camera stopped");
    }
});

// Initialize button states
processBtn.disabled = true;
stopBtn.disabled = true;

console.log("Tree Lumber Estimator Web App Loaded!");