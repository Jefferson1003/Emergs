// CONSTANTS
const DENSITY = 0.6;
const LUMBER_CM3 = 2000;
let PIXEL_TO_CM = 0.1;

let stream = null;
let detecting = false;
let detectLoop = null;
let opencvReady = false;

// ELEMENTS
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const camSelect = document.getElementById("cameraSelect");
const startBtn = document.getElementById("startCam");
const stopBtn = document.getElementById("stopCam");
const detectBtn = document.getElementById("toggleDetect");

const rDiameter = document.getElementById("rDiameter");
const rHeight = document.getElementById("rHeight");
const rVolume = document.getElementById("rVolume");
const rLumber = document.getElementById("rLumber");
const statusBox = document.getElementById("status");

const refWidth = document.getElementById("refWidth");
const calibrateBtn = document.getElementById("calibrateBtn");
const calibStatus = document.getElementById("calibrationStatus");

// ON OPENCV LOADED
document.addEventListener("opencvReady", loadCameras);

// Load OpenCV
if (typeof cv !== "undefined") {
    cv['onRuntimeInitialized'] = () => {
        opencvReady = true;
        console.log("OpenCV Ready");
        loadCameras();
    };
}

// Detect available cameras
async function loadCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === "videoinput");

    camSelect.innerHTML = "";
    cams.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.deviceId;
        opt.textContent = c.label || "Camera";
        camSelect.appendChild(opt);
    });
}

// Start camera
startBtn.onclick = async () => {
    if (!opencvReady) return alert("OpenCV is loading...");

    const constraints = {
        video: {
            deviceId: camSelect.value ? { exact: camSelect.value } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    detectBtn.disabled = false;

    statusBox.textContent = "Status: Camera running";
};

// Stop camera
stopBtn.onclick = () => {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }

    stopDetection();

    startBtn.disabled = false;
    stopBtn.disabled = true;
    detectBtn.disabled = true;

    statusBox.textContent = "Status: Camera stopped";
};

// Toggle detection
detectBtn.onclick = () => {
    if (!detecting) startDetection();
    else stopDetection();
};

function startDetection() {
    detecting = true;
    detectBtn.textContent = "🔴 Stop Detection";

    detectLoop = setInterval(processFrame, 300);
    statusBox.textContent = "Status: Detecting...";
}

function stopDetection() {
    detecting = false;
    clearInterval(detectLoop);
    detectBtn.textContent = "🟢 Start Detection";

    resetResults();
    statusBox.textContent = "Status: Idle";
}

// Calibration
calibrateBtn.onclick = () => {
    calibStatus.textContent = "Click 2 points on a known width object";

    let clicks = [];

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        clicks.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (clicks.length === 2) {
            const dx = clicks[1].x - clicks[0].x;
            const dy = clicks[1].y - clicks[0].y;
            const px = Math.sqrt(dx * dx + dy * dy);

            PIXEL_TO_CM = parseFloat(refWidth.value) / px;
            calibStatus.textContent = `Calibrated ✔ 1px = ${PIXEL_TO_CM.toFixed(4)} cm`;
            canvas.onclick = null;
        }
    };
};

// Process frame
function processFrame() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    let src = cv.imread(canvas);
    let hsv = new cv.Mat();
    let mask = new cv.Mat();

    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);

    let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [5, 20, 20, 0]);
    let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [30, 255, 255, 255]);

    cv.inRange(hsv, low, high, mask);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() > 0) {
        let maxContour = null;
        let maxArea = 0;

        for (let i = 0; i < contours.size(); i++) {
            const area = cv.contourArea(contours.get(i));
            if (area > maxArea) {
                maxArea = area;
                maxContour = contours.get(i);
            }
        }

        if (maxContour && maxArea > 1500) {
            let rect = cv.boundingRect(maxContour);

            const diameter = rect.width * PIXEL_TO_CM;
            const height = rect.height * PIXEL_TO_CM;

            const radius = diameter / 2;
            const volume = Math.PI * radius * radius * height;
            const lumber = volume / LUMBER_CM3;

            updateResults(diameter, height, volume, lumber);
        }
    }

    src.delete();
    hsv.delete();
    mask.delete();
    low.delete();
    high.delete();
    contours.delete();
    hierarchy.delete();
}

function updateResults(d, h, v, l) {
    rDiameter.textContent = `Diameter: ${d.toFixed(1)} cm`;
    rHeight.textContent = `Height: ${h.toFixed(1)} cm`;
    rVolume.textContent = `Volume: ${v.toFixed(0)} cm³`;
    rLumber.textContent = `Lumber Estimate: ${l.toFixed(1)} pcs`;

    markDetect(rDiameter);
    markDetect(rHeight);
    markDetect(rVolume);
    markDetect(rLumber);
}

function markDetect(el) {
    el.classList.add("detecting");
    setTimeout(() => el.classList.remove("detecting"), 400);
}

function resetResults() {
    rDiameter.textContent = "Diameter: -- cm";
    rHeight.textContent = "Height: -- cm";
    rVolume.textContent = "Volume: -- cm³";
    rLumber.textContent = "Lumber Estimate: -- pcs";
}
