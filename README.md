Interactive AR Anatomy Viewer
This is a web-based Augmented Reality (AR) application that uses a standard webcam to create an immersive educational experience. It overlays 3D models of human organs onto a user's body in real-time and allows for interaction using natural hand gestures.

🌟 Features
Real-time AR Overlay: The application uses MediaPipe Pose to detect the user's body and anchor a primary 3D model of the human organ system to their torso.

Real-time Landmark Tracking: The whole interactive system is based on smooth and reliable data coming from the user's webcam. When application it start scanning the body and once body detected it showing the message highlighted with black color. 

Intuitive Hand Gestures: Leveraging MediaPipe Hands, users can interact with the application without a mouse or keyboard.

Hand Hover: Hovering over the on-body model or the sidebar previews provides informational feedback.

Pinch to Drag & Drop: Users can "pick up" individual organ models from the sidebar by pinching their fingers and "drop" them into the main scene for closer inspection.

Free-Placement Model Dropping: Dropped organs stay at the location where the user releases them, allowing for user-controlled placement.

Multi-Sensory Feedback:

Visual: High-quality 3D models are rendered directly onto the user's video feed. Hovering highlights the active model.

Informational: A text panel displays key information about the currently selected organ.

Auditory: The browser's native Web Speech API provides text-to-speech narration of the informational text.

Performant UI: The sidebar uses Google's <model-viewer> component for stable and high-performance 3D previews, avoiding browser WebGL context limits.

Reset Functionality: A "Reset View" button allows the user to easily return to the main united.glb organ model at any time.

🛠️ Technology Stack
3D/AR Scene: A-Frame

3D Model Previews: Google <model-viewer>

Computer Vision (Pose & Hand Tracking): Google MediaPipe

Speech Synthesis: Web Speech API (speechSynthesis)

Core Language: JavaScript (ES6+)

Structure & Styling: HTML5, CSS3

🚀 Setup and Usage
This project must be run from a local web server to allow the browser to load local 3D model files (.glb). Opening the index.html file directly will not work due to browser security policies (CORS).

The easiest way to do this is with Visual Studio Code and the Live Server extension.

Prerequisites
Visual Studio Code installed.

The Live Server extension installed in VS Code.

Running the Application
Open the Project Folder: In Visual Studio Code, go to File > Open Folder... and select your entire project folder.

Ensure Correct File Structure: Your folder should be organized like this:

AR_Anatomy_Project/
├── index.html
└── models/
    ├── united.glb
    ├── lung.glb
    ├── liver.glb
    └── (etc...)

Start the Server: Right-click on your index.html file in the VS Code explorer panel and select "Open with Live Server".

A new browser tab will automatically open with an address like http://localhost:8000. The application will now have the correct permissions to load your models.

To use a Real Time Landmark Tracking use the URL address: http://localhost:8000/tracking_version_index.html

Allow the browser to access your webcam when prompted.

