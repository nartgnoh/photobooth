const state = {

            currentScreen: 'mode',

            selectedTemplate: 'single',

            overlayTheme: 'gold',

            customThemeColors: {
                background: '#FDFBF7',
                accent: '#D4AF37',
                text: '#2C2A29'
            },

            borderStyle: 'classic',

            capturedImages: [],

            eventData: {

                title: "DENNIS & HONG'S WEDDING",
                date: "",
                subtitle: "",

                countdownSeconds: 3,

                resetSeconds: 60

            },

            webcamStream: null,

            selectedCameraId: '',

            eventLogoDataUrl: '',

            recentGallery: [],

            autoResetTimer: null,

            resetCountdownRemaining: 60

        };

        const DOM = {

            screens: {

                mode: document.getElementById('screen-mode'),

                capture: document.getElementById('screen-capture'),

                review: document.getElementById('screen-review')

            },

            video: document.getElementById('webcam'),

            cameraSelect: document.getElementById('cfg-camera'),

            cameraStatus: document.getElementById('camera-status'),

            logoInput: document.getElementById('cfg-logo'),

            logoPreview: document.getElementById('logo-preview'),

            logoPreviewContainer: document.getElementById('logo-preview-container'),

            logoStatus: document.getElementById('logo-status'),

            canvas: document.getElementById('output-canvas'),

            countdownOverlay: document.getElementById('countdown-overlay'),

            countdownNumber: document.getElementById('countdown-number'),

            sequenceIndicator: document.getElementById('sequence-indicator'),

            flashOverlay: document.getElementById('flash-overlay'),

            headerTitle: document.getElementById('header-title'),

            headerDate: document.getElementById('header-date'),

            qrModal: document.getElementById('qr-modal'),

            galleryModal: document.getElementById('gallery-modal'),

            adminDrawer: document.getElementById('admin-drawer')

        };

        window.addEventListener('DOMContentLoaded', () => {

            lucide.createIcons();

            updateHeaderDisplay();

        });

        function updateHeaderDisplay() {

            DOM.headerTitle.textContent = state.eventData.title;
            DOM.headerDate.textContent = state.eventData.date;
            DOM.headerDate.classList.toggle('hidden', !state.eventData.date);

        }

        function switchScreen(screenName) {

            state.currentScreen = screenName;

            Object.keys(DOM.screens).forEach(key => {

                if (key === screenName) {

                    DOM.screens[key].classList.remove('hidden');

                    DOM.screens[key].classList.add('flex');

                } else {

                    DOM.screens[key].classList.add('hidden');

                    DOM.screens[key].classList.remove('flex');

                }

            });

            if (screenName === 'review') {
                syncBorderStyleOptions();
            }

            if (screenName !== 'review') {

                clearInterval(state.autoResetTimer);

            }

        }

        async function selectTemplate(templateType) {
            state.selectedTemplate = templateType;
            const cameraReady = await startWebcam();
            if (!cameraReady) return;
            switchScreen('capture');
        }

        async function startWebcam() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera access requires a supported browser and a secure connection (HTTPS or localhost).");
                }

                const videoConstraints = {
                    ...(state.selectedCameraId
                        ? { deviceId: { exact: state.selectedCameraId } }
                        : { facingMode: "user" }),
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                };
                const constraints = {
                    video: videoConstraints,
                    audio: false
                };
                state.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
                DOM.video.srcObject = state.webcamStream;
                await DOM.video.play();
                return true;
            } catch (err) {
                stopWebcam();
                alert(`Unable to start the camera. Please allow camera access and use HTTPS or localhost.\n\n${err.message}`);
                console.error("Webcam error:", err);
                return false;
            }
        }

        async function refreshCameraList() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera selection requires a supported browser and a secure connection (HTTPS or localhost).");
                }

                DOM.cameraStatus.textContent = "Requesting camera access…";
                const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                permissionStream.getTracks().forEach(track => track.stop());

                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(device => device.kind === 'videoinput');
                const previousSelection = DOM.cameraSelect.value || state.selectedCameraId;

                DOM.cameraSelect.replaceChildren(new Option("Default camera", ""));

                cameras.forEach((camera, index) => {
                    const label = camera.label || `Camera ${index + 1}`;
                    DOM.cameraSelect.add(new Option(label, camera.deviceId));
                });

                if (cameras.some(camera => camera.deviceId === previousSelection)) {
                    DOM.cameraSelect.value = previousSelection;
                } else {
                    DOM.cameraSelect.value = "";
                    if (previousSelection) {
                        state.selectedCameraId = "";
                    }
                }

                DOM.cameraStatus.textContent = cameras.length
                    ? `${cameras.length} camera${cameras.length === 1 ? '' : 's'} found. Select one and save settings.`
                    : "No cameras found. Connect a camera and search again.";
            } catch (err) {
                DOM.cameraStatus.textContent = `Could not find cameras: ${err.message}`;
                console.error("Camera discovery error:", err);
            }
        }

        function stopWebcam() {

            if (state.webcamStream) {

                state.webcamStream.getTracks().forEach(track => track.stop());

                state.webcamStream = null;

            }

        }

        function playBeepSound(frequency = 800, duration = 0.1) {

            try {

                const ctx = new (window.AudioContext || window.webkitAudioContext)();

                const osc = ctx.createOscillator();

                const gain = ctx.createGain();

                osc.type = 'sine';

                osc.frequency.value = frequency;

                gain.gain.setValueAtTime(0.2, ctx.currentTime);

                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

                osc.connect(gain);

                gain.connect(ctx.destination);

                osc.start();

                osc.stop(ctx.currentTime + duration);

            } catch (e) {}

        }

        function playShutterSound() {

            playBeepSound(1200, 0.15);

        }

        async function startCaptureSequence() {

            state.capturedImages = [];

            document.getElementById('shutter-btn').style.display = 'none';

            let photoCount = 1;

            if (state.selectedTemplate === 'strip2') photoCount = 4;

            if (state.selectedTemplate === 'grid4') photoCount = 4;
            if (state.selectedTemplate === 'portrait4') photoCount = 4;

            for (let i = 0; i < photoCount; i++) {

                DOM.sequenceIndicator.textContent = `Photo ${i + 1} of ${photoCount}`;

                await runCountdown(state.eventData.countdownSeconds);

                triggerFlash();

                playShutterSound();

                const snapshot = captureWebcamFrame();

                state.capturedImages.push(snapshot);

                if (i < photoCount - 1) {

                    await new Promise(r => setTimeout(r, 1500));

                }

            }

            document.getElementById('shutter-btn').style.display = 'flex';

            stopWebcam();

            renderFinalCanvas(true);

            switchScreen('review');

            startAutoResetTimer();

            confetti({

                particleCount: 70,

                spread: 60,

                origin: { y: 0.6 },

                colors: ['#D4AF37', '#E6D7C3', '#8A9A86']

            });

        }

        function runCountdown(seconds) {

            return new Promise((resolve) => {

                let count = seconds;

                DOM.countdownOverlay.classList.remove('hidden');

                DOM.countdownNumber.textContent = count;

                playBeepSound(600, 0.1);

                const interval = setInterval(() => {

                    count--;

                    if (count > 0) {

                        DOM.countdownNumber.textContent = count;

                        playBeepSound(600, 0.1);

                    } else {

                        clearInterval(interval);

                        DOM.countdownOverlay.classList.add('hidden');

                        resolve();

                    }

                }, 1000);

            });

        }

        function triggerFlash() {

            DOM.flashOverlay.classList.add('active');

            setTimeout(() => {

                DOM.flashOverlay.classList.remove('active');

            }, 150);

        }

        function captureWebcamFrame() {

            const tempCanvas = document.createElement('canvas');

            tempCanvas.width = DOM.video.videoWidth || 1280;

            tempCanvas.height = DOM.video.videoHeight || 720;

            const ctx = tempCanvas.getContext('2d');

            ctx.translate(tempCanvas.width, 0);

            ctx.scale(-1, 1);

            ctx.drawImage(DOM.video, 0, 0, tempCanvas.width, tempCanvas.height);

            return tempCanvas.toDataURL('image/jpeg', 0.92);

        }

        function cancelCapture() {

            stopWebcam();

            document.getElementById('shutter-btn').style.display = 'flex';

            switchScreen('mode');

        }

        function renderFinalCanvas(addToGallery = false) {

            const canvas = DOM.canvas;

            const ctx = canvas.getContext('2d');

            const isPortraitPrint = state.selectedTemplate === 'strip2' || state.selectedTemplate === 'portrait4';
            const W = isPortraitPrint ? 1200 : 1800;
            const H = isPortraitPrint ? 1800 : 1200;
            const borderStyle = state.borderStyle;

            canvas.width = W;

            canvas.height = H;

            const themeColors = getOverlayThemeColors();
            const bgColor = themeColors.background;
            const fontColor = themeColors.text;
            const accentColor = themeColors.accent;

            ctx.fillStyle = bgColor;

            ctx.fillRect(0, 0, W, H);

            if (state.selectedTemplate !== 'strip2') {
                drawDecorativeFrame(ctx, 30, 30, W - 60, H - 60, accentColor, borderStyle);
            }

            const loadedImages = [];
            let loadedCount = 0;

            const drawCanvas = (logoImage = null) => {
                drawPhotosAndOverlay(ctx, W, H, loadedImages, fontColor, accentColor, bgColor, logoImage, borderStyle);
                if (addToGallery) {
                    saveToRecentGallery(canvas.toDataURL());
                }
            };

            state.capturedImages.forEach((src, idx) => {

                const img = new Image();

                img.onload = () => {

                    loadedImages[idx] = img;
                    loadedCount++;
                    if (loadedCount === state.capturedImages.length) {
                        if (!state.eventLogoDataUrl) {
                            drawCanvas();
                            return;
                        }

                        const logoImage = new Image();
                        logoImage.onload = () => drawCanvas(logoImage);
                        logoImage.onerror = () => {
                            DOM.logoStatus.textContent = "The uploaded logo could not be loaded. Try another image.";
                            console.error("Unable to load the uploaded event logo.");
                            drawCanvas();
                        };
                        logoImage.src = state.eventLogoDataUrl;
                    }

                };

                img.src = src;

            });

        }

        function drawPhotosAndOverlay(ctx, W, H, images, fontColor, accentColor, bgColor, logoImage = null, borderStyle = state.borderStyle) {
            const template = state.selectedTemplate;
            if (template === 'single') {
                drawPhotoFrame(ctx, images[0], 150, 100, 1500, 845, accentColor, 7);
                drawSingleEventCaption(ctx, fontColor, accentColor, W);
                return;
            }

            if (template === 'strip2') {

                const stripWidth = 480;

                const stripPositions = [45, 675];

                const photoXInset = 26;

                const photoWidth = stripWidth - (photoXInset * 2);

                const photoHeight = 310;
                const photoGap = 16;
                const photoTop = 95;

                stripPositions.forEach(stripX => {

                    images.forEach((img, index) => {

                        const photoY = photoTop + index * (photoHeight + photoGap);

                        drawCroppedImage(ctx, img, stripX + photoXInset, photoY, photoWidth, photoHeight);

                        ctx.strokeStyle = accentColor;

                        ctx.lineWidth = 4;

                        ctx.strokeRect(stripX + photoXInset, photoY, photoWidth, photoHeight);

                    });

                    drawDecorativeFrame(ctx, stripX, 55, stripWidth, H - 110, accentColor, borderStyle);

                    const stripCenterX = stripX + stripWidth / 2;
                    if (logoImage) {
                        drawLogoImage(ctx, logoImage, stripCenterX, H - 370, 110, 50);
                    }
                    const footerLineY = H - 275;

                    ctx.beginPath();

                    ctx.moveTo(stripX + 70, footerLineY);

                    ctx.lineTo(stripX + stripWidth - 70, footerLineY);

                    ctx.strokeStyle = accentColor;

                    ctx.lineWidth = 2;

                    ctx.stroke();

                    ctx.textAlign = "center";

                    ctx.fillStyle = fontColor;

                    ctx.font = "600 30px 'Playfair Display', serif";

                    ctx.fillText(state.eventData.title, stripCenterX, H - 235, stripWidth - 30);

                    ctx.fillStyle = accentColor;

                    ctx.font = "500 20px 'Cinzel', serif";

                    ctx.fillText(state.eventData.date, stripCenterX, H - 200, stripWidth - 30);

                    ctx.fillStyle = "#888888";

                    ctx.font = "300 18px 'Montserrat', sans-serif";

                    ctx.fillText(state.eventData.subtitle, stripCenterX, H - 170, stripWidth - 30);

                });

                ctx.save();

                ctx.setLineDash([14, 12]);

                ctx.strokeStyle = accentColor;

                ctx.lineWidth = 3;

                ctx.beginPath();

                ctx.moveTo(W / 2, 45);

                ctx.lineTo(W / 2, H - 45);

                ctx.stroke();

                ctx.restore();

                ctx.fillStyle = bgColor;

                ctx.fillRect(W / 2 - 34, 29, 68, 34);

                ctx.fillStyle = accentColor;

                ctx.textAlign = "center";

                ctx.font = "600 16px 'Montserrat', sans-serif";

                ctx.fillText("CUT", W / 2, 52);

                ctx.fillStyle = bgColor;
                ctx.fillRect(W / 2 - 34, H - 63, 68, 34);
                ctx.fillStyle = accentColor;
                ctx.fillText("CUT", W / 2, H - 40);

                return;
            }

            if (template === 'grid4') {
                drawPhotoFrame(ctx, images[0], 95, 105, 900, 555, accentColor, 6);
                drawEventDetails(ctx, fontColor, accentColor, 1010, 145, 650, 465, 53, logoImage);

                const photoY = 760;
                const photoWidth = 500;
                const photoHeight = 320;
                [1, 2, 3].forEach((imageIndex, index) => {
                    drawPhotoFrame(ctx, images[imageIndex], 105 + index * 565, photoY, photoWidth, photoHeight, accentColor, 6);
                });
            }

            if (template === 'portrait4') {
                const photoWidth = 450;
                const photoHeight = 490;
                const photoPositions = [
                    [120, 145],
                    [630, 145],
                    [120, 675],
                    [630, 675]
                ];

                photoPositions.forEach(([x, y], index) => {
                    drawPhotoFrame(ctx, images[index], x, y, photoWidth, photoHeight, accentColor, 6);
                });

                drawPortraitEventCaption(ctx, W, fontColor, accentColor, logoImage);
            }
        }

        function drawPhotoFrame(ctx, image, x, y, width, height, accentColor, lineWidth) {
            drawCroppedImage(ctx, image, x, y, width, height);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x, y, width, height);
        }

        function drawDecorativeFrame(ctx, x, y, width, height, color, style) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;

            if (style === 'pearl') {
                ctx.lineCap = "round";
                ctx.setLineDash([1, 12]);
                ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
                ctx.setLineDash([]);
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 16, y + 16, width - 32, height - 32);
            } else {
                ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 15, y + 15, width - 30, height - 30);

                if (style === 'artDeco') {
                    const cornerSize = 58;
                    const offsets = [25, 39, 53];
                    const corners = [
                        { x: x + 20, y: y + 20, sx: 1, sy: 1 },
                        { x: x + width - 20, y: y + 20, sx: -1, sy: 1 },
                        { x: x + 20, y: y + height - 20, sx: 1, sy: -1 },
                        { x: x + width - 20, y: y + height - 20, sx: -1, sy: -1 }
                    ];
                    corners.forEach(corner => {
                        offsets.forEach(offset => {
                            ctx.beginPath();
                            ctx.moveTo(corner.x + corner.sx * offset, corner.y);
                            ctx.lineTo(corner.x + corner.sx * (offset + cornerSize), corner.y);
                            ctx.moveTo(corner.x, corner.y + corner.sy * offset);
                            ctx.lineTo(corner.x, corner.y + corner.sy * (offset + cornerSize));
                            ctx.stroke();
                        });
                    });
                } else if (style === 'botanical') {
                    drawBotanicalCorner(ctx, x + 18, y + 18, 1, 1, color);
                    drawBotanicalCorner(ctx, x + width - 18, y + 18, -1, 1, color);
                    drawBotanicalCorner(ctx, x + 18, y + height - 18, 1, -1, color);
                    drawBotanicalCorner(ctx, x + width - 18, y + height - 18, -1, -1, color);
                } else if (style === 'garden') {
                    drawGardenCorner(ctx, x + 20, y + 20, 1, 1);
                    drawGardenCorner(ctx, x + width - 20, y + 20, -1, 1);
                    drawGardenCorner(ctx, x + 20, y + height - 20, 1, -1);
                    drawGardenCorner(ctx, x + width - 20, y + height - 20, -1, -1);
                }
            }

            ctx.restore();
        }

        function drawGardenCorner(ctx, x, y, scaleX, scaleY) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scaleX, scaleY);
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            ctx.strokeStyle = '#809B85';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(34, 9, 66, 66);
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(9, 36, 66, 66);
            ctx.stroke();

            const leaves = [
                [17, 9, -0.7], [29, 17, 0.75], [42, 29, -0.7],
                [54, 45, 0.75], [10, 19, 0.75], [20, 34, -0.7],
                [35, 48, 0.75], [48, 59, -0.7]
            ];
            leaves.forEach(([leafX, leafY, rotation], index) => {
                ctx.save();
                ctx.translate(leafX, leafY);
                ctx.rotate(rotation);
                ctx.fillStyle = index % 2 ? '#A9B99A' : '#789984';
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            [[37, 24, '#D9A7AF'], [61, 54, '#E3C886']].forEach(([flowerX, flowerY, petalColor]) => {
                ctx.fillStyle = petalColor;
                for (let petal = 0; petal < 5; petal++) {
                    const angle = (Math.PI * 2 * petal) / 5;
                    ctx.beginPath();
                    ctx.ellipse(
                        flowerX + Math.cos(angle) * 6,
                        flowerY + Math.sin(angle) * 6,
                        4,
                        6,
                        angle,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                ctx.fillStyle = '#E8C86A';
                ctx.beginPath();
                ctx.arc(flowerX, flowerY, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        }

        function drawBotanicalCorner(ctx, x, y, scaleX, scaleY, color) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scaleX, scaleY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(74, 0);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 74);
            ctx.moveTo(5, 5);
            ctx.quadraticCurveTo(28, 24, 57, 57);
            ctx.stroke();

            ctx.fillStyle = color;
            [[18, 16, -0.55], [33, 31, 0.8], [47, 46, -0.55], [16, 24, 0.8], [27, 38, -0.55], [42, 52, 0.8]].forEach(([leafX, leafY, rotation]) => {
                ctx.save();
                ctx.translate(leafX, leafY);
                ctx.rotate(rotation);
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
            ctx.restore();
        }

        function drawLogoImage(ctx, image, centerX, topY, maxWidth, maxHeight) {
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            ctx.drawImage(image, centerX - width / 2, topY + (maxHeight - height) / 2, width, height);
        }

        function drawSingleEventCaption(ctx, fontColor, accentColor, canvasWidth) {
            const centerX = canvasWidth / 2;
            const textWidth = canvasWidth - 240;
            const titleY = 1010;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = fontColor;
            ctx.font = "600 42px 'Playfair Display', serif";
            ctx.fillText(state.eventData.title, centerX, titleY, textWidth);

            if (state.eventData.date) {
                ctx.fillStyle = accentColor;
                ctx.font = "500 22px 'Cinzel', serif";
                ctx.fillText(state.eventData.date, centerX, titleY + 43, textWidth);
            }

            if (state.eventData.subtitle) {
                ctx.fillStyle = "#888888";
                ctx.font = "300 18px 'Montserrat', sans-serif";
                ctx.fillText(state.eventData.subtitle, centerX, titleY + (state.eventData.date ? 76 : 43), textWidth);
            }

            ctx.restore();
        }

        function drawPortraitEventCaption(ctx, canvasWidth, fontColor, accentColor, logoImage) {
            const centerX = canvasWidth / 2;
            const titleY = logoImage ? 1405 : 1375;

            if (logoImage) {
                drawLogoImage(ctx, logoImage, centerX, 1270, 190, 90);
            }

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = accentColor;
            ctx.font = "500 25px 'Cinzel', serif";
            ctx.fillText("CELEBRATING", centerX, titleY - 48, canvasWidth - 240);

            ctx.fillStyle = fontColor;
            ctx.font = "600 58px 'Playfair Display', serif";
            ctx.fillText(state.eventData.title, centerX, titleY + 18, canvasWidth - 180);

            if (state.eventData.date) {
                ctx.fillStyle = accentColor;
                ctx.font = "500 25px 'Cinzel', serif";
                ctx.fillText(state.eventData.date, centerX, titleY + 78, canvasWidth - 240);
            }

            if (state.eventData.subtitle) {
                ctx.fillStyle = "#888888";
                ctx.font = "300 21px 'Montserrat', sans-serif";
                ctx.fillText(state.eventData.subtitle, centerX, titleY + (state.eventData.date ? 120 : 78), canvasWidth - 240);
            }
            ctx.restore();
        }

        function drawEventDetails(ctx, fontColor, accentColor, x, y, width, height, titleSize, logoImage = null) {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const title = state.eventData.title;
            const maxLineWidth = width - 40;
            const logoHeight = logoImage ? 82 : 0;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (logoImage) {
                drawLogoImage(ctx, logoImage, centerX, y + 18, 170, 82);
            }
            ctx.fillStyle = accentColor;
            ctx.font = "500 23px 'Cinzel', serif";
            const celebrationY = y + 40 + logoHeight;
            ctx.fillText("CELEBRATING", centerX, celebrationY, maxLineWidth);

            ctx.fillStyle = fontColor;
            ctx.font = `600 ${titleSize}px 'Playfair Display', serif`;
            const words = title.split(/\s+/);
            const lines = [];
            let line = "";
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxLineWidth) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
                }
            }
            if (line) lines.push(line);
            const lineHeight = titleSize * 1.12;
            const titleBlockCenterY = (celebrationY + 50 + y + height - 110) / 2;
            const titleStartY = titleBlockCenterY - ((lines.length - 1) * lineHeight) / 2;
            lines.forEach((titleLine, index) => {
                ctx.fillText(titleLine, centerX, titleStartY + index * lineHeight, maxLineWidth);
            });

            let detailY = Math.min(y + height - 90, titleStartY + lines.length * lineHeight + 22);
            if (state.eventData.date) {
                ctx.fillStyle = accentColor;
                ctx.font = "500 25px 'Cinzel', serif";
                ctx.fillText(state.eventData.date, centerX, detailY, maxLineWidth);
                detailY += 38;
            }
            if (state.eventData.subtitle) {
                ctx.fillStyle = "#888888";
                ctx.font = "300 20px 'Montserrat', sans-serif";
                ctx.fillText(state.eventData.subtitle, centerX, detailY, maxLineWidth);
            }

            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 75, y + height - 22);
            ctx.lineTo(centerX + 75, y + height - 22);
            ctx.stroke();
            ctx.restore();
        }

        function drawCroppedImage(ctx, img, x, y, width, height) {

            const aspectTarget = width / height;

            const aspectImg = img.width / img.height;

            let sx, sy, sWidth, sHeight;

            if (aspectImg > aspectTarget) {

                sHeight = img.height;

                sWidth = img.height * aspectTarget;

                sx = (img.width - sWidth) / 2;

                sy = 0;

            } else {

                sWidth = img.width;

                sHeight = img.width / aspectTarget;

                sx = 0;

                sy = (img.height - sHeight) / 2;

            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);

        }

        function changeOverlayTheme(theme) {
            state.overlayTheme = theme;
            const colors = getOverlayThemeColors(theme);
            state.customThemeColors = { ...colors };
            document.getElementById('custom-bg-color').value = colors.background;
            document.getElementById('custom-accent-color').value = colors.accent;
            document.getElementById('custom-text-color').value = colors.text;
            const themeNames = {
                gold: 'Elegance Gold',
                sage: 'Botanical Sage',
                minimal: 'Minimal Modern',
                rose: 'Rose Romance',
                ocean: 'Coastal Blue',
                lavender: 'Lavender',
                terracotta: 'Terracotta',
                midnight: 'Midnight'
            };
            document.getElementById('custom-theme-status').textContent = `${themeNames[theme]} selected. Adjust a color to customize it.`;
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
            });
            renderFinalCanvas();
        }

        function getOverlayThemeColors(theme = state.overlayTheme) {
            const themes = {
                gold: { background: '#FDFBF7', accent: '#D4AF37', text: '#2C2A29' },
                sage: { background: '#F4F6F4', accent: '#8A9A86', text: '#2C2A29' },
                minimal: { background: '#FFFFFF', accent: '#2C2A29', text: '#2C2A29' },
                rose: { background: '#FAF5F5', accent: '#E8D3D3', text: '#581825' },
                ocean: { background: '#F3F7F8', accent: '#397C8A', text: '#20333A' },
                lavender: { background: '#F7F4FA', accent: '#8D79A8', text: '#352D40' },
                terracotta: { background: '#FBF4EF', accent: '#B86645', text: '#492F26' },
                midnight: { background: '#F1F3F7', accent: '#30435C', text: '#1C293B' }
            };
            return themes[theme] || state.customThemeColors;
        }

        function applyCustomOverlayColors() {
            state.customThemeColors = {
                background: document.getElementById('custom-bg-color').value,
                accent: document.getElementById('custom-accent-color').value,
                text: document.getElementById('custom-text-color').value
            };
            state.overlayTheme = 'custom';
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', 'false');
            });
            document.getElementById('custom-theme-status').textContent = 'Custom colors applied.';
            renderFinalCanvas();
        }

        function changeBorderStyle(style) {
            state.borderStyle = style;
            syncBorderStyleOptions();
            renderFinalCanvas();
        }

        function syncBorderStyleOptions() {
            document.querySelectorAll('.border-style-option').forEach(button => {
                const selected = button.getAttribute('onclick') === `changeBorderStyle('${state.borderStyle}')`;
                button.setAttribute('aria-pressed', String(selected));
                button.classList.toggle('border-2', selected);
                button.classList.toggle('border-gold', selected);
                button.classList.toggle('bg-warmSand', selected);
                button.classList.toggle('border', !selected);
                button.classList.toggle('border-champagne', !selected);
            });
        }

        function handleLogoUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                DOM.logoStatus.textContent = "Choose a supported image file.";
                DOM.logoInput.value = "";
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                DOM.logoStatus.textContent = "That image is larger than 5 MB. Choose a smaller logo file.";
                DOM.logoInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== 'string') {
                    DOM.logoStatus.textContent = "The logo file could not be read. Try another image.";
                    return;
                }
                state.eventLogoDataUrl = reader.result;
                updateLogoPreview();
                DOM.logoStatus.textContent = `${file.name} added. It will appear on the photo design.`;
                if (state.currentScreen === 'review') {
                    renderFinalCanvas();
                }
            };
            reader.onerror = () => {
                DOM.logoStatus.textContent = "The logo file could not be read. Try another image.";
                console.error("Unable to read the uploaded event logo.");
            };
            reader.readAsDataURL(file);
        }

        function removeEventLogo() {
            state.eventLogoDataUrl = '';
            DOM.logoInput.value = '';
            DOM.logoStatus.textContent = "Logo removed.";
            updateLogoPreview();
            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }

        function updateLogoPreview() {
            DOM.logoPreviewContainer.classList.toggle('hidden', !state.eventLogoDataUrl);
            DOM.logoPreviewContainer.classList.toggle('flex', Boolean(state.eventLogoDataUrl));
            DOM.logoPreview.src = state.eventLogoDataUrl || '';
        }


        function printPhoto(dataUrl) {
            const printArea = document.getElementById('print-area');
            let pageStyle = document.getElementById('print-page-style');
            if (!pageStyle) {
                pageStyle = document.createElement('style');
                pageStyle.id = 'print-page-style';
                document.head.appendChild(pageStyle);
            }

            const image = new Image();
            image.alt = 'Photo Booth Print';
            image.onload = () => {
                const isPortraitPrint = image.naturalHeight > image.naturalWidth;
                const pageWidth = isPortraitPrint ? 4 : 6;
                const pageHeight = isPortraitPrint ? 6 : 4;

                pageStyle.textContent = `@page { size: ${pageWidth}in ${pageHeight}in; margin: 0; }`;
                printArea.style.width = `${pageWidth}in`;
                printArea.style.height = `${pageHeight}in`;
                printArea.replaceChildren(image);

                window.print();
            };
            image.onerror = () => {
                console.error('Unable to load the photo for printing.');
            };
            image.src = dataUrl;

        }

        function triggerPrint() {
            printPhoto(DOM.canvas.toDataURL('image/png'));
        }

        function downloadPhoto() {
            const link = document.createElement('a');
            link.download = 'photo-booth.jpg';
            link.href = DOM.canvas.toDataURL('image/jpeg', 0.92);
            link.click();
        }

        function saveToRecentGallery(dataUrl) {

            state.recentGallery.unshift(dataUrl);

            if (state.recentGallery.length > 12) state.recentGallery.pop();

        }

        function toggleGalleryModal() {

            const modal = DOM.galleryModal;

            if (modal.classList.contains('hidden')) {

                modal.classList.remove('hidden');

                renderGalleryGrid();

            } else {

                modal.classList.add('hidden');

            }

        }

        function renderGalleryGrid() {

            const grid = document.getElementById('gallery-grid');

            grid.innerHTML = "";

            if (state.recentGallery.length === 0) {

                grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400 text-sm">No photos captured yet during this session.</div>`;

                return;

            }

            state.recentGallery.forEach((imgData, idx) => {

                const item = document.createElement('div');

                item.className = "relative group rounded-xl overflow-hidden border border-champagne shadow-sm bg-warmSand";

                item.innerHTML = `

                    <img src="${imgData}" class="w-full h-auto object-cover">

                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">

                        <button onclick="reprintGalleryImage('${imgData}')" class="p-2 bg-white rounded-full text-charcoal shadow hover:bg-gold hover:text-white transition" title="Print Photo">

                            <i data-lucide="printer" class="w-4 h-4"></i>

                        </button>

                    </div>

                `;

                grid.appendChild(item);

            });

            lucide.createIcons();

        }

        function reprintGalleryImage(imgData) {

            printPhoto(imgData);

        }

        function startAutoResetTimer() {

            clearInterval(state.autoResetTimer);

            state.resetCountdownRemaining = parseInt(state.eventData.resetSeconds);

            const timerDisplay = document.getElementById('auto-reset-timer');

            if (timerDisplay) timerDisplay.textContent = state.resetCountdownRemaining;

            state.autoResetTimer = setInterval(() => {

                state.resetCountdownRemaining--;

                if (timerDisplay) timerDisplay.textContent = state.resetCountdownRemaining;

                if (state.resetCountdownRemaining <= 0) {

                    clearInterval(state.autoResetTimer);

                    resetToHome();

                }

            }, 1000);

        }

        function resetToHome() {

            clearInterval(state.autoResetTimer);

            state.capturedImages = [];

            switchScreen('mode');

        }

        function openAdminPanel() {
            DOM.adminDrawer.classList.remove('translate-x-full');
            DOM.cameraSelect.value = state.selectedCameraId;
            document.getElementById('custom-bg-color').value = state.customThemeColors.background;
            document.getElementById('custom-accent-color').value = state.customThemeColors.accent;
            document.getElementById('custom-text-color').value = state.customThemeColors.text;
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.theme === state.overlayTheme));
            });
            syncBorderStyleOptions();
            document.getElementById('custom-theme-status').textContent = state.overlayTheme === 'custom'
                ? 'Custom colors applied.'
                : 'Choose a palette or customize its colors.';
        }

        function closeAdminPanel() {

            DOM.adminDrawer.classList.add('translate-x-full');

        }

        function saveAdminSettings() {
            state.selectedCameraId = DOM.cameraSelect.value;
            state.eventData.title = document.getElementById('cfg-title').value.trim().toUpperCase() || "DENNIS & HONG'S WEDDING";

            state.eventData.date = document.getElementById('cfg-date').value.trim().toUpperCase();

            state.eventData.subtitle = document.getElementById('cfg-subtitle').value.trim();

            state.eventData.countdownSeconds = parseInt(document.getElementById('cfg-countdown').value);

            state.eventData.resetSeconds = parseInt(document.getElementById('cfg-reset').value);

            updateHeaderDisplay();

            closeAdminPanel();

            if (state.currentScreen === 'review') {

                renderFinalCanvas();

            }

        }
