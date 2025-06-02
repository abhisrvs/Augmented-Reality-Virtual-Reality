import {
    PoseLandmarker,
    HandLandmarker,
    FilesetResolver
} from "./assets/js/vision_bundle.js"; // Using local files

console.log("script.js: Module loaded.");

// --- DOM Elements ---
const video = document.getElementById("webcam");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const messageDiv = document.getElementById("message");
const organSidebar = document.getElementById("organSidebar");
const successDialog = document.getElementById("successDialog");
const successMessageText = document.getElementById("successMessageText");
const closeSuccessDialog = document.getElementById("closeSuccessDialog");

const arScene = document.querySelector("a-scene");
const bodyAnchor = document.getElementById("bodyAnchor");
const mainOrgansEntity = document.getElementById("mainOrgansEntity");
const leftHandSphere = document.getElementById("leftHand");
const rightHandSphere = document.getElementById("rightHand");
const spawnPoint = document.getElementById("spawnPoint");
const closeIcon = document.getElementById("closeIcon");


console.log("script.js: DOM elements selected.");

// --- Global Variables ---
let poseLandmarker;
let handLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;
let lastVideoTime = -1;
let stream;
let animationFrameId;
let mainOrgansOverlayed = false; // Flag for success message
let isInspectingIndividualOrgan = false; 
let currentlyHeldOrganEntity = null; // Will store the A-Frame entity being dragged
let grabbingHandType = null; 


// --- MediaPipe Initialization (Keep as before) ---
const createLandmarkers = async () => {
    // ... (Keep existing createLandmarkers, ensure paths are correct) ...
    // For brevity, assuming it's the same as the last correct version
    console.log("script.js: createLandmarkers - Starting.");
    messageDiv.innerText = "Loading  3D models...";
    startButton.disabled = true;
    try {
        const vision = await FilesetResolver.forVisionTasks("./assets/js/wasm");
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, delegate: "CPU" },
            runningMode: runningMode, numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5
        });
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "CPU" },
            runningMode: runningMode, numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
        });
        messageDiv.innerText = "Models loaded. Press Start.";
        startButton.disabled = false;
        console.log("script.js: createLandmarkers - SUCCESS.");
    } catch (error) {
        console.error("script.js: FATAL ERROR during MediaPipe Initialization:", error);
        messageDiv.innerText = "Error loading models. Check console.";
        startButton.disabled = true;
    }
};

// --- Camera Handling ---
const startWebcam = async () => {
    console.log("script.js: startWebcam - Attempting to start.");
    messageDiv.innerText = "Starting camera...";
    if (!poseLandmarker || !handLandmarker) {
        console.error("script.js: startWebcam - Landmarkers not ready!");
        messageDiv.innerText = "Models not loaded. Cannot start.";
        return;
    }
    try {
        const constraints = { video: { width: 640, height: 480, facingMode: "user" } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
             video.play();
             console.log("script.js: startWebcam - Video data loaded & playing. Starting prediction loop.");
             predictWebcam();
        });
        webcamRunning = true;
        startButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        organSidebar.style.display = 'block'; // Show sidebar
        isInspectingIndividualOrgan = false; // Reset on start
        mainOrgansOverlayed = false;      // Reset on start
        messageDiv.innerText = "Camera running. Looking for body...";
        
    } catch (err) {
        console.error("script.js: startWebcam - getUserMedia FAILED:", err);
        messageDiv.innerText = `Could not access camera: ${err.name}`;
        // ... (reset UI as before)
        startButton.disabled = false; startButton.style.display = 'inline-block';
        stopButton.style.display = 'none'; organSidebar.style.display = 'none';
    }
};

const stopWebcam = () => {
    console.log("script.js: stopWebcam - Stopping webcam.");
    messageDiv.innerText = "Model Deregistered and closing the camera";
    webcamRunning = false;
    startButton.style.display = 'inline-block'; startButton.disabled = false;
    stopButton.style.display = 'none';
    organSidebar.style.display = 'none';
    successDialog.style.display = 'none';
    isInspectingIndividualOrgan = false;
    mainOrgansOverlayed = false; // Reset flag
    bodyAnchor.setAttribute('visible', 'false');
    if (mainOrgansEntity) mainOrgansEntity.setAttribute('visible', 'false');
    leftHandSphere.setAttribute('visible', 'false');
    rightHandSphere.setAttribute('visible', 'false');
    spawnPoint.innerHTML = '';
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    lastVideoTime = -1;
};

// --- Helper: Get distance (keep as before) ---
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2) );
}

// --- Helper: Convert MediaPipe coords to A-Frame (adjust to videoBackground plane) ---
function mapToAFrame(landmark, referenceY = 1.6, referenceZ = -1.8) { // Default referenceZ for videoBackground
    // These should match the A-Frame plane for the video background
    const planeWidth = 3.2;  // From <a-plane width="3.2">
    const planeHeight = 2.4; // From <a-plane height="2.4">

    // landmark.x is 0 (left) to 1 (right)
    // landmark.y is 0 (top) to 1 (bottom)
    // landmark.z is distance from camera (smaller is closer), origin roughly at hips for pose
    // The video plane itself is flipped (scale="-1 1 1"), so we don't re-flip X mapping
    const x = (landmark.x - 0.5) * planeWidth;
    const y = -(landmark.y - 0.5) * planeHeight + referenceY; // Use plane's Y center if different from camera
    const z = referenceZ + (landmark.z ? landmark.z * 0.5 : 0); // Scale Z effect, keep close to plane

    return { x, y, z };
}

// --- Update Main Organ Overlay ---
function updateMainOrganOverlay(landmarks) {
    if (!bodyAnchor) return; // Should always exist, but good check

    const ls = landmarks[11]; const rs = landmarks[12];
    const lh = landmarks[23]; const rh = landmarks[24];

    if (ls && rs && lh && rh) { // Body is detected
        // Position bodyAnchor (code for this remains the same as your last working version)
        const torsoX_mp = (ls.x + rs.x) / 2;
        const torsoY_mp = (ls.y + lh.y) / 2;
        const torsoZ_mp = ((ls.z || 0) + (rs.z || 0) + (lh.z || 0) + (rh.z || 0)) / 4;
        const cameraEntity = document.getElementById('camera');
        const cameraWorldPos = new THREE.Vector3();
        cameraEntity.object3D.getWorldPosition(cameraWorldPos);
        const torsoPos_af = mapToAFrame({ x: torsoX_mp, y: torsoY_mp, z: torsoZ_mp }, cameraWorldPos.y, document.getElementById('videoBackground').object3D.position.z + 0.1);
        bodyAnchor.setAttribute('position', `${torsoPos_af.x} ${torsoPos_af.y} ${torsoPos_af.z}`);
        bodyAnchor.setAttribute('visible', 'true');


        if (isInspectingIndividualOrgan) {
            // --- MODE: Inspecting Individual Organ ---
            if (mainOrgansEntity) {
                mainOrgansEntity.setAttribute('visible', 'false');
            }
            successDialog.style.display = 'none';
            // The messageDiv would have been set by the sidebar click
        } else {
            // --- MODE: Show Main Organ Overlay ---
            if (mainOrgansEntity) {
                mainOrgansEntity.setAttribute('visible', 'true');
            }
            // Show success dialog only once per this main overlay session
            if (!mainOrgansOverlayed) {
                messageDiv.innerText = "Body Detected!";
                successMessageText.innerText = "Main organs overlayed successfully!";
                successDialog.style.display = 'block';
                mainOrgansOverlayed = true; // Mark that the dialog for main overlay has been shown
                console.log("Main organs overlayed, success message shown.");
            }
        }
    } else { // No body detected
         if (bodyAnchor) bodyAnchor.setAttribute('visible', 'false');
         if (mainOrgansEntity) mainOrgansEntity.setAttribute('visible', 'false');
         successDialog.style.display = 'none';
         messageDiv.innerText = "Camera running. Looking for body...";

         // Reset flags when body is lost, so on re-detection, it starts fresh with main organ overlay
         mainOrgansOverlayed = false;
         isInspectingIndividualOrgan = false;
    }
}

// --- Helper: Get distance between two A-Frame entities' world positions ---
function getAFrameEntityWorldDistance(entity1, entity2) {
    if (!entity1 || !entity2) return Infinity;
    const worldPos1 = new THREE.Vector3();
    const worldPos2 = new THREE.Vector3();
    entity1.object3D.getWorldPosition(worldPos1);
    entity2.object3D.getWorldPosition(worldPos2);
    return worldPos1.distanceTo(worldPos2);
}

// --- Update Hands (with HEAVY DEBUGGING) ---
function updateHands(landmarksArray, handednessArray) {
    let leftHandVisibleThisFrame = false;
    let rightHandVisibleThisFrame = false;
    let leftHandPinchingThisFrame = false;
    let rightHandPinchingThisFrame = false;

    // DEBUG: Is updateHands being called with data?
    if (!landmarksArray || landmarksArray.length === 0) {
        // This log can be very frequent if no hands are detected, uncomment if needed
        // console.log("updateHands: No landmarksArray or empty, hiding spheres.");
        leftHandSphere.setAttribute('visible', 'false');
        rightHandSphere.setAttribute('visible', 'false');
        return;
    }
    console.log(`DEBUG updateHands: Called with ${landmarksArray.length} hand(s).`);

    const cameraEntity = document.getElementById('camera');
    const cameraWorldPos = new THREE.Vector3();
    cameraEntity.object3D.getWorldPosition(cameraWorldPos);
    // Ensure videoBackground exists before trying to get its Z position
    const videoBg = document.getElementById('videoBackground');
    const handReferenceZ = videoBg ? videoBg.object3D.position.z + 0.15 : -1.5; // Fallback Z if videoBg not ready

    for (let i = 0; i < landmarksArray.length; i++) {
        const landmarks = landmarksArray[i]; // Landmarks for a single hand
        if (!landmarks || landmarks.length < 21) { // MediaPipe hand has 21 landmarks
            console.warn(`DEBUG updateHands: Hand ${i} has insufficient landmarks (${landmarks ? landmarks.length : 'null'}). Skipping.`);
            continue;
        }

        const handedness = handednessArray[i][0].categoryName;
        console.log(`DEBUG updateHands: Processing ${handedness} hand.`);

        const wrist = landmarks[0];      // Landmark 0: Wrist
        const thumbTip = landmarks[4];   // Landmark 4: Thumb tip
        const indexTip = landmarks[8];   // Landmark 8: Index finger tip

        // DEBUG: Log raw landmark data
        console.log(`DEBUG updateHands: ${handedness} Raw Wrist: x=${wrist.x.toFixed(3)}, y=${wrist.y.toFixed(3)}, z=${(wrist.z || 0).toFixed(3)}`);
        // console.log(`DEBUG updateHands: ${handedness} Raw Thumb Tip: x=${thumbTip.x.toFixed(3)}, y=${thumbTip.y.toFixed(3)}, z=${(thumbTip.z || 0).toFixed(3)}`);
        // console.log(`DEBUG updateHands: ${handedness} Raw Index Tip: x=${indexTip.x.toFixed(3)}, y=${indexTip.y.toFixed(3)}, z=${(indexTip.z || 0).toFixed(3)}`);

        if (!wrist || !thumbTip || !indexTip) {
            console.warn(`DEBUG updateHands: ${handedness} hand is missing critical landmarks after check.`);
            continue;
        }

        const handSphere = (handedness === 'Left') ? leftHandSphere : rightHandSphere;
        // Use camera's Y position as the reference for vertical mapping of hands
        const wristPos_af = mapToAFrame(wrist, cameraWorldPos.y, handReferenceZ);

        console.log(`DEBUG updateHands: ${handedness} Mapped Wrist A-Frame Coords: x=${wristPos_af.x.toFixed(2)}, y=${wristPos_af.y.toFixed(2)}, z=${wristPos_af.z.toFixed(2)}`);

        handSphere.setAttribute('position', `${wristPos_af.x} ${wristPos_af.y} ${wristPos_af.z}`);
        handSphere.setAttribute('visible', 'true');
        if (handedness === 'Left') leftHandVisibleThisFrame = true;
        else rightHandVisibleThisFrame = true;

        // Check for Pinch/Grab Gesture
        // getDistance calculates based on the original MediaPipe coordinates (0-1 range for x,y)
        const pinchDistance = getDistance(thumbTip, indexTip);
        const grabThreshold = 0.04; // This threshold is for normalized MediaPipe landmark distances

        console.log(`DEBUG updateHands: ${handedness} Pinch Distance (MediaPipe Coords): ${pinchDistance.toFixed(4)} (Threshold: ${grabThreshold})`);

        let isPinching = pinchDistance < grabThreshold;

        if (isPinching) {
            handSphere.setAttribute('material', 'color', 'lime');
            console.log(`DEBUG updateHands: ${handedness} hand is GRABBING (pinch detected)`);
            if (handedness === 'Left') leftHandPinchingThisFrame = true;
            else rightHandPinchingThisFrame = true;
        } else {
            handSphere.setAttribute('material', 'color', handedness === 'Left' ? '#FF7F50' : '#6495ED');
        }

        // --- GRAB LOGIC (Still needs to be refined once pinch is working) ---
        const grabbableOrgan = spawnPoint.querySelector('.grabbable');
        if (isPinching && !currentlyHeldOrganEntity && grabbableOrgan) {
            const distanceToOrgan = getAFrameEntityWorldDistance(handSphere, grabbableOrgan);
            const grabActivationDistance = 0.15; // How close A-Frame hand sphere needs to be to A-Frame organ
            // console.log(`DEBUG updateHands: ${handedness} hand pinching. Distance to grabbable organ (${grabbableOrgan.id}): ${distanceToOrgan.toFixed(3)} (Activation: ${grabActivationDistance})`);
            if (distanceToOrgan < grabActivationDistance) {
                currentlyHeldOrganEntity = grabbableOrgan;
                grabbingHandType = handedness;
                console.log(`DEBUG updateHands: ${grabbingHandType} hand GRABBED ${currentlyHeldOrganEntity.id}`);
                 // Optional: Visual feedback on organ
                // currentlyHeldOrganEntity.setAttribute('material', 'emissive', '#FFFF00');
            }
        }
    }

    if (!leftHandVisibleThisFrame) leftHandSphere.setAttribute('visible', 'false');
    if (!rightHandVisibleThisFrame) rightHandSphere.setAttribute('visible', 'false');

    leftHandGrabbing = leftHandPinchingThisFrame; // Update global state
    rightHandGrabbing = rightHandPinchingThisFrame; // Update global state

    // --- MOVE LOGIC (Still needs to be refined) ---
    if (currentlyHeldOrganEntity) {
        const handSphereToFollow = (grabbingHandType === 'Left') ? leftHandSphere : rightHandSphere;
        const isGrabbingHandStillPinching = (grabbingHandType === 'Left') ? leftHandGrabbing : rightHandGrabbing;

        if (isGrabbingHandStillPinching && handSphereToFollow.getAttribute('visible')) {
            const handPosition = handSphereToFollow.getAttribute('position');
            // console.log(`DEBUG updateHands: Moving ${currentlyHeldOrganEntity.id} with ${grabbingHandType} hand to x=${handPosition.x.toFixed(2)}, y=${handPosition.y.toFixed(2)}, z=${handPosition.z.toFixed(2)}`);
            currentlyHeldOrganEntity.setAttribute('position', `${handPosition.x} ${handPosition.y} ${handPosition.z}`);
        } else if (!isGrabbingHandStillPinching && grabbingHandType) { // If was grabbing but not anymore
            console.log(`DEBUG updateHands: ${grabbingHandType} hand RELEASED ${currentlyHeldOrganEntity.id}`);
            // Optional: Reset visual feedback on organ
            // if(currentlyHeldOrganEntity.hasAttribute('material')) currentlyHeldOrganEntity.removeAttribute('material', 'emissive');

            currentlyHeldOrganEntity = null;
            grabbingHandType = null;
        }
    }
}


// --- MediaPipe Prediction Loop ---
// --- MediaPipe Prediction Loop ---
const predictWebcam = async () => {
    if (!webcamRunning) return;
    const startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
        lastVideoTime = video.currentTime;

        // PoseLandmarker part (keep as is)
        if (poseLandmarker) {
            poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
                if (result.landmarks && result.landmarks.length > 0) {
                    updateMainOrganOverlay(result.landmarks[0]);
                } else { // No pose detected
                    bodyAnchor.setAttribute('visible', 'false');
                    if (mainOrgansEntity) mainOrgansEntity.setAttribute('visible', 'false');
                    if (mainOrgansOverlayed) {
                        messageDiv.innerText = "Camera running. Looking for body...";
                        successDialog.style.display = 'none';
                        mainOrgansOverlayed = false;
                        isInspectingIndividualOrgan = false; // Reset this too if body is lost
                    }
                }
            });
        }

        // HandLandmarker part - MODIFIED FOR DEBUGGING
        if (handLandmarker) {
            handLandmarker.detectForVideo(video, startTimeMs, (result) => {
                // *** VERY IMPORTANT DEBUG LOG ***
                if (result && result.landmarks && result.landmarks.length > 0) {
                    // This log will show if MediaPipe is detecting hands and what data it found
                    console.log(`PREDICT_WEBCAM: HANDS DETECTED! Count: ${result.landmarks.length}`, JSON.parse(JSON.stringify(result.landmarks))); // Log a copy
                    updateHands(result.landmarks, result.handedness);
                } else {
                    // This log can be very noisy if hands are often out of view, uncomment if needed for debugging
                    // console.log("PREDICT_WEBCAM: No hands detected in this particular frame.");
                    updateHands([], []); // Call updateHands with empty data to ensure spheres are hidden
                }
            });
        }
    }
    animationFrameId = window.requestAnimationFrame(predictWebcam);
};
// --- Spawning Organs from Sidebar ---
function spawnGrabbableOrgan(type, modelAssetId, scale) {
    console.log("Spawning grabbable:", type);
    const spawnPoint = document.getElementById('spawnPoint');
    // Clear previous spawned organ AND reset held state if it was the one being held
    if (spawnPoint.firstChild && currentlyHeldOrganEntity && spawnPoint.firstChild.object3D === currentlyHeldOrganEntity.object3D) {
        currentlyHeldOrganEntity = null;
        grabbingHandType = null;
    }
    spawnPoint.innerHTML = ''; // Clear previous

    if (modelAssetId) {
        let organModel = document.createElement('a-gltf-model');
        organModel.setAttribute('src', modelAssetId);
        organModel.setAttribute('scale', scale);
        organModel.setAttribute('id', `grabbable-${type}`);
        organModel.setAttribute('class', 'grabbable'); // Class to identify grabbable objects
        organModel.setAttribute('position', '0 0 0'); // Relative to spawnPoint

        // Store description for later speech
        if (type === 'lungs') organModel.dataset.description = "These are the lungs, primary organs of the respiratory system.";
        else if (type === 'liver') organModel.dataset.description = "This is the liver, it filters blood and aids in digestion.";
        else if (type === 'heart') organModel.dataset.description = "This is the heart, it pumps blood throughout the body.";
        // Add more descriptions

        spawnPoint.appendChild(organModel);
        console.log("Spawned grabbable organ at spawnPoint:", organModel);
    }
}

// --- Event Listeners ---
startButton.addEventListener('click', () => { startButton.disabled = true; startWebcam(); });
stopButton.addEventListener('click', stopWebcam);
closeIcon.addEventListener('click', () => { if (confirm("Close this App?")) { stopWebcam(); /* Potentially other cleanup */ } });
closeSuccessDialog.addEventListener('click', () => { successDialog.style.display = 'none'; });

// Sidebar click listeners
document.querySelectorAll('#organSidebar li').forEach(item => {
    item.addEventListener('click', () => {
        const organType = item.getAttribute('data-organ');
        const modelAssetId = item.getAttribute('data-model-asset');
        const scale = item.getAttribute('data-scale');
        console.log(`Sidebar: ${organType} clicked. Spawning ${modelAssetId} with scale ${scale}.`);

        isInspectingIndividualOrgan = true; // Set the mode to individual organ

        // Immediately hide the main organ and its success dialog
        if (mainOrgansEntity) {
            mainOrgansEntity.setAttribute('visible', 'false');
        }
        if (bodyAnchor) { // You might want to hide the anchor if mainOrgansEntity is its only meaningful child in this view
            // bodyAnchor.setAttribute('visible', 'false'); // Optional: Consider the effect on hand mapping
        }
        successDialog.style.display = 'none';
        // No need to change mainOrgansOverlayed here, updateMainOrganOverlay will handle it based on isInspectingIndividualOrgan

        messageDiv.innerText = `Selected: ${organType}. Ready for interaction.`;
        console.log("script.js: Switched to individual organ mode. Main organs hidden.");

        spawnGrabbableOrgan(organType, modelAssetId, scale);
    });
});


// --- Speech Synthesis (Keep as before) ---
const speak = (text) => { /* ... */ };

// --- Initialization ---
document.addEventListener('DOMContentLoaded', createLandmarkers);
console.log("script.js: Script execution finished.");